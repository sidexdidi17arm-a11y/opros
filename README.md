# Opros (PostgreSQL + Render)

## Что делает
- Frontend: `public/index.html` (уже настроен на вызовы `/api/data`, `/api/data/restore`, `DELETE /api/data`)
- Backend: `server.js` (Express) хранит данные в PostgreSQL (таблица `weeks`)

## Локальный запуск
1) Установи зависимости:
```bash
npm install
```

2) Создай `.env` по примеру `.env.example` и укажи `DATABASE_URL`.

3) Запусти:
```bash
npm start
```

Открой: http://localhost:3000

## Деплой на Render (коротко)
1) Создай Web Service из репозитория.
2) В **Environment** добавь переменную `DATABASE_URL` (строка подключения Postgres).
3) Build Command: `npm install`
4) Start Command: `npm start`

> В коде включён SSL для Render Postgres: `ssl: { rejectUnauthorized: false }`.
