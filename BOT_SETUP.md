# Telegram Club Bot — METALIST STUTTGART

## Що робить бот
- **Опитування відвідування** за ~36 год до тренування (авто або вручну)
- **План тренування** у групу
- **Склад на матч**
- **Події клубу**

Група: https://t.me/+ekGGhRwvEuI0N2Ey

## Налаштування (один раз)

1. Створіть бота в @BotFather (або використайте наявного).
2. **Токен лише на сервері** у `.env`:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC...
   TELEGRAM_CLUB_CHAT_ID=-100...
   BOT_API_SECRET=optional_random_string
   PORT=8787
   ```
3. Додайте бота в групу клубу як адміністратора (право писати / опитування).
4. Напишіть у групі будь-яке повідомлення (щоб з’явився update).
5. Запустіть сервер:
   ```
   set TELEGRAM_BOT_TOKEN=...
   set PORT=8787
   node server/index.mjs
   ```
6. У додатку (Налаштування / Інструменти тренера):
   - Вкажіть URL API (`localStorage ms_auth_api` = `http://127.0.0.1:8787` або ваш HTTPS)
   - «Знайти Chat ID» або вставте вручну
   - Увімкніть «Авто-опитування за 36 год»

## Windows
```
set TELEGRAM_BOT_TOKEN=ваш_токен
set PORT=8787
node server/index.mjs
```

## Безпека
- Токен **ніколи** не кладіть у `src/` чи GitHub Pages.
- Якщо токен світився в чаті — **перевипустіть** його в @BotFather (`/revoke`).
- У production обмежте `CORS_ORIGIN` і задайте `BOT_API_SECRET`.

## API
| Метод | Шлях |
|-------|------|
| GET | `/api/bot/status` |
| GET | `/api/bot/discover-chats` |
| POST | `/api/bot/attendance-poll` |
| POST | `/api/bot/training-plan` |
| POST | `/api/bot/match-lineup` |
| POST | `/api/bot/club-event` |
| POST | `/api/bot/schedule-check` |
