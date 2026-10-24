# METALIST STUTTGART — Corporate File & RBAC Update

## Delivered
- Added a dedicated coach-only corporate team package export (`*.metalist.json`).
- Added corporate package import for coach/player/guest; player and guest roles are blocked from importing a full backup JSON.
- Corporate package omits diary entries, player phone numbers, Telegram numeric IDs, private notes, and selected physical/readiness fields.
- Role permissions are stricter: player is read-only and cannot open settings/analytics/diary; guest is limited to dashboard, calendar, matches, and roster views.
- Added UI-event guards for common coach-only mutations and board editing.
- Fixed GitHub Pages workflow to run the canonical `npm run build` instead of copying only part of the app.
- Documented the manual file handoff workflow and its security limitations.

## Validation
- `node --check` across JS/MJS files: PASS.
- `npm test`: 16 tests passed, 0 failed.
- `npm run build`: PASS; output written to `dist/`.
- Headless Chromium smoke attempt: BLOCKED/TIMED OUT in this environment; no browser-level success is claimed.

## Important security note
The corporate package is a manually transferred JSON file, not a cryptographically signed or encrypted entitlement. Client-side roles improve UI separation but cannot stop a recipient from inspecting or modifying the file or browser state. For security-grade commercial multi-user access, add a backend with server-side Telegram `initData` validation, authorization, and per-team data storage.
