export interface AppEnv {
  telegramBotToken: string;
  openRouterApiKey: string;
  groqApiKey: string;
}

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const loadEnv = (): AppEnv => ({
  telegramBotToken: requireEnv('TELEGRAM_BOT_TOKEN'),
  openRouterApiKey: requireEnv('OPENROUTER_API_KEY'),
  groqApiKey: requireEnv('GROQ_API_KEY'),
});
