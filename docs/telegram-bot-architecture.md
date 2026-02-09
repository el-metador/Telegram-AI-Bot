# Архитектура Telegram-бота: мульти-ИИ через Groq + OpenRouter

## 1) Цель
Построить Telegram-бота с единым UX для общения с разными ИИ-моделями через API-провайдеров:
- OpenRouter
- Groq

Ключевые функции:
- Выбор ИИ из меню/inline-кнопок
- Выбор уровня мощности: `Low`, `Medium`, `High`, `eHigh`
- Пользовательские системные промпты
- Просмотр карточки модели: провайдер, характеристики, рейтинг по звездам
- Расширяемый каталог моделей (добавление без изменения бизнес-логики)

## 2) Технологический стек (рекомендуемый)
- Язык: TypeScript (Node.js 20+)
- Telegram SDK: `grammY` (или `Telegraf`, если предпочтительнее)
- HTTP: `undici`/`axios`
- Хранилище (без БД на старте):
  - In-memory store для пользовательских настроек и короткой истории
  - Опционально: snapshot в JSON-файл для восстановления после рестарта
- Кэш/очереди (опционально): Redis
- Логи/метрики: Pino + OpenTelemetry (или Prometheus)

## 3) Слои системы

### 3.1 Transport Layer (Telegram Adapter)
Отвечает за:
- получение `update` от Telegram (`webhook` предпочтительно)
- маршрутизацию команд/колбэков
- рендер меню и inline-кнопок

Файлы/модули:
- `src/transport/telegram/bot.ts`
- `src/transport/telegram/handlers/*.ts`
- `src/transport/telegram/keyboards/*.ts`

### 3.2 Application Layer (Use Cases)
Бизнес-сценарии:
- `selectModel(userId, modelId)`
- `selectPower(userId, powerLevel)`
- `setSystemPrompt(userId, promptText)`
- `sendUserMessage(userId, text)`
- `showModelCard(modelId)`

Файлы:
- `src/application/usecases/*.ts`

### 3.3 Domain Layer
Сущности и правила:
- `UserProfile`
- `ChatSession`
- `ModelCard`
- `Provider`
- `PowerTier`
- `SystemPrompt`

Файлы:
- `src/domain/entities/*.ts`
- `src/domain/services/*.ts`

### 3.4 Infrastructure Layer
Интеграции и доступ к данным:
- Провайдеры LLM (`GroqAdapter`, `OpenRouterAdapter`)
- Store/репозитории (`UserSettingsStore`, `ChatMemoryStore`)
- Конфиг/секреты

Файлы:
- `src/infrastructure/providers/*.ts`
- `src/infrastructure/store/*.ts`
- `src/infrastructure/config/*.ts`

## 4) Единый контракт для провайдеров

```ts
export type ChatProvider = 'openrouter' | 'groq';

export interface ChatCompletionRequest {
  provider: ChatProvider;
  model: string;
  systemPrompt?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResponse {
  content: string;
  model: string;
  provider: ChatProvider;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  latencyMs: number;
}

export interface LlmProviderAdapter {
  chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  healthcheck(): Promise<boolean>;
}
```

## 5) Каталог моделей и карточки

Каталог хранится в `config/models.catalog.json`.
Каждая карточка включает:
- `provider`
- `modelId`
- `title`
- `powerTier`: `Low | Medium | High | eHigh`
- `tags`
- `stars`: оценки по критериям

Оценки (звезды):
- `coding`
- `reasoning` (интеллект)
- `multilingual`
- `speed`
- `safety`

Это решает ваш кейс «5 звезд для кодинга, 3 для интеллекта, 1 для многоязычности и т.д.» как отдельные независимые метрики.

## 6) UX: меню и inline-кнопки

### 6.1 Главное меню
- `💬 Chat`
- `🤖 Model`
- `⚡ Power`
- `🧠 System Prompt`
- `📊 Model Info`
- `⚙️ Settings`

### 6.2 Ветка выбора модели
1. Пользователь нажимает `🤖 Model`
2. Показываем провайдеры: `OpenRouter` / `Groq`
3. После выбора провайдера показываем карточки моделей (пагинация)
4. На карточке кнопки:
   - `✅ Select`
   - `📊 Details`
   - `⬅️ Back`

### 6.2.1 Smart AI Picker (удобный подбор)
1. Пользователь нажимает `🧭 AI Picker` или `/ai`
2. Выбирает цель: `coding/reasoning/multilingual/speed/safety/balanced`
3. Выбирает фильтр провайдера: `all/openrouter/groq`
4. Выбирает power filter: `any/Low/Medium/High/eHigh`
5. Получает ранжированный топ моделей и выбирает в один клик

### 6.3 Ветка выбора мощности
1. Нажатие `⚡ Power`
2. Inline-кнопки: `Low | Medium | High | eHigh`
3. После выбора фильтруем доступные модели + сохраняем предпочтение в профиль

### 6.4 Системный промпт
- `Set Prompt`
- `View Prompt`
- `Reset Prompt`
- Поддержка шаблонов (например: coding assistant, analyst, translator)

### 6.5 File Artifact Mode (код и большие ответы)
- Явный вход в `artifact mode` через команду `/build` (или кнопку `Build Code`).
- В этом режиме LLM возвращает структурированный JSON: `summary + files[] + runInstructions`.
- Бот пишет файлы в `generated/<telegramUserId>/...`, отправляет код в чат (или файлом, если объем большой) и отдельно отправляет инструкции запуска.
- Для очень длинных обычных ответов бот отправляет `.txt` файлом + превью в сообщении.
- Если пользователь в обычном чате просит написать код, бот подсказывает использовать `/build`.

## 7) Хранение данных

Без БД в MVP:
- `InMemoryUserSettingsStore` (`Map<telegramId, UserSettings>`)
  - `selectedProvider`
  - `selectedModel`
  - `selectedPowerTier`
  - `systemPrompt`
- `InMemoryChatHistoryStore` (`Map<telegramId, ChatMessage[]>`, с лимитом N сообщений)
- Каталог моделей из `config/models.catalog.json`

Ограничение: данные теряются при рестарте процесса.
Смягчение: опционально периодически писать snapshot в `data/runtime-state.json`.

## 8) Поток сообщения (runtime)
1. Пользователь отправляет сообщение в чат
2. `TelegramHandler` достает профиль пользователя
3. Определяется активная модель:
   - явный выбор пользователя
   - иначе default по power tier
4. Собирается контекст: `systemPrompt + history + userMessage`
5. `ProviderRouter` делегирует в `OpenRouterAdapter` или `GroqAdapter`
6. Ответ сохраняется в `InMemoryChatHistoryStore`
7. Отправка ответа пользователю

## 9) Provider Router

```ts
class ProviderRouter {
  constructor(
    private openrouter: LlmProviderAdapter,
    private groq: LlmProviderAdapter,
  ) {}

  get(provider: 'openrouter' | 'groq') {
    return provider === 'openrouter' ? this.openrouter : this.groq;
  }
}
```

## 10) Обработка отказов и лимитов
- Таймаут каждого запроса (например, 45s)
- Retry с backoff для сетевых ошибок (не для 4xx)
- Fallback-модель в том же `powerTier`
- Rate-limit на пользователя (anti-spam)
- Circuit breaker на провайдера при сериях ошибок

## 11) Безопасность
- Секреты только из ENV (`TELEGRAM_BOT_TOKEN`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`)
- Маскирование токенов в логах
- Ограничение длины пользовательского промпта
- Модерация входа/выхода (опционально отдельной safeguard-моделью)

## 11.1) Конфигурация `.env`
Минимальный набор:
- `TELEGRAM_BOT_TOKEN`
- `OPENROUTER_API_KEY`
- `GROQ_API_KEY`

На старте процесса делаем fail-fast валидацию ENV, если хотя бы один ключ отсутствует.

## 12) Наблюдаемость
Логировать:
- `provider`, `model`, `latencyMs`, `status`
- токены (`prompt/completion/total`)
- частоту ошибок по кодам

Метрики:
- `llm_requests_total{provider,model,status}`
- `llm_latency_ms_bucket{provider,model}`
- `telegram_updates_total{type}`

## 13) Структура проекта

```text
src/
  transport/
    telegram/
      handlers/
      keyboards/
      bot.ts
  application/
    ports/
    usecases/
  domain/
    entities/
    services/
  infrastructure/
    providers/
      openrouter.adapter.ts
      groq.adapter.ts
      provider.router.ts
    store/
    config/
  shared/
    types/
    errors/
config/
  models.catalog.json
.env.example
docs/
  telegram-bot-architecture.md
```

## 14) Этапы внедрения
1. MVP transport + provider adapters + user settings
2. Каталог моделей и карточки + inline-меню
3. История диалога в памяти + опциональный snapshot в файл
4. Метрики/алерты/фоллбеки
5. A/B подбор дефолтных моделей по power tier
6. При необходимости миграция на БД без изменения use cases (через новый store adapter)

## 15) Рекомендации по power tier
- `Low`: быстрые/дешевые ответы, короткие задачи
- `Medium`: баланс качества/скорости
- `High`: сложные reasoning/coding задачи
- `eHigh`: максимальное качество, высокая латентность

Назначение tier хранить в каталоге как управляемую конфигурацию, чтобы менять без релиза кода.
