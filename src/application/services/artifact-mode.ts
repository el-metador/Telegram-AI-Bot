import path from 'node:path';
import type { ChatMessage } from '../../shared/types/llm.js';

export interface GeneratedArtifactFile {
  path: string;
  content: string;
  language?: string;
  description?: string;
}

export interface ArtifactBundle {
  summary: string;
  files: GeneratedArtifactFile[];
  runInstructions: string[];
  notes?: string;
}

const ARTIFACT_KEYWORDS = [
  'напиши код',
  'создай код',
  'сделай сайт',
  'landing',
  'лендинг',
  'index.html',
  'react',
  'next.js',
  'node.js',
  'python script',
  'создай файл',
  'write code',
  'generate code',
  'create file',
  '.html',
  '.css',
  '.js',
  '.ts',
  '.tsx',
  '.py',
  '.go',
  '.java',
  '.md',
];

export const isArtifactRequest = (text: string): boolean => {
  const normalized = text.toLowerCase();
  return ARTIFACT_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

export const buildArtifactInstruction = (): ChatMessage => ({
  role: 'system',
  content: [
    'You are a software delivery assistant.',
    'Return ONLY valid JSON with this schema:',
    '{',
    '  "summary": "short summary in Russian",',
    '  "files": [',
    '    {',
    '      "path": "relative/path.ext",',
    '      "content": "full file content",',
    '      "language": "optional",',
    '      "description": "optional"',
    '    }',
    '  ],',
    '  "runInstructions": ["step 1", "step 2"],',
    '  "notes": "optional"',
    '}',
    'Rules:',
    '- Always provide full file contents, no placeholders.',
    '- Include all required files for the request.',
    '- Use index.html when user asks for a simple landing page unless user requested another file name.',
    '- Output only text-based files.',
    '- Never output binary files (jpg, jpeg, png, webp, gif, pdf, zip, exe).',
    '- If an image is needed, generate an SVG file (for example assets/pizza.svg) or use a remote image URL in HTML.',
    '- Do not add disclaimers about model limitations. Return useful project files directly.',
    '- Do not wrap JSON in markdown if possible.',
  ].join('\n'),
});

const tryParseJson = (value: string): unknown | null => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const extractJsonCandidate = (raw: string): string | null => {
  const direct = tryParseJson(raw);
  if (direct) {
    return raw;
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const candidate = fenced[1].trim();
    if (tryParseJson(candidate)) {
      return candidate;
    }
  }

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = raw.slice(firstBrace, lastBrace + 1);
    if (tryParseJson(candidate)) {
      return candidate;
    }
  }

  return null;
};

const clampString = (value: unknown, fallback = ''): string => {
  if (typeof value !== 'string') {
    return fallback;
  }
  return value;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
};

const normalizeFiles = (value: unknown): GeneratedArtifactFile[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): GeneratedArtifactFile | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as Record<string, unknown>;
      const filePath = clampString(record.path).trim();
      const content = clampString(record.content);

      if (!filePath || !content) {
        return null;
      }

      const binaryExt = new Set([
        '.jpg',
        '.jpeg',
        '.png',
        '.webp',
        '.gif',
        '.bmp',
        '.ico',
        '.pdf',
        '.zip',
        '.exe',
      ]);

      const ext = path.extname(filePath.toLowerCase());
      const isBinaryLike = binaryExt.has(ext);
      const normalizedPath = isBinaryLike
        ? `${filePath.replace(/\.[^.]+$/, '') || 'generated-file'}.txt`
        : filePath;

      return {
        path: normalizedPath,
        content,
        language: clampString(record.language).trim() || undefined,
        description: (
          clampString(record.description).trim() ||
          (isBinaryLike ? `Converted from binary-like file extension ${ext} to text output.` : '')
        ) || undefined,
      };
    })
    .filter((item): item is GeneratedArtifactFile => Boolean(item));
};

export const extractArtifactBundle = (raw: string): ArtifactBundle | null => {
  const jsonCandidate = extractJsonCandidate(raw);
  if (!jsonCandidate) {
    return null;
  }

  const parsed = tryParseJson(jsonCandidate);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const root = parsed as Record<string, unknown>;
  const files = normalizeFiles(root.files);
  if (files.length === 0) {
    return null;
  }

  return {
    summary: clampString(root.summary, 'Готово. Файлы созданы.').trim() || 'Готово. Файлы созданы.',
    files,
    runInstructions: normalizeStringArray(root.runInstructions),
    notes: clampString(root.notes).trim() || undefined,
  };
};
