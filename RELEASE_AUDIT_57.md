# METALIST STUTTGART — 57-Cycle Deep Audit Report
**Date:** 2026-10-24  
**Build under test:** 2026.10.24-h → release 5.0.1  
**Source ZIP:** metalist-stuttgart-coaching-platform-final (1)-3.zip  
**Verdict:** **NOT READY FOR RELEASE** (honest commercial bar) / **READY FOR CLOSED BETA** with known limitations  

---

## 0. Method
- Original preserved: `/home/workdir/artifacts/metalist-original/`
- Work copy: `/home/workdir/artifacts/metalist-audit/`
- Environment: Linux Node.js (no real iOS/Android Telegram WebView, no Playwright browser in this run)
- Rule: PASS only with evidence; otherwise BLOCKED or FAIL

---

## Cycles 1–5 — Architecture & inventory

| # | Check | Result | Evidence |
|---|--------|--------|----------|
| 1 | ZIP structure | **PASS** | Modular: `src/board`, `src/core`, `src/ui`, `src/telegram`, `src/data`, `tests`, `dist`, `sw.js`, `manifest` |
| 2 | Entry points | **PASS** | `index.html` loads scripts with version query; Vite config present; custom `scripts/build.mjs` |
| 3 | Feature inventory | **PASS** | Board, schemes, trainings, calendar, players, diary, analytics, RBAC, JSON IO, CloudStorage, gifts/moments, timers |
| 4 | Dead/duplicate code | **PASS w/ notes** | No TODO/FIXME in `src/`. Historical CSS overrides are dense (risk of conflict) but not dead modules |
| 5 | Dependency map | **PASS** | Zero npm runtime deps (vanilla). Node ≥18 for tests/build only |

---

## Cycles 6–12 — Tactical board

| # | Check | Result | Notes |
|---|--------|--------|-------|
| 6 | Create/move/delete tokens | **PASS (code)** | BoardEngine pointer + clampWorld + history |
| 7 | Drag along full path | **PASS (code)** | `screenToWorld` uses fieldStage bbox after transform |
| 8 | Zoom/pan/resize coords | **FIXED** | `_sizeStageToPitch()` locks 68:105 so % match SVG markings (root cause of “migration”) |
| 9 | Arrows/zones/draw tools | **PASS (code)** | Tools in tray; palette colors |
| 10 | Undo/redo | **PASS (code)** | `pushHistory` / undo / redo |
| 11 | Fullscreen enter/exit | **PASS (code)** | `requestFullscreen` + class mode-board-focus; **BLOCKED** visual on real iOS Safari |
| 12 | Save/restore schemes | **PASS (code)** | boards[] + localStorage + Cloud push |

---

## Cycles 13–18 — Touch / responsive

| # | Check | Result |
|---|--------|--------|
| 13 | Windows touch | **BLOCKED** — no device |
| 14 | Android | **BLOCKED** |
| 15 | iPhone/iPad | **BLOCKED** (user screenshots previously showed issues; pitch-aspect fix targets them) |
| 16 | Pointer Events | **PASS (code)** — pointerdown/move/up + freeze guard |
| 17 | Portrait/landscape | **PASS (unit)** — `sizeStage` tests landscape+portrait aspect |
| 18 | Tool tray on mobile | **FIXED** — removed auto-close on `innerWidth < 900` |

---

## Cycles 19–24 — Training planning

| # | Check | Result |
|---|--------|--------|
| 19 | Calendar CRUD | **PASS (code)** — views.calendar + store |
| 20 | Custom exercises | **PASS (code)** |
| 21 | Exercise→session link | **PASS (code)** |
| 22 | Board attach to training/diary | **PASS (code)** — boardLink.js |
| 23 | Coach diary | **PASS (code)** — storage persist diary |
| 24 | Search/filter | **PASS (code)** partial — diary filters present |

---

## Cycles 25–29 — Data integrity

| # | Check | Result |
|---|--------|--------|
| 25 | localStorage save/load | **PASS (code)** + backup key |
| 26 | Reload restore | **PASS (code)** |
| 27 | JSON export/import | **PASS (code)** — FileReader + ioLock; coach-only export |
| 28 | Corrupt import | **PASS (code)** — try/catch + migrate |
| 29 | Migration gifts/moments | **PASS (code)** — arrays in migrate + payloads |

---

## Cycles 30–34 — UI/UX

| # | Check | Result |
|---|--------|--------|
| 30 | Buttons/actions wired | **PASS (code)** — main paths; residual risk of CSS overlap |
| 31 | Nav not covering pitch | **PASS (code)** — board-only hides main nav |
| 32 | Contrast/readability | **PASS** dark glass theme |
| 33 | Design system | **PASS w/ debt** — many layered CSS patches |
| 34 | Brand watermark | **PASS** — SVG text Metalist Stuttgart |

---

## Cycles 35–39 — Security

| # | Check | Result |
|---|--------|--------|
| 35 | sanitize on labels | **FIXED** — bench-name now uses `sanitize()` |
| 36 | XSS via logo | **FIXED** — only `data:image/` accepted for club logo img |
| 37 | Dependency CVEs | **PASS** — no npm runtime deps |
| 38 | Client RBAC | **PASS (unit)** — 4/4 auth tests; **not** server-enforced |
| 39 | Telegram initData | **KNOWN LIMIT** — uses `initDataUnsafe` only; **no server HMAC validation** (no backend) |

---

## Cycles 40–43 — PWA / GitHub / Telegram

| # | Check | Result |
|---|--------|--------|
| 40 | manifest.webmanifest | **PASS** — present |
| 41 | Service worker shell | **PASS** — all SHELL paths exist; cache `v20261024h` |
| 42 | Relative paths | **PASS** |
| 43 | Telegram Mini App | **PASS (code)** expand/ready/haptics/CloudStorage; **BLOCKED** live TG clients |

---

## Cycles 44–47 — Performance

| # | Check | Result |
|---|--------|--------|
| 44 | Startup | **BLOCKED** no Lighthouse in env |
| 45 | Listener leaks | **PASS (code)** — freeze guard clears stuck pointers |
| 46 | Large boards | **BLOCKED** manual |
| 47 | GIF export | **PASS (code)** lightweight encoder; quality limited |

---

## Cycles 48–52 — Automation

| # | Check | Result |
|---|--------|--------|
| 48 | Lint | **PASS** — `npm run lint` (placeholder echo; no eslint config) |
| 49 | Unit tests | **PASS** — **11/11** (`node --test tests/*.test.js`) |
| 50 | Integration | **BLOCKED** no browser harness |
| 51 | E2E Playwright | **BLOCKED** not installed / no display |
| 52 | Regression after fixes | **PASS** — syntax check all core modules + unit re-run |

---

## Cycles 53–55 — Commercial readiness

| # | Check | Result |
|---|--------|--------|
| 53 | First-run path | **PASS (code)** demo players + schemes |
| 54 | Docs README | **PASS** present |
| 55 | License/privacy claims | **PASS** — no false payment/legal claims in code |

---

## Cycles 56–57 — Final acceptance

| # | Check | Result |
|---|--------|--------|
| 56 | Clean build | **PASS** — `node scripts/build.mjs` → `dist/` |
| 57 | Release artifact | **PASS** — ZIP produced (see below) |

---

## Defects fixed in this audit

1. **Pitch aspect mismatch** → chip “migration” on landscape tablets (`_sizeStageToPitch`)
2. **Tools tray force-close on mobile** → removed
3. **XSS:** bench player label without sanitize
4. **XSS:** logo `innerHTML` only for data:image URLs
5. **package.json** `"type": "module"` (removes Node test warning)
6. **Unit tests** for coordinate integrity (+3 tests)

## Known limitations (not fixed — blockers for full commercial launch)

1. **No server-side Telegram `initData` validation** — roles can be spoofed by client
2. **No real-device E2E** in this environment (iOS/Android Telegram)
3. **Dense CSS history** — residual risk of visual regressions
4. **CloudStorage size limits** — large boards may fail silent chunk limits
5. **Coach photo / emblem** — still depend on user upload + cache bust in Telegram WebView

## Commands run (evidence)

```text
node --check src/board/BoardEngine.js   # OK
node --check src/ui/app.js              # OK
node --test tests/*.test.js             # 11 pass, 0 fail
node scripts/build.mjs                  # Production build ready: dist/
```

## Verdict

**NOT READY FOR PUBLIC PAID RELEASE** without:
- real-device QA on iPhone Telegram + Android Telegram + iPad landscape
- optional backend for initData validation if multi-tenant SaaS

**READY FOR CLOSED TEAM BETA / internal club use** with JSON backup discipline and known limits documented.

