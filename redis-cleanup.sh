#!/bin/bash

echo "🔧 Очистка Redis от старых ключей rate limiting..."

# Подключаемся к Redis и удаляем все ключи rate limiting
redis-cli --scan --pattern "rate_limit:*" | xargs -r redis-cli del

echo "✅ Redis очищен от старых ключей"
echo "🔄 Перезапуск PM2 кластера..."

# Плавный перезапуск без downtime
pm2 reload pm2.config.js

echo "✅ PM2 кластер перезапущен"
echo "📊 Проверка статуса:"
pm2 list 