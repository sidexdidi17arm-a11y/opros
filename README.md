# Opros (Neon Postgres)

Приложение статистики опроса по РЭС. Frontend — `public/index.html`. Backend — Express + Postgres (Neon).

## Что в API
- `GET  /api/health` — статус.
- `GET  /api/data` — список недель, отсортирован по `timestamp DESC` (публичный).
- `POST /api/data` — сохранить/обновить неделю (требует `X-Admin-Password`).
- `POST /api/data/restore` — заменить все недели массивом из тела (требует `X-Admin-Password`).
- `DELETE /api/data` — очистить таблицу (требует `X-Admin-Password`).

Лимит тела запроса — 50 MB.

## Создать базу в Neon (один раз)
1. Открой https://console.neon.tech → **Sign up** (через Google / GitHub / email).
2. **Create project** — выбери регион поближе (например `eu-central-1` (Frankfurt)).
3. После создания: на странице проекта → **Connection Details** → выбери **Pooled connection** (важно — не "Direct").
4. Скопируй строку вида:
   ```
   postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require
   ```
5. Эта строка — твой `DATABASE_URL`. Таблицы создаются автоматически при старте сервера.

## Локальный запуск
```bash
cp .env.example .env
# открой .env и впиши DATABASE_URL и ADMIN_PASSWORD
npm install
npm start
```
Открой http://localhost:3000

## Деплой на Render
1. Web Service из репозитория.
2. Build: `npm install`. Start: `npm start`.
3. Environment → добавь:
   - `DATABASE_URL` = pooled connection string из Neon
   - `ADMIN_PASSWORD` = тот же пароль, который вводят в админ-логин фронтенда

## Авторизация
- Frontend хранит пароль в `sessionStorage` после логина и шлёт его в заголовке `X-Admin-Password` для пишущих запросов.
- Сервер сравнивает заголовок с `process.env.ADMIN_PASSWORD`.
- Чтение (`GET /api/data`) — публичное.

## ⚠️ Если ты только что клонировал старую версию репо
В git-истории остались credentials старой Render Postgres БД. **Ротируй её пароль** (или удали БД на Render — она всё равно истекает через 90 дней) и перепиши историю:
```bash
git rm --cached .env
git commit -m "Remove .env from repo"
# для очистки истории (опасно, согласуй с командой):
# git filter-repo --invert-paths --path .env
git push --force
```
