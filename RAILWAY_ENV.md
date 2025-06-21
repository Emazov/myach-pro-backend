# Переменные окружения для Railway

## Обязательные переменные

### База данных

- `DATABASE_URL` - автоматически создается при подключении PostgreSQL к проекту

### Telegram Bot

- `TELEGRAM_BOT_TOKEN` - токен бота от @BotFather
- `TELEGRAM_ADMIN_ID` - ID администратора Telegram

### Web App

- `WEB_APP_URL` - URL фронтенда (например: https://your-app.vercel.app)

### Cloudflare R2 (для загрузки файлов)

- `R2_ACCESS_KEY` - ключ доступа R2
- `R2_SECRET_KEY` - секретный ключ R2
- `R2_BUCKET_NAME` - название bucket R2
- `R2_ENDPOINT` - эндпоинт R2

### Другие

- `PORT` - порт сервера (Railway автоматически устанавливает)

## Как установить в Railway

1. Зайти в настройки проекта
2. Перейти в Variables
3. Добавить каждую переменную из списка выше

## Пример значений

```
TELEGRAM_BOT_TOKEN=123456789:AAEhBOweAhXXXXXXXXXXXXXXXXXXXXXX
TELEGRAM_ADMIN_ID=123456789
WEB_APP_URL=https://your-frontend.vercel.app
R2_ACCESS_KEY=your_access_key
R2_SECRET_KEY=your_secret_key
R2_BUCKET_NAME=your-bucket-name
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
```
