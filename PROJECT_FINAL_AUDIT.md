# METALIST STUTTGART — Health Check (2026-10-21)

## Syntax
All modules: OK (node --check)

## Critical fixes this pass
1. **App is not defined** — broken `document.(...)` in app.js → fixed
2. **isCaptain / status lost on load** — normalizePlayer/normalizeBoardObj now preserve fields
3. **Toolbar docked** — top chrome + bottom tools; no overlay on grass
4. **Null-safe toolbar pos** — docked bars skipped for floating drag logic
5. **Bench promote/demote** — persist via StorageManager.save
6. **Color palette** — persists drawColor + selected object color

## Integration map
```
TelegramManager → AuthManager → StorageManager → Store
                                      ↓
                              App.init / navigate
                                      ↓
                    ┌─────────────────┴─────────────────┐
                    Views (UI)                    BoardEngine
                    Actions (CRUD)                TimerEngine
```

## Board open rule
ONLY logo (`open-default-board`) or explicit preset/scheme load.

## Data integrity
- localStorage + Telegram CloudStorage
- schema normalize keeps isCaptain, status, onBench, chipColor

## Known soft limitations
- GIF export depends on GifEncoder availability
- CloudStorage size limits (chunking if implemented in storage.js)
- Floating toolbar drag disabled when docked top/bottom (by design)

## Regression checklist
- [ ] App boots without error screen
- [ ] Logo → board
- [ ] Scheme places 11 + bench
- [ ] Captain / injury persist after reload
- [ ] Drag bench ↔ field
- [ ] Color palette → new chips
- [ ] Undo/redo
- [ ] JSON import/export isolated (no board jump)
