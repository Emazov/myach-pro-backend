# Деплой сервера на Railway

## Шаг 1: Подготовка аккаунта Railway

1. Зарегистрируйтесь на [railway.app](https://railway.app)
2. Подключите GitHub аккаунт

## Шаг 2: Создание проекта

1. Нажмите "New Project"
2. Выберите "Deploy from GitHub repo"
3. Выберите ваш репозиторий
4. В настройках деплоя укажите Root Directory: `server`

## Шаг 3: Добавление базы данных PostgreSQL

1. В вашем проекте нажмите "New Service"
2. Выберите "Database" → "PostgreSQL"
3. Railway автоматически создаст переменную `DATABASE_URL`

## Шаг 4: Настройка переменных окружения

Перейдите в настройки вашего сервиса → Variables и добавьте:

### Telegram Bot

```
TELEGRAM_BOT_TOKEN=ваш_токен_бота
TELEGRAM_ADMIN_ID=ваш_telegram_id
```

### Web App URL

```
WEB_APP_URL=https://your-frontend-url.vercel.app
```

### Cloudflare R2 (для файлов)

```
R2_ACCESS_KEY=ваш_access_key
R2_SECRET_KEY=ваш_secret_key
R2_BUCKET_NAME=ваш_bucket
R2_ENDPOINT=https://account-id.r2.cloudflarestorage.com
```

## Шаг 5: Настройка билда

1. В Settings → Build укажите:
   - Build Command: `npm run build`
   - Start Command: `npm run start`

## Шаг 6: Деплой

1. Сделайте push в ваш репозиторий
2. Railway автоматически начнет деплой
3. Следите за логами в разделе "Deployments"

## Шаг 7: Проверка работы

1. Получите URL вашего сервиса в Railway
2. Проверьте, что сервер отвечает на API запросы
3. Обновите настройки вебхука Telegram бота (если нужно)

## Устранение проблем

### Если деплой падает на миграциях

1. Проверьте, что DATABASE_URL правильно настроен
2. Посмотрите логи билда на предмет ошибок

### Если сервер не запускается

1. Проверьте все переменные окружения
2. Убедитесь, что все обязательные переменные заполнены

### Если бот не работает

1. Проверьте TELEGRAM_BOT_TOKEN
2. Убедитесь, что вебхук бота указывает на правильный URL
