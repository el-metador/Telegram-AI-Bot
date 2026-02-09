import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ArtifactBundle, GeneratedArtifactFile } from '../../application/services/artifact-mode.js';

export interface WrittenArtifactFile {
  relativePath: string;
  absolutePath: string;
  content: string;
}

export interface WrittenArtifactBundle {
  baseDir: string;
  files: WrittenArtifactFile[];
}

const sanitizeRelativePath = (unsafePath: string): string => {
  const normalized = path.posix.normalize(unsafePath.replace(/\\/g, '/')).replace(/^\/+/, '');
  const segments = normalized.split('/').filter(Boolean);
  const safeSegments = segments.filter((segment) => segment !== '.' && segment !== '..');

  if (safeSegments.length === 0) {
    return 'generated-file.txt';
  }

  return safeSegments.join('/');
};

export class ArtifactWriter {
  private readonly rootDir: string;

  constructor(rootDir = path.resolve(process.cwd(), 'generated')) {
    this.rootDir = rootDir;
  }

  writeBundle(userId: string, bundle: ArtifactBundle): WrittenArtifactBundle {
    const userDir = path.join(this.rootDir, userId);
    mkdirSync(userDir, { recursive: true });

    const files = bundle.files.map((file) => this.writeOne(userDir, file));

    return {
      baseDir: userDir,
      files,
    };
  }

  writeLargeText(userId: string, filename: string, content: string): string {
    const userDir = path.join(this.rootDir, userId, 'responses');
    mkdirSync(userDir, { recursive: true });

    const safeName = sanitizeRelativePath(filename).replace(/\//g, '_');
    const absolutePath = path.join(userDir, safeName);
    writeFileSync(absolutePath, content, 'utf8');
    return absolutePath;
  }

  private writeOne(baseDir: string, file: GeneratedArtifactFile): WrittenArtifactFile {
    const safeRelativePath = sanitizeRelativePath(file.path);
    const absolutePath = path.join(baseDir, safeRelativePath);

    if (!absolutePath.startsWith(baseDir)) {
      throw new Error('Invalid output path detected');
    }

    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, file.content, 'utf8');

    return {
      relativePath: safeRelativePath,
      absolutePath,
      content: file.content,
    };
  }
}
