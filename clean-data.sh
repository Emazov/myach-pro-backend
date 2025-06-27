#!/bin/bash

# Скрипт для очистки данных в PostgreSQL и Redis (кроме пользователей)
# Использование: ./clean_data.sh

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Функция для запроса подтверждения
confirm() {
    read -r -p "$1 [y/N] " response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            true
            ;;
        *)
            false
            ;;
    esac
}

echo -e "${RED}ВНИМАНИЕ! Этот скрипт очистит все данные, кроме пользователей!${NC}"
echo -e "${RED}Все клубы, игроки, аналитика и кеш будут удалены!${NC}"

if ! confirm "Вы уверены, что хотите продолжить?"; then
    echo -e "${YELLOW}Операция отменена.${NC}"
    exit 0
fi

# Получаем переменные окружения для подключения к базе данных
if [ -f .env ]; then
    source .env
else
    echo -e "${RED}Файл .env не найден!${NC}"
    exit 1
fi

# Проверяем наличие DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Переменная DATABASE_URL не найдена в .env!${NC}"
    exit 1
fi

# Извлекаем параметры подключения из DATABASE_URL
# Формат: postgresql://username:password@host:port/database
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\).*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo -e "${YELLOW}1. Очистка таблиц в PostgreSQL (кроме пользователей)...${NC}"

# Создаем временный SQL-файл
TMP_SQL_FILE=$(mktemp)

cat > $TMP_SQL_FILE << EOF
-- Отключаем проверку внешних ключей на время очистки
SET session_replication_role = 'replica';

-- Очистка таблиц (кроме пользователей)
TRUNCATE TABLE "clubs" CASCADE;
TRUNCATE TABLE "players" CASCADE;
TRUNCATE TABLE "game_sessions" CASCADE;
TRUNCATE TABLE "user_events" CASCADE;
TRUNCATE TABLE "system_settings" CASCADE;

-- Удаляем всех админов, кроме главного (из переменной окружения)
DELETE FROM "admin_users" WHERE "telegram_id" != '$TELEGRAM_ADMIN_ID';

-- Сбрасываем роли пользователей, кроме главного админа
UPDATE "users" SET "role" = 'user' WHERE "telegram_id" != '$TELEGRAM_ADMIN_ID';

-- Устанавливаем роль админа для главного админа
UPDATE "users" SET "role" = 'admin' WHERE "telegram_id" = '$TELEGRAM_ADMIN_ID';

-- Включаем проверку внешних ключей
SET session_replication_role = 'origin';
EOF

# Выполняем SQL-команды
export PGPASSWORD=$DB_PASS
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $TMP_SQL_FILE

if [ $? -ne 0 ]; then
    echo -e "${RED}Ошибка при очистке таблиц PostgreSQL!${NC}"
    rm $TMP_SQL_FILE
    exit 1
fi

# Удаляем временный SQL-файл
rm $TMP_SQL_FILE

echo -e "${GREEN}Таблицы PostgreSQL успешно очищены.${NC}"

# Очистка Redis
echo -e "${YELLOW}2. Очистка кеша в Redis...${NC}"

# Проверяем наличие переменных для Redis
if [ -z "$REDIS_URL" ] && [ -z "$REDIS_PUBLIC_URL" ] && [ -z "$REDISHOST" ]; then
    echo -e "${RED}Переменные для подключения к Redis не найдены в .env!${NC}"
    exit 1
fi

# Определяем URL для подключения к Redis
REDIS_CONNECTION_URL=$REDIS_URL
if [ -z "$REDIS_CONNECTION_URL" ]; then
    REDIS_CONNECTION_URL=$REDIS_PUBLIC_URL
fi

if [ -z "$REDIS_CONNECTION_URL" ] && [ ! -z "$REDISHOST" ]; then
    REDIS_USER=${REDISUSER:-""}
    REDIS_PASS=${REDISPASSWORD:-""}
    
    if [ ! -z "$REDIS_USER" ] && [ ! -z "$REDIS_PASS" ]; then
        REDIS_AUTH="$REDIS_USER:$REDIS_PASS@"
    elif [ ! -z "$REDIS_PASS" ]; then
        REDIS_AUTH=":$REDIS_PASS@"
    else
        REDIS_AUTH=""
    fi
    
    REDIS_CONNECTION_URL="redis://$REDIS_AUTH$REDISHOST:$REDISPORT"
fi

# Создаем временный Redis-скрипт
TMP_REDIS_FILE=$(mktemp)

cat > $TMP_REDIS_FILE << EOF
# Удаляем все ключи кеша, но сохраняем другие данные
KEYS cache:*
EOF

# Выполняем команду очистки кеша в Redis
echo -e "${YELLOW}Удаляем ключи кеша из Redis...${NC}"
redis-cli -u $REDIS_CONNECTION_URL --scan --pattern "cache:*" | xargs -r redis-cli -u $REDIS_CONNECTION_URL DEL

if [ $? -ne 0 ]; then
    echo -e "${RED}Ошибка при очистке кеша Redis!${NC}"
    rm $TMP_REDIS_FILE
    exit 1
fi

# Удаляем временный Redis-файл
rm $TMP_REDIS_FILE

echo -e "${GREEN}Кеш Redis успешно очищен.${NC}"

echo -e "${GREEN}Все данные успешно очищены!${NC}"
echo -e "${YELLOW}Не забудьте перезапустить сервер для применения изменений:${NC}"
echo -e "${YELLOW}pm2 restart myach-pro-server${NC}" 