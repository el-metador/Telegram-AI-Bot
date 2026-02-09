# Telegram AI Bot

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Markdown](https://img.shields.io/badge/Markdown-000000?style=for-the-badge&logo=markdown&logoColor=white)
![JSON](https://img.shields.io/badge/JSON-000000?style=for-the-badge&logo=json&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram_Bot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)
![OpenRouter](https://img.shields.io/badge/OpenRouter-111111?style=for-the-badge&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-F55036?style=for-the-badge&logoColor=white)

Telegram-бот для общения с разными ИИ через OpenRouter и Groq

</div>

## Что умеет

- 🤖 Выбор модели: `Model Browser`, `Все ИИ`, `Smart AI Picker`
- ⚡ Выбор мощности: `Low`, `Medium`, `High`, `eHigh`
- 🧠 Системный промпт: `set / view / reset`
- 🏗 Генерация кода через `/build` с сохранением файлов
- 📎 Отправка сгенерированных файлов документами в Telegram
- 📄 Для длинных ответов: авто-отправка `.txt` файлом + превью
- 🔁 Fallback для моделей, где отключены `developer/system` инструкции

## Языки и стек

### Языки

- ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) TypeScript
- ![Markdown](https://img.shields.io/badge/Markdown-000000?logo=markdown&logoColor=white) Markdown
- ![JSON](https://img.shields.io/badge/JSON-000000?logo=json&logoColor=white) JSON

### Основные технологии

- `Node.js`
- `grammY`
- `OpenRouter API`
- `Groq API`

## Быстрый старт

```bash
npm install
cp .env.example .env
```

Заполните `.env`:

```env
TELEGRAM_BOT_TOKEN=...
OPENROUTER_API_KEY=...
GROQ_API_KEY=...
```

Запуск:

```bash
npm run dev
```

Сборка:

```bash
npm run build
```

## Команды

- `/start`, `/menu` - главное меню
- `/model` - выбор модели по провайдеру
- `/models` - список всех ИИ на боте
- `/ai` - smart picker (цель -> провайдер -> мощность)
- `/power` - выбор мощности
- `/prompt` - системный промпт
- `/build <задача>` - генерация кода в файлы
- `/settings` - текущие настройки
- `/clear` - очистка истории

## Как работает /build

1. Пользователь отправляет задачу: `/build Сделай лендинг пиццерии в index.html`
2. Бот показывает статус: `Генерация вашего кода, ожидайте...*`
3. Бот генерирует проект и сохраняет файлы в:
   - `generated/<telegram_user_id>/...`
4. Бот отправляет созданные файлы документами в чат
5. Бот отправляет инструкции запуска

## Структура проекта

```text
src/
  application/
    services/
      artifact-mode.ts
  infrastructure/
    files/
      artifact-writer.ts
    providers/
  transport/
    telegram/
      bot.ts
config/
  models.catalog.json
docs/
  telegram-bot-architecture.md
generated/
  <telegram_user_id>/
```

## Ограничения

- Без БД: настройки и история хранятся в памяти процесса
- Каталог моделей статический: `config/models.catalog.json`
- Бинарные артефакты (`jpg/png/...`) в `/build` не генерируются как реальные бинарники

## Troubleshooting

### Ошибка про developer/system instruction

Если провайдер возвращает ошибку вида:
- `Developer instruction is not enabled ...`

Бот автоматически делает fallback-запрос в совместимом формате.

### Если не приходит файл

- Проверьте, что бот имеет право отправлять документы
- Убедитесь, что размер файла не превышает лимит Telegram
- Повторите `/build` с более короткой задачей
