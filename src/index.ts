import 'dotenv/config';
import { createTelegramBot } from './transport/telegram/bot.js';
import { loadEnv } from './infrastructure/config/env.js';
import { createOpenRouterAdapter } from './infrastructure/providers/openrouter.adapter.js';
import { createGroqAdapter } from './infrastructure/providers/groq.adapter.js';
import { ProviderRouter } from './infrastructure/providers/provider.router.js';
import { InMemoryUserSettingsStore } from './infrastructure/store/in-memory-user-settings.store.js';
import { InMemoryChatHistoryStore } from './infrastructure/store/in-memory-chat-history.store.js';
import { ModelCatalogService } from './infrastructure/config/model-catalog.loader.js';
import { ArtifactWriter } from './infrastructure/files/artifact-writer.js';

const env = loadEnv();
const modelCatalog = new ModelCatalogService();
const userSettingsStore = new InMemoryUserSettingsStore();
const chatHistoryStore = new InMemoryChatHistoryStore(20);
const artifactWriter = new ArtifactWriter();

const providerRouter = new ProviderRouter(
  createOpenRouterAdapter(env.openRouterApiKey),
  createGroqAdapter(env.groqApiKey),
);

const bot = createTelegramBot({
  telegramToken: env.telegramBotToken,
  providerRouter,
  modelCatalog,
  userSettingsStore,
  chatHistoryStore,
  artifactWriter,
});

bot.start({
  onStart: () => {
    console.log('Telegram bot started');
  },
});
