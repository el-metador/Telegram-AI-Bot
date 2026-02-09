import path from 'node:path';
import { Bot, InputFile } from 'grammy';
import type { ChatProvider, ChatMessage, PowerTier } from '../../shared/types/llm.js';
import type { ModelCard, ModelMetric, ProviderFilter } from '../../shared/types/models.js';
import { renderModelCard } from '../../domain/services/model-card.renderer.js';
import { SelectModelUseCase } from '../../application/usecases/select-model.usecase.js';
import { SelectPowerUseCase } from '../../application/usecases/select-power.usecase.js';
import { SetSystemPromptUseCase } from '../../application/usecases/set-system-prompt.usecase.js';
import type { UserSettingsGateway } from '../../application/ports/user-settings.gateway.js';
import {
  buildArtifactInstruction,
  extractArtifactBundle,
  isArtifactRequest,
} from '../../application/services/artifact-mode.js';
import { ProviderRouter } from '../../infrastructure/providers/provider.router.js';
import { ArtifactWriter } from '../../infrastructure/files/artifact-writer.js';
import { InMemoryChatHistoryStore } from '../../infrastructure/store/in-memory-chat-history.store.js';
import { ModelCatalogService } from '../../infrastructure/config/model-catalog.loader.js';
import { mainMenuKeyboard } from './keyboards/main.keyboard.js';
import {
  allModelDetailsKeyboard,
  allModelsHeader,
  allModelsListKeyboard,
  aiMetricKeyboard,
  aiPowerKeyboard,
  aiProviderKeyboard,
  metricLabel,
  modelDetailsKeyboard,
  modelListHeader,
  modelsListKeyboard,
  pickerHeader,
  pickerModelDetailsKeyboard,
  pickerResultsKeyboard,
  powerKeyboard,
  providerKeyboard,
  systemPromptKeyboard,
  type PickerPower,
} from './keyboards/model.keyboards.js';
import { splitForTelegram } from './utils.js';

const PAGE_SIZE = 4;
const PICKER_PAGE_SIZE = 5;
const ALL_MODELS_PAGE_SIZE = 6;
const LARGE_REPLY_THRESHOLD = 12000;
const MAX_HISTORY_ASSISTANT_CHARS = 2000;

type BotDeps = {
  telegramToken: string;
  providerRouter: ProviderRouter;
  modelCatalog: ModelCatalogService;
  userSettingsStore: UserSettingsGateway;
  chatHistoryStore: InMemoryChatHistoryStore;
  artifactWriter: ArtifactWriter;
};

const isPowerTier = (value: string): value is PowerTier =>
  value === 'Low' || value === 'Medium' || value === 'High' || value === 'eHigh';

const isProvider = (value: string): value is ChatProvider => value === 'openrouter' || value === 'groq';

const isProviderFilter = (value: string): value is ProviderFilter => value === 'all' || isProvider(value);

const isPickerPower = (value: string): value is PickerPower => value === 'any' || isPowerTier(value);

const isModelMetric = (value: string): value is ModelMetric =>
  value === 'coding' ||
  value === 'reasoning' ||
  value === 'multilingual' ||
  value === 'speed' ||
  value === 'safety' ||
  value === 'balanced';

const getUserId = (ctx: { from?: { id: number }; chat?: { id: number } }): string =>
  String(ctx.from?.id ?? ctx.chat?.id ?? 0);

const getPagedModels = (
  modelCatalog: ModelCatalogService,
  provider: ChatProvider,
  powerTier: PowerTier,
  page: number,
) => {
  const preferred = modelCatalog.listModels(provider, powerTier);
  const all = preferred.length > 0 ? preferred : modelCatalog.listModels(provider);
  const maxPage = Math.max(0, Math.ceil(all.length / PAGE_SIZE) - 1);
  const safePage = Math.max(0, Math.min(maxPage, page));
  const pageModels = all.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return {
    pageModels,
    allModels: all,
    safePage,
  };
};

const getAllPagedModels = (modelCatalog: ModelCatalogService, page: number) => {
  const all = modelCatalog.listAllModels();
  const maxPage = Math.max(0, Math.ceil(all.length / ALL_MODELS_PAGE_SIZE) - 1);
  const safePage = Math.max(0, Math.min(maxPage, page));
  const pageModels = all.slice(
    safePage * ALL_MODELS_PAGE_SIZE,
    safePage * ALL_MODELS_PAGE_SIZE + ALL_MODELS_PAGE_SIZE,
  );

  return {
    pageModels,
    allModels: all,
    safePage,
  };
};

const getPickerModels = (
  modelCatalog: ModelCatalogService,
  metric: ModelMetric,
  provider: ProviderFilter,
  power: PickerPower,
  page: number,
) => {
  const requestedPower = power === 'any' ? undefined : power;

  let ranked = modelCatalog.rankModels({
    metric,
    provider,
    powerTier: requestedPower,
    limit: 200,
  });

  let fallbackToAnyPower = false;
  if (ranked.length === 0 && requestedPower) {
    ranked = modelCatalog.rankModels({
      metric,
      provider,
      limit: 200,
    });
    fallbackToAnyPower = true;
  }

  const maxPage = Math.max(0, Math.ceil(ranked.length / PICKER_PAGE_SIZE) - 1);
  const safePage = Math.max(0, Math.min(maxPage, page));
  const pageModels = ranked.slice(safePage * PICKER_PAGE_SIZE, safePage * PICKER_PAGE_SIZE + PICKER_PAGE_SIZE);

  return {
    pageModels,
    allModels: ranked,
    safePage,
    fallbackToAnyPower,
  };
};

const findModelFromCallback = (
  modelCatalog: ModelCatalogService,
  provider: ChatProvider,
  powerTier: PowerTier,
  page: number,
  index: number,
): ModelCard | null => {
  const { pageModels } = getPagedModels(modelCatalog, provider, powerTier, page);
  return pageModels[index] ?? null;
};

const findPickerModelFromCallback = (
  modelCatalog: ModelCatalogService,
  metric: ModelMetric,
  provider: ProviderFilter,
  power: PickerPower,
  page: number,
  index: number,
): ModelCard | null => {
  const { pageModels } = getPickerModels(modelCatalog, metric, provider, power, page);
  return pageModels[index] ?? null;
};

const findAllModelFromCallback = (
  modelCatalog: ModelCatalogService,
  page: number,
  index: number,
): ModelCard | null => {
  const { pageModels } = getAllPagedModels(modelCatalog, page);
  return pageModels[index] ?? null;
};

export const createTelegramBot = (deps: BotDeps): Bot => {
  const bot = new Bot(deps.telegramToken);

  const selectModelUseCase = new SelectModelUseCase(deps.userSettingsStore);
  const selectPowerUseCase = new SelectPowerUseCase(deps.userSettingsStore);
  const setSystemPromptUseCase = new SetSystemPromptUseCase(deps.userSettingsStore);

  const clipForHistory = (text: string): string =>
    text.length <= MAX_HISTORY_ASSISTANT_CHARS
      ? text
      : `${text.slice(0, MAX_HISTORY_ASSISTANT_CHARS)}\n...[truncated]`;

  const sendChunkedReply = async (ctx: { reply: (text: string) => Promise<unknown> }, text: string) => {
    const chunks = splitForTelegram(text);
    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }
  };

  const sendLargeTextReply = async (
    ctx: {
      chat: { id: number };
      api: { sendDocument: (chatId: number, file: InputFile, extra?: { caption?: string }) => Promise<unknown> };
      reply: (text: string) => Promise<unknown>;
    },
    userId: string,
    title: string,
    text: string,
  ) => {
    if (text.length <= LARGE_REPLY_THRESHOLD) {
      await sendChunkedReply(ctx, text);
      return;
    }

    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const filename = `${title}-${timestamp}.txt`;
    const savedPath = deps.artifactWriter.writeLargeText(userId, filename, text);

    const preview = text.slice(0, 3500);
    await ctx.reply(
      `Ответ большой, отправляю файлом.\nФайл: ${filename}\nПуть: ${savedPath}\n\nПревью:\n${preview}`,
    );

    await ctx.api.sendDocument(
      ctx.chat.id,
      new InputFile(Buffer.from(text, 'utf8'), filename),
      { caption: `Полный ответ: ${filename}` },
    );
  };

  const formatRunInstructions = (steps: string[]): string => {
    if (steps.length === 0) {
      return 'Инструкции запуска: не указаны.';
    }

    return ['Инструкции запуска:', ...steps.map((step, index) => `${index + 1}. ${step}`)].join('\n');
  };

  const shouldRetryWithoutSystem = (error: unknown): boolean => {
    const details = error instanceof Error ? error.message : String(error);
    const normalized = details.toLowerCase();

    return (
      normalized.includes('developer instruction is not enabled') ||
      normalized.includes('system instruction is not enabled') ||
      normalized.includes('role') && normalized.includes('system')
    );
  };

  const convertSystemMessagesToUser = (messages: ChatMessage[]): ChatMessage[] => {
    const systemMessages = messages.filter((msg) => msg.role === 'system').map((msg) => msg.content.trim()).filter(Boolean);
    if (systemMessages.length === 0) {
      return messages;
    }

    const nonSystem = messages.filter((msg) => msg.role !== 'system');
    const systemBlock =
      `IMPORTANT INSTRUCTIONS (from system prompt):\n${systemMessages.join('\n\n')}\n\n` +
      'Follow them as high-priority constraints.';

    if (nonSystem.length === 0) {
      return [{ role: 'user', content: systemBlock }];
    }

    const [first, ...rest] = nonSystem;
    if (first.role === 'user') {
      return [{ ...first, content: `${systemBlock}\n\n${first.content}` }, ...rest];
    }

    return [{ role: 'user', content: systemBlock }, ...nonSystem];
  };

  const safeProviderChat = async (params: {
    provider: ChatProvider;
    model: string;
    messages: ChatMessage[];
  }) => {
    const adapter = deps.providerRouter.get(params.provider);

    try {
      return await adapter.chat(params);
    } catch (error) {
      if (!shouldRetryWithoutSystem(error) || !params.messages.some((msg) => msg.role === 'system')) {
        throw error;
      }

      const retriedMessages = convertSystemMessagesToUser(params.messages);
      return adapter.chat({
        provider: params.provider,
        model: params.model,
        messages: retriedMessages,
      });
    }
  };

  const resolveActiveModel = async (userId: string) => {
    const settings = await deps.userSettingsStore.getByUserId(userId);
    let provider = settings.selectedProvider;
    let model = settings.selectedModel;

    if (!deps.modelCatalog.isModelExists(provider, model)) {
      const fallback = deps.modelCatalog.findDefaultModel(provider, settings.selectedPowerTier);
      if (!fallback) {
        throw new Error('Нет доступной модели. Проверьте каталог моделей.');
      }
      provider = fallback.provider;
      model = fallback.modelId;
      await selectModelUseCase.execute(userId, provider, model);
    }

    return {
      settings,
      provider,
      model,
    };
  };

  const handleBuildRequest = async (
    ctx: {
      chat: { id: number };
      api: {
        sendChatAction: (chatId: number, action: 'typing') => Promise<unknown>;
        deleteMessage: (chatId: number, messageId: number) => Promise<unknown>;
        sendDocument: (
          chatId: number,
          file: InputFile,
          extra?: { caption?: string },
        ) => Promise<unknown>;
      };
      reply: (text: string) => Promise<{ message_id: number }>;
    },
    userId: string,
    requestText: string,
  ) => {
    const progressMessage = await ctx.reply('Генерация вашего кода, ожидайте...*');

    const clearProgress = async () => {
      try {
        await ctx.api.deleteMessage(ctx.chat.id, progressMessage.message_id);
      } catch {
        // Message may already be deleted or too old to delete.
      }
    };

    try {
      const { settings, provider, model } = await resolveActiveModel(userId);
      const history = deps.chatHistoryStore.get(userId);
      const messages: ChatMessage[] = [];
      if (settings.systemPrompt) {
        messages.push({ role: 'system', content: settings.systemPrompt });
      }
      messages.push(...history);
      messages.push({ role: 'user', content: requestText });

      await ctx.api.sendChatAction(ctx.chat.id, 'typing');

      const buildInstructionText = buildArtifactInstruction().content;
      const userTask = messages[messages.length - 1]?.content ?? requestText;
      const artifactMessages: ChatMessage[] = [
        ...messages.slice(0, -1),
        {
          role: 'user',
          content: `${buildInstructionText}\n\nUSER TASK:\n${userTask}`,
        },
      ];
      const artifactCompletion = await safeProviderChat({
        provider,
        model,
        messages: artifactMessages,
      });

      const bundle = extractArtifactBundle(artifactCompletion.content);
      if (bundle) {
        const written = deps.artifactWriter.writeBundle(userId, bundle);
        deps.chatHistoryStore.add(userId, { role: 'user', content: requestText });
        deps.chatHistoryStore.add(userId, { role: 'assistant', content: clipForHistory(bundle.summary) });

        await ctx.reply(
          [
            '✅ Готово. Файлы созданы.',
            `Папка: ${written.baseDir}`,
            `Файлов: ${written.files.length}`,
            `Кратко: ${bundle.summary}`,
            'Для следующей генерации кода используйте /build.',
          ].join('\n'),
        );

        for (const file of written.files) {
          const filename = path.basename(file.relativePath);
          try {
            await ctx.api.sendDocument(
              ctx.chat.id,
              new InputFile(Buffer.from(file.content, 'utf8'), filename),
              { caption: `Файл: ${file.relativePath}` },
            );
          } catch (error) {
            const details = error instanceof Error ? error.message : String(error);
            await ctx.reply(`Не удалось отправить файл документом (${filename}): ${details}`);
          }
        }

        await sendChunkedReply(ctx, formatRunInstructions(bundle.runInstructions));
        if (bundle.notes) {
          await sendChunkedReply(ctx, `Примечания:\n${bundle.notes}`);
        }
        return;
      }

      await ctx.reply(
        'Не удалось получить структурированные файлы в одном ответе. Отправляю обычный ответ модели.',
      );
      deps.chatHistoryStore.add(userId, { role: 'user', content: requestText });
      deps.chatHistoryStore.add(userId, {
        role: 'assistant',
        content: clipForHistory(artifactCompletion.content),
      });
      await sendLargeTextReply(ctx, userId, 'build-response', artifactCompletion.content);
    } finally {
      await clearProgress();
    }
  };

  const safeEdit = async (
    ctx: { editMessageText: (text: string, extra?: Record<string, unknown>) => Promise<unknown>; reply: (text: string, extra?: Record<string, unknown>) => Promise<unknown> },
    text: string,
    replyMarkup: Record<string, unknown>,
  ) => {
    try {
      await ctx.editMessageText(text, { reply_markup: replyMarkup });
    } catch {
      await ctx.reply(text, { reply_markup: replyMarkup });
    }
  };

  const showMainMenu = async (chatId: number, userId: string) => {
    const settings = await deps.userSettingsStore.getByUserId(userId);
    const card = deps.modelCatalog.getModelCard(settings.selectedProvider, settings.selectedModel);
    const activeModel = card ? `${card.title} (${settings.selectedPowerTier})` : settings.selectedModel;

    await bot.api.sendMessage(
      chatId,
      [
        '🚀 Управление ботом',
        `Текущий ИИ: ${activeModel}`,
        'Выберите режим ниже или отправьте сообщение для прямого ответа ИИ.',
        'Для генерации кода и файлов используйте /build.',
      ].join('\n'),
      {
        reply_markup: mainMenuKeyboard,
      },
    );
  };

  const showProviderPicker = async (chatId: number) => {
    await bot.api.sendMessage(
      chatId,
      '🤖 Model Browser\nВыберите провайдера, откройте список "Все ИИ" или Smart Picker:',
      {
        reply_markup: providerKeyboard,
      },
    );
  };

  const showPowerPicker = async (chatId: number) => {
    await bot.api.sendMessage(chatId, '⚡ Выберите мощность ИИ:', {
      reply_markup: powerKeyboard,
    });
  };

  const showPromptMenu = async (chatId: number) => {
    await bot.api.sendMessage(chatId, '🧠 Управление системным промптом:', {
      reply_markup: systemPromptKeyboard,
    });
  };

  const showSmartPicker = async (chatId: number) => {
    await bot.api.sendMessage(
      chatId,
      '🎯 Smart AI Picker\nШаг 1/3: выберите ключевую цель, чтобы получить топ подходящих моделей.',
      {
        reply_markup: aiMetricKeyboard,
      },
    );
  };

  bot.command('start', async (ctx) => {
    await showMainMenu(ctx.chat.id, getUserId(ctx));
  });

  bot.command('menu', async (ctx) => {
    await showMainMenu(ctx.chat.id, getUserId(ctx));
  });

  bot.command('model', async (ctx) => {
    await showProviderPicker(ctx.chat.id);
  });

  bot.command('models', async (ctx) => {
    const userId = getUserId(ctx);
    const settings = await deps.userSettingsStore.getByUserId(userId);
    const { pageModels, allModels, safePage } = getAllPagedModels(deps.modelCatalog, 0);

    if (allModels.length === 0) {
      await ctx.reply('Список моделей пуст.');
      return;
    }

    await ctx.reply(allModelsHeader(allModels.length), {
      reply_markup: allModelsListKeyboard({
        page: safePage,
        pageSize: ALL_MODELS_PAGE_SIZE,
        totalModels: allModels.length,
        models: pageModels,
        selectedModelId: settings.selectedModel,
      }),
    });
  });

  bot.command('power', async (ctx) => {
    await showPowerPicker(ctx.chat.id);
  });

  bot.command('ai', async (ctx) => {
    await showSmartPicker(ctx.chat.id);
  });

  bot.command('prompt', async (ctx) => {
    await showPromptMenu(ctx.chat.id);
  });

  bot.command('build', async (ctx) => {
    const userId = getUserId(ctx);
    const buildTask = typeof ctx.match === 'string' ? ctx.match.trim() : '';

    if (!buildTask) {
      await deps.userSettingsStore.setPendingInput(userId, 'build_request');
      await ctx.reply(
        [
          'Режим генерации кода активирован.',
          'Отправьте следующим сообщением задачу для кода.',
          'Пример: Сделай лендинг пиццерии в index.html',
          'Или сразу используйте: /build Сделай лендинг пиццерии в index.html',
        ].join('\n'),
      );
      return;
    }

    await deps.userSettingsStore.setPendingInput(userId, null);
    try {
      await handleBuildRequest(ctx, userId, buildTask);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      await ctx.reply(`Ошибка /build: ${details}`);
    }
  });

  bot.command('clear', async (ctx) => {
    const userId = getUserId(ctx);
    deps.chatHistoryStore.clear(userId);
    await ctx.reply('История чата очищена.');
  });

  bot.command('settings', async (ctx) => {
    const userId = getUserId(ctx);
    const settings = await deps.userSettingsStore.getByUserId(userId);
    await ctx.reply(
      [
        '⚙️ Текущие настройки:',
        `Provider: ${settings.selectedProvider}`,
        `Model: ${settings.selectedModel}`,
        `Power: ${settings.selectedPowerTier}`,
        `System prompt: ${settings.systemPrompt ? 'set' : 'not set'}`,
      ].join('\n'),
    );
  });

  bot.hears('🤖 Model Browser', async (ctx) => {
    await showProviderPicker(ctx.chat.id);
  });

  bot.hears('🤖 Model', async (ctx) => {
    await showProviderPicker(ctx.chat.id);
  });

  bot.hears('🧭 AI Picker', async (ctx) => {
    await showSmartPicker(ctx.chat.id);
  });

  bot.hears('🏗 Build Code', async (ctx) => {
    const userId = getUserId(ctx);
    await deps.userSettingsStore.setPendingInput(userId, 'build_request');
    await ctx.reply(
      [
        'Режим генерации кода активирован.',
        'Отправьте задачу следующим сообщением или используйте /build <задача>.',
      ].join('\n'),
    );
  });

  bot.hears('⚡ Power', async (ctx) => {
    await showPowerPicker(ctx.chat.id);
  });

  bot.hears('🧠 System Prompt', async (ctx) => {
    await showPromptMenu(ctx.chat.id);
  });

  bot.hears('⚙️ Settings', async (ctx) => {
    const userId = getUserId(ctx);
    const settings = await deps.userSettingsStore.getByUserId(userId);
    await ctx.reply(
      `Provider: ${settings.selectedProvider}\nModel: ${settings.selectedModel}\nPower: ${settings.selectedPowerTier}`,
    );
  });

  bot.hears('📊 Model Info', async (ctx) => {
    const userId = getUserId(ctx);
    const settings = await deps.userSettingsStore.getByUserId(userId);
    const card = deps.modelCatalog.getModelCard(settings.selectedProvider, settings.selectedModel);

    if (!card) {
      await ctx.reply('Карточка текущей модели не найдена. Выберите модель заново.');
      return;
    }

    await ctx.reply(renderModelCard(card));
  });

  bot.callbackQuery('pick:open', async (ctx) => {
    await ctx.answerCallbackQuery();
    await safeEdit(
      ctx,
      '🎯 Smart AI Picker\nШаг 1/3: выберите ключевую цель, чтобы получить топ подходящих моделей.',
      aiMetricKeyboard,
    );
  });

  bot.callbackQuery(/^pick:metric:([^:]+)$/, async (ctx) => {
    const metric = ctx.match[1];
    if (!isModelMetric(metric)) {
      await ctx.answerCallbackQuery({ text: 'Unknown metric', show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery();
    await safeEdit(
      ctx,
      `🎯 Smart AI Picker\nШаг 2/3: выберите провайдера\nGoal: ${metricLabel(metric)}`,
      aiProviderKeyboard(metric),
    );
  });

  bot.callbackQuery(/^pick:provider-back:([^:]+)$/, async (ctx) => {
    const metric = ctx.match[1];
    if (!isModelMetric(metric)) {
      await ctx.answerCallbackQuery({ text: 'Unknown metric', show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery();
    await safeEdit(
      ctx,
      `🎯 Smart AI Picker\nШаг 2/3: выберите провайдера\nGoal: ${metricLabel(metric)}`,
      aiProviderKeyboard(metric),
    );
  });

  bot.callbackQuery(/^pick:provider:([^:]+):([^:]+)$/, async (ctx) => {
    const metric = ctx.match[1];
    const providerFilter = ctx.match[2];

    if (!isModelMetric(metric) || !isProviderFilter(providerFilter)) {
      await ctx.answerCallbackQuery({ text: 'Invalid picker state', show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery();
    await safeEdit(
      ctx,
      `🎯 Smart AI Picker\nШаг 3/3: выберите мощность\nGoal: ${metricLabel(metric)}`,
      aiPowerKeyboard(metric, providerFilter),
    );
  });

  bot.callbackQuery(/^pick:power:([^:]+):([^:]+):([^:]+)$/, async (ctx) => {
    const metric = ctx.match[1];
    const providerFilter = ctx.match[2];
    const power = ctx.match[3];

    if (!isModelMetric(metric) || !isProviderFilter(providerFilter) || !isPickerPower(power)) {
      await ctx.answerCallbackQuery({ text: 'Invalid picker state', show_alert: true });
      return;
    }

    const userId = getUserId(ctx);
    const settings = await deps.userSettingsStore.getByUserId(userId);
    const { pageModels, allModels, safePage, fallbackToAnyPower } = getPickerModels(
      deps.modelCatalog,
      metric,
      providerFilter,
      power,
      0,
    );

    if (allModels.length === 0) {
      await ctx.answerCallbackQuery({ text: 'No models for this filter', show_alert: true });
      return;
    }

    const headerLines = [pickerHeader(metric, providerFilter, power)];
    if (fallbackToAnyPower) {
      headerLines.push('Нет моделей в этом power-tier, показан общий топ.');
    }

    await ctx.answerCallbackQuery();
    await safeEdit(ctx, headerLines.join('\n\n'), {
      ...pickerResultsKeyboard({
        metric,
        provider: providerFilter,
        power,
        page: safePage,
        pageSize: PICKER_PAGE_SIZE,
        totalModels: allModels.length,
        models: pageModels,
        selectedModelId: settings.selectedModel,
      }),
    });
  });

  bot.callbackQuery(/^pick:page:([^:]+):([^:]+):([^:]+):(\d+)$/, async (ctx) => {
    const metric = ctx.match[1];
    const providerFilter = ctx.match[2];
    const power = ctx.match[3];
    const page = Number(ctx.match[4]);

    if (!isModelMetric(metric) || !isProviderFilter(providerFilter) || !isPickerPower(power)) {
      await ctx.answerCallbackQuery({ text: 'Invalid picker state', show_alert: true });
      return;
    }

    const userId = getUserId(ctx);
    const settings = await deps.userSettingsStore.getByUserId(userId);
    const { pageModels, allModels, safePage, fallbackToAnyPower } = getPickerModels(
      deps.modelCatalog,
      metric,
      providerFilter,
      power,
      page,
    );

    if (allModels.length === 0) {
      await ctx.answerCallbackQuery({ text: 'No models', show_alert: true });
      return;
    }

    const headerLines = [pickerHeader(metric, providerFilter, power)];
    if (fallbackToAnyPower) {
      headerLines.push('Нет моделей в этом power-tier, показан общий топ.');
    }

    await ctx.answerCallbackQuery();
    await safeEdit(ctx, headerLines.join('\n\n'), {
      ...pickerResultsKeyboard({
        metric,
        provider: providerFilter,
        power,
        page: safePage,
        pageSize: PICKER_PAGE_SIZE,
        totalModels: allModels.length,
        models: pageModels,
        selectedModelId: settings.selectedModel,
      }),
    });
  });

  bot.callbackQuery(/^pick:info:([^:]+):([^:]+):([^:]+):(\d+):(\d+)$/, async (ctx) => {
    const metric = ctx.match[1];
    const providerFilter = ctx.match[2];
    const power = ctx.match[3];
    const page = Number(ctx.match[4]);
    const index = Number(ctx.match[5]);

    if (
      !isModelMetric(metric) ||
      !isProviderFilter(providerFilter) ||
      !isPickerPower(power)
    ) {
      await ctx.answerCallbackQuery({ text: 'Invalid picker state', show_alert: true });
      return;
    }

    const model = findPickerModelFromCallback(
      deps.modelCatalog,
      metric,
      providerFilter,
      power,
      page,
      index,
    );

    if (!model) {
      await ctx.answerCallbackQuery({ text: 'Model not found', show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery();
    await ctx.reply(renderModelCard(model), {
      reply_markup: pickerModelDetailsKeyboard(metric, providerFilter, power, page, index),
    });
  });

  bot.callbackQuery(/^pick:select:([^:]+):([^:]+):([^:]+):(\d+):(\d+)$/, async (ctx) => {
    const metric = ctx.match[1];
    const providerFilter = ctx.match[2];
    const power = ctx.match[3];
    const page = Number(ctx.match[4]);
    const index = Number(ctx.match[5]);

    if (
      !isModelMetric(metric) ||
      !isProviderFilter(providerFilter) ||
      !isPickerPower(power)
    ) {
      await ctx.answerCallbackQuery({ text: 'Invalid picker state', show_alert: true });
      return;
    }

    const model = findPickerModelFromCallback(
      deps.modelCatalog,
      metric,
      providerFilter,
      power,
      page,
      index,
    );

    if (!model) {
      await ctx.answerCallbackQuery({ text: 'Model not found', show_alert: true });
      return;
    }

    const userId = getUserId(ctx);
    const targetPower = power === 'any' ? model.powerTier : power;

    await selectPowerUseCase.execute(userId, targetPower);
    await selectModelUseCase.execute(userId, model.provider, model.modelId);

    await ctx.answerCallbackQuery({ text: 'Model selected' });
    await ctx.reply(
      [
        '✅ Модель выбрана',
        `Provider: ${model.provider}`,
        `Model: ${model.title}`,
        `Power: ${targetPower}`,
      ].join('\n'),
    );
  });

  bot.callbackQuery(/^provider:(openrouter|groq)$/, async (ctx) => {
    const provider = ctx.match[1];
    if (!isProvider(provider)) {
      await ctx.answerCallbackQuery({ text: 'Unknown provider', show_alert: true });
      return;
    }

    const userId = getUserId(ctx);
    const settings = await deps.userSettingsStore.getByUserId(userId);

    let selectedModel = settings.selectedModel;
    if (!deps.modelCatalog.isModelExists(provider, settings.selectedModel)) {
      const fallback = deps.modelCatalog.findDefaultModel(provider, settings.selectedPowerTier);
      if (!fallback) {
        await ctx.answerCallbackQuery({ text: 'No models for provider', show_alert: true });
        return;
      }
      selectedModel = fallback.modelId;
    }

    await selectModelUseCase.execute(userId, provider, selectedModel);
    await ctx.answerCallbackQuery();

    const { pageModels, allModels, safePage } = getPagedModels(
      deps.modelCatalog,
      provider,
      settings.selectedPowerTier,
      0,
    );

    if (allModels.length === 0) {
      await ctx.reply('Моделей под выбранный фильтр мощности не найдено.');
      return;
    }

    await ctx.reply(modelListHeader(provider, settings.selectedPowerTier), {
      reply_markup: modelsListKeyboard({
        provider,
        page: safePage,
        pageSize: PAGE_SIZE,
        totalModels: allModels.length,
        models: pageModels,
        selectedModelId: settings.selectedModel,
      }),
    });
  });

  bot.callbackQuery('model:all', async (ctx) => {
    const userId = getUserId(ctx);
    const settings = await deps.userSettingsStore.getByUserId(userId);
    const { pageModels, allModels, safePage } = getAllPagedModels(deps.modelCatalog, 0);

    if (allModels.length === 0) {
      await ctx.answerCallbackQuery({ text: 'Model list is empty', show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery();
    await safeEdit(ctx, allModelsHeader(allModels.length), {
      ...allModelsListKeyboard({
        page: safePage,
        pageSize: ALL_MODELS_PAGE_SIZE,
        totalModels: allModels.length,
        models: pageModels,
        selectedModelId: settings.selectedModel,
      }),
    });
  });

  bot.callbackQuery(/^model:all:page:(\d+)$/, async (ctx) => {
    const page = Number(ctx.match[1]);
    const userId = getUserId(ctx);
    const settings = await deps.userSettingsStore.getByUserId(userId);
    const { pageModels, allModels, safePage } = getAllPagedModels(deps.modelCatalog, page);

    if (allModels.length === 0) {
      await ctx.answerCallbackQuery({ text: 'No models found', show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery();
    await safeEdit(ctx, allModelsHeader(allModels.length), {
      ...allModelsListKeyboard({
        page: safePage,
        pageSize: ALL_MODELS_PAGE_SIZE,
        totalModels: allModels.length,
        models: pageModels,
        selectedModelId: settings.selectedModel,
      }),
    });
  });

  bot.callbackQuery(/^mall:info:(\d+):(\d+)$/, async (ctx) => {
    const page = Number(ctx.match[1]);
    const index = Number(ctx.match[2]);
    const model = findAllModelFromCallback(deps.modelCatalog, page, index);

    if (!model) {
      await ctx.answerCallbackQuery({ text: 'Model not found', show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery();
    await ctx.reply(renderModelCard(model), {
      reply_markup: allModelDetailsKeyboard(page, index),
    });
  });

  bot.callbackQuery(/^mall:select:(\d+):(\d+)$/, async (ctx) => {
    const page = Number(ctx.match[1]);
    const index = Number(ctx.match[2]);
    const model = findAllModelFromCallback(deps.modelCatalog, page, index);

    if (!model) {
      await ctx.answerCallbackQuery({ text: 'Model not found', show_alert: true });
      return;
    }

    const userId = getUserId(ctx);
    await selectPowerUseCase.execute(userId, model.powerTier);
    await selectModelUseCase.execute(userId, model.provider, model.modelId);

    await ctx.answerCallbackQuery({ text: 'Model selected' });
    await ctx.reply(`✅ Выбрана модель: ${model.title}\n${model.modelId}`);
  });

  bot.callbackQuery(/^power:(Low|Medium|High|eHigh)$/, async (ctx) => {
    const rawPower = ctx.match[1];
    if (!isPowerTier(rawPower)) {
      await ctx.answerCallbackQuery({ text: 'Unknown power tier', show_alert: true });
      return;
    }

    const userId = getUserId(ctx);
    await selectPowerUseCase.execute(userId, rawPower);

    const settings = await deps.userSettingsStore.getByUserId(userId);
    const fallback = deps.modelCatalog.findDefaultModel(settings.selectedProvider, rawPower);
    if (fallback) {
      await selectModelUseCase.execute(userId, settings.selectedProvider, fallback.modelId);
    }

    await ctx.answerCallbackQuery({ text: `Power set to ${rawPower}` });
    await ctx.reply(`⚡ Установлена мощность: ${rawPower}`);
  });

  bot.callbackQuery('model:providers', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('Выберите провайдера:', { reply_markup: providerKeyboard });
  });

  bot.callbackQuery(/^model:page:(openrouter|groq):(\d+)$/, async (ctx) => {
    const provider = ctx.match[1];
    const page = Number(ctx.match[2]);

    if (!isProvider(provider)) {
      await ctx.answerCallbackQuery({ text: 'Unknown provider', show_alert: true });
      return;
    }

    const userId = getUserId(ctx);
    const settings = await deps.userSettingsStore.getByUserId(userId);
    const { pageModels, allModels, safePage } = getPagedModels(
      deps.modelCatalog,
      provider,
      settings.selectedPowerTier,
      page,
    );

    if (allModels.length === 0) {
      await ctx.answerCallbackQuery({ text: 'No models found', show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(modelListHeader(provider, settings.selectedPowerTier), {
      reply_markup: modelsListKeyboard({
        provider,
        page: safePage,
        pageSize: PAGE_SIZE,
        totalModels: allModels.length,
        models: pageModels,
        selectedModelId: settings.selectedModel,
      }),
    });
  });

  bot.callbackQuery(/^m:info:(openrouter|groq):(\d+):(\d+)$/, async (ctx) => {
    const provider = ctx.match[1];
    const page = Number(ctx.match[2]);
    const index = Number(ctx.match[3]);

    if (!isProvider(provider)) {
      await ctx.answerCallbackQuery({ text: 'Unknown provider', show_alert: true });
      return;
    }

    const userId = getUserId(ctx);
    const settings = await deps.userSettingsStore.getByUserId(userId);
    const model = findModelFromCallback(
      deps.modelCatalog,
      provider,
      settings.selectedPowerTier,
      page,
      index,
    );

    if (!model) {
      await ctx.answerCallbackQuery({ text: 'Model not found', show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery();
    await ctx.reply(renderModelCard(model), {
      reply_markup: modelDetailsKeyboard(provider, page, index),
    });
  });

  bot.callbackQuery(/^m:select:(openrouter|groq):(\d+):(\d+)$/, async (ctx) => {
    const provider = ctx.match[1];
    const page = Number(ctx.match[2]);
    const index = Number(ctx.match[3]);

    if (!isProvider(provider)) {
      await ctx.answerCallbackQuery({ text: 'Unknown provider', show_alert: true });
      return;
    }

    const userId = getUserId(ctx);
    const settings = await deps.userSettingsStore.getByUserId(userId);
    const model = findModelFromCallback(
      deps.modelCatalog,
      provider,
      settings.selectedPowerTier,
      page,
      index,
    );

    if (!model) {
      await ctx.answerCallbackQuery({ text: 'Model not found', show_alert: true });
      return;
    }

    await selectModelUseCase.execute(userId, provider, model.modelId);
    await ctx.answerCallbackQuery({ text: 'Model selected' });
    await ctx.reply(`✅ Выбрана модель: ${model.title}\n${model.modelId}`);
  });

  bot.callbackQuery('prompt:set', async (ctx) => {
    const userId = getUserId(ctx);
    await deps.userSettingsStore.setPendingInput(userId, 'system_prompt');

    await ctx.answerCallbackQuery();
    await ctx.reply('Отправьте следующим сообщением системный промпт (до 4000 символов).');
  });

  bot.callbackQuery('prompt:view', async (ctx) => {
    const userId = getUserId(ctx);
    const settings = await deps.userSettingsStore.getByUserId(userId);

    await ctx.answerCallbackQuery();
    await ctx.reply(settings.systemPrompt || 'Системный промпт не задан.');
  });

  bot.callbackQuery('prompt:reset', async (ctx) => {
    const userId = getUserId(ctx);
    await setSystemPromptUseCase.execute(userId, '');
    await deps.userSettingsStore.setPendingInput(userId, null);

    await ctx.answerCallbackQuery();
    await ctx.reply('Системный промпт сброшен.');
  });

  bot.callbackQuery('noop', async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (!text || text.startsWith('/')) {
      return;
    }

    if (text === '💬 Chat') {
      await ctx.reply('Отправьте текст, и я передам его в выбранную модель.');
      return;
    }

    if (
      text === '🤖 Model' ||
      text === '🤖 Model Browser' ||
      text === '🧭 AI Picker' ||
      text === '🏗 Build Code' ||
      text === '⚡ Power' ||
      text === '🧠 System Prompt' ||
      text === '📊 Model Info' ||
      text === '⚙️ Settings'
    ) {
      return;
    }

    const userId = getUserId(ctx);
    const settings = await deps.userSettingsStore.getByUserId(userId);

    if (settings.pendingInput === 'system_prompt') {
      await setSystemPromptUseCase.execute(userId, text);
      await deps.userSettingsStore.setPendingInput(userId, null);
      await ctx.reply('Системный промпт сохранен.');
      return;
    }

    if (settings.pendingInput === 'build_request') {
      await deps.userSettingsStore.setPendingInput(userId, null);
      try {
        await handleBuildRequest(ctx, userId, text);
      } catch (error) {
        const details = error instanceof Error ? error.message : String(error);
        await ctx.reply(`Ошибка /build: ${details}`);
      }
      return;
    }

    if (isArtifactRequest(text)) {
      await ctx.reply(
        [
          'Для генерации кода используйте /build.',
          'Пример: /build Сделай лендинг пиццерии в index.html',
        ].join('\n'),
      );
      return;
    }

    try {
      const active = await resolveActiveModel(userId);
      const history = deps.chatHistoryStore.get(userId);
      const messages: ChatMessage[] = [];
      if (active.settings.systemPrompt) {
        messages.push({ role: 'system', content: active.settings.systemPrompt });
      }
      messages.push(...history);
      messages.push({ role: 'user', content: text });

      await ctx.api.sendChatAction(ctx.chat.id, 'typing');
      const completion = await safeProviderChat({
        provider: active.provider,
        model: active.model,
        messages,
      });

      deps.chatHistoryStore.add(userId, { role: 'user', content: text });
      deps.chatHistoryStore.add(userId, { role: 'assistant', content: clipForHistory(completion.content) });

      await sendLargeTextReply(ctx, userId, 'ai-response', completion.content);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      await ctx.reply(`Ошибка запроса к ИИ: ${details}`);
    }
  });

  bot.catch((error) => {
    const details = error.error instanceof Error ? error.error.message : 'Unknown Telegram bot error';
    console.error('Bot error:', details);
  });

  return bot;
};
