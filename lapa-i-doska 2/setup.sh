#!/usr/bin/env bash
# Первый запуск: база, зависимости, таблицы, тестовые данные
set -e
cd "$(dirname "$0")"
docker compose up -d
echo "Жду базу..."; sleep 6
(cd server && npm install && npx prisma migrate dev --name init && npm run seed)
(cd client && npm install)
echo "Готово. Запуск: ./start.sh"
