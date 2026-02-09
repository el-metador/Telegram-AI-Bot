import type { ChatProvider, PowerTier } from '../../../shared/types/llm.js';
import type { ModelCard, ModelMetric, ProviderFilter } from '../../../shared/types/models.js';

export type PickerPower = PowerTier | 'any';

const providerLabel = (provider: ChatProvider): string =>
  provider === 'openrouter' ? 'OpenRouter' : 'Groq';

export const metricLabel = (metric: ModelMetric): string => {
  switch (metric) {
    case 'coding':
      return 'Кодинг';
    case 'reasoning':
      return 'Интеллект';
    case 'multilingual':
      return 'Мультиязычность';
    case 'speed':
      return 'Скорость';
    case 'safety':
      return 'Безопасность';
    case 'balanced':
      return 'Баланс';
    default:
      return metric;
  }
};

const providerFilterLabel = (provider: ProviderFilter): string => {
  if (provider === 'all') {
    return 'Все провайдеры';
  }
  return providerLabel(provider);
};

const powerLabel = (power: PickerPower): string => (power === 'any' ? 'Любая' : power);

const roundedScore = (value: number): string => (Math.round(value * 10) / 10).toFixed(1);

export const providerKeyboard = {
  inline_keyboard: [
    [
      { text: 'OpenRouter', callback_data: 'provider:openrouter' },
      { text: 'Groq', callback_data: 'provider:groq' },
    ],
    [
      { text: '🗂 Все ИИ', callback_data: 'model:all' },
      { text: '🎯 Smart Picker', callback_data: 'pick:open' },
    ],
  ],
};

export const powerKeyboard = {
  inline_keyboard: [
    [
      { text: 'Low', callback_data: 'power:Low' },
      { text: 'Medium', callback_data: 'power:Medium' },
    ],
    [
      { text: 'High', callback_data: 'power:High' },
      { text: 'eHigh', callback_data: 'power:eHigh' },
    ],
  ],
};

export const systemPromptKeyboard = {
  inline_keyboard: [
    [
      { text: 'Set Prompt', callback_data: 'prompt:set' },
      { text: 'View Prompt', callback_data: 'prompt:view' },
    ],
    [{ text: 'Reset Prompt', callback_data: 'prompt:reset' }],
  ],
};

export const aiMetricKeyboard = {
  inline_keyboard: [
    [
      { text: '💻 Кодинг', callback_data: 'pick:metric:coding' },
      { text: '🧠 Интеллект', callback_data: 'pick:metric:reasoning' },
    ],
    [
      { text: '🌐 Языки', callback_data: 'pick:metric:multilingual' },
      { text: '⚡ Скорость', callback_data: 'pick:metric:speed' },
    ],
    [
      { text: '🛡️ Безопасность', callback_data: 'pick:metric:safety' },
      { text: '🎯 Баланс', callback_data: 'pick:metric:balanced' },
    ],
  ],
};

export function aiProviderKeyboard(metric: ModelMetric) {
  return {
    inline_keyboard: [
      [
        { text: 'Все', callback_data: `pick:provider:${metric}:all` },
        { text: 'OpenRouter', callback_data: `pick:provider:${metric}:openrouter` },
        { text: 'Groq', callback_data: `pick:provider:${metric}:groq` },
      ],
      [{ text: '⬅️ Метрика', callback_data: 'pick:open' }],
    ],
  };
}

export function aiPowerKeyboard(metric: ModelMetric, provider: ProviderFilter) {
  return {
    inline_keyboard: [
      [
        { text: 'Any', callback_data: `pick:power:${metric}:${provider}:any` },
        { text: 'Low', callback_data: `pick:power:${metric}:${provider}:Low` },
      ],
      [
        { text: 'Medium', callback_data: `pick:power:${metric}:${provider}:Medium` },
        { text: 'High', callback_data: `pick:power:${metric}:${provider}:High` },
      ],
      [{ text: 'eHigh', callback_data: `pick:power:${metric}:${provider}:eHigh` }],
      [{ text: '⬅️ Провайдер', callback_data: `pick:provider-back:${metric}` }],
    ],
  };
}

export function modelsListKeyboard(options: {
  provider: ChatProvider;
  page: number;
  pageSize: number;
  totalModels: number;
  models: ModelCard[];
  selectedModelId?: string;
}) {
  const { provider, page, pageSize, totalModels, models, selectedModelId } = options;

  const rows = models.map((model, index) => [
    {
      text: `${model.modelId === selectedModelId ? '✅ ' : ''}${model.title}`,
      callback_data: `m:info:${provider}:${page}:${index}`,
    },
    { text: `⭐ ${roundedScore((model.stars.coding + model.stars.reasoning) / 2)}`, callback_data: 'noop' },
  ]);

  const maxPage = Math.max(0, Math.ceil(totalModels / pageSize) - 1);
  if (maxPage > 0) {
    rows.push([
      { text: '◀️ Prev', callback_data: `model:page:${provider}:${Math.max(0, page - 1)}` },
      { text: `${page + 1}/${maxPage + 1}`, callback_data: 'noop' },
      { text: 'Next ▶️', callback_data: `model:page:${provider}:${Math.min(maxPage, page + 1)}` },
    ]);
  }

  rows.push([{ text: 'Back to providers', callback_data: 'model:providers' }]);
  return { inline_keyboard: rows };
}

export function modelDetailsKeyboard(provider: ChatProvider, page: number, index: number) {
  return {
    inline_keyboard: [
      [{ text: '✅ Select this model', callback_data: `m:select:${provider}:${page}:${index}` }],
      [{ text: '⬅️ Back to list', callback_data: `model:page:${provider}:${page}` }],
    ],
  };
}

export function allModelsListKeyboard(options: {
  page: number;
  pageSize: number;
  totalModels: number;
  models: ModelCard[];
  selectedModelId?: string;
}) {
  const { page, pageSize, totalModels, models, selectedModelId } = options;

  const rows = models.map((model, index) => [
    {
      text: `${model.modelId === selectedModelId ? '✅ ' : ''}${model.title}`,
      callback_data: `mall:info:${page}:${index}`,
    },
    {
      text: `${providerLabel(model.provider)} • ${model.powerTier}`,
      callback_data: 'noop',
    },
  ]);

  const maxPage = Math.max(0, Math.ceil(totalModels / pageSize) - 1);
  if (maxPage > 0) {
    rows.push([
      { text: '◀️ Prev', callback_data: `model:all:page:${Math.max(0, page - 1)}` },
      { text: `${page + 1}/${maxPage + 1}`, callback_data: 'noop' },
      { text: 'Next ▶️', callback_data: `model:all:page:${Math.min(maxPage, page + 1)}` },
    ]);
  }

  rows.push([{ text: '⬅️ Back to providers', callback_data: 'model:providers' }]);
  return { inline_keyboard: rows };
}

export function allModelDetailsKeyboard(page: number, index: number) {
  return {
    inline_keyboard: [
      [{ text: '✅ Select this model', callback_data: `mall:select:${page}:${index}` }],
      [{ text: '⬅️ Back to all models', callback_data: `model:all:page:${page}` }],
    ],
  };
}

export function pickerResultsKeyboard(options: {
  metric: ModelMetric;
  provider: ProviderFilter;
  power: PickerPower;
  page: number;
  pageSize: number;
  totalModels: number;
  models: ModelCard[];
  selectedModelId?: string;
}) {
  const { metric, provider, power, page, pageSize, totalModels, models, selectedModelId } = options;

  const rows = models.map((model, index) => [
    {
      text: `${model.modelId === selectedModelId ? '✅ ' : ''}${model.title}`,
      callback_data: `pick:info:${metric}:${provider}:${power}:${page}:${index}`,
    },
    {
      text: `⚙️ ${providerLabel(model.provider)} • ${model.powerTier}`,
      callback_data: 'noop',
    },
  ]);

  const maxPage = Math.max(0, Math.ceil(totalModels / pageSize) - 1);
  if (maxPage > 0) {
    rows.push([
      {
        text: '◀️ Prev',
        callback_data: `pick:page:${metric}:${provider}:${power}:${Math.max(0, page - 1)}`,
      },
      { text: `${page + 1}/${maxPage + 1}`, callback_data: 'noop' },
      {
        text: 'Next ▶️',
        callback_data: `pick:page:${metric}:${provider}:${power}:${Math.min(maxPage, page + 1)}`,
      },
    ]);
  }

  rows.push([{ text: '⬅️ Power filter', callback_data: `pick:provider:${metric}:${provider}` }]);
  return { inline_keyboard: rows };
}

export function pickerModelDetailsKeyboard(
  metric: ModelMetric,
  provider: ProviderFilter,
  power: PickerPower,
  page: number,
  index: number,
) {
  return {
    inline_keyboard: [
      [{ text: '✅ Select this model', callback_data: `pick:select:${metric}:${provider}:${power}:${page}:${index}` }],
      [{ text: '⬅️ Back to top list', callback_data: `pick:page:${metric}:${provider}:${power}:${page}` }],
    ],
  };
}

export function modelListHeader(provider: ChatProvider, powerTier: PowerTier): string {
  return [`📚 Model Browser`, `Provider: ${providerLabel(provider)}`, `Power filter: ${powerTier}`].join('\n');
}

export function pickerHeader(metric: ModelMetric, provider: ProviderFilter, power: PickerPower): string {
  return [
    '🎯 Smart AI Picker',
    `Goal: ${metricLabel(metric)}`,
    `Provider: ${providerFilterLabel(provider)}`,
    `Power: ${powerLabel(power)}`,
  ].join('\n');
}

export function allModelsHeader(total: number): string {
  return ['🗂 Все ИИ на боте', `Всего моделей: ${total}`, 'Выберите модель:'].join('\n');
}
