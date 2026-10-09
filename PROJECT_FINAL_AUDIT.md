# PROJECT FINAL AUDIT — METALIST STUTTGART Coaching Platform

## Architecture
- Framework: Vanilla JS (classic scripts, ordered load)
- Build: `npm run build` → `dist/`
- State: `Store` (src/core/store.js)
- Storage: localStorage + migration (src/core/storage.js)
- Board: SVG BoardEngine (src/board/BoardEngine.js)
- Telegram: src/telegram/TelegramManager.js

## Modules
| Path | Role |
|------|------|
| src/core/utils.js | uid, clamp, sanitize, ErrorManager, schema keys |
| src/core/store.js | App state |
| src/core/storage.js | persist/load/export/import |
| src/core/modal.js | Modal system |
| src/core/toast.js | Toasts |
| src/core/loadModel.js | RPE load model |
| src/board/BoardEngine.js | Tactical board |
| src/board/TimerEngine.js | Session timers |
| src/data/demo.js | Demo players/exercises |
| src/data/schemes.js | Formations + BACK3 |
| src/ui/views.js | All page views |
| src/ui/app.js | Navigation, events |
| src/ui/actions.js | CRUD actions + boot |
| src/ui/ai.js | AI demo helpers |
| src/telegram/TelegramManager.js | Mini App |
| src/styles/app.css | Full UI CSS |

## Features
Dashboard, Board, Trainings, Exercises, My Exercises, 3-Defenders, Tactics, Players, Calendar, Diary, Matches, Analytics, Settings, Timer, Fullscreen, Telegram, Export/Import, Anim→Training

## Data model
Team settings, Player, Training, Exercise, MyExercise, Animation (by id), DiaryEntry, Match, CalendarEvent, activeBoard, boards

## Deployment
.github/workflows/deploy.yml → GitHub Pages

## Known limitations
- Video analysis / player radar charts: UI hooks partial (extend in next iteration)
- Classic scripts (not ES modules) chosen deliberately to preserve monolith logic without rewrite risk
- Vite present historically; production path is static copy

## Tests
- tests/math.test.js (utils)
- Manual regression: board drag, views, storage
