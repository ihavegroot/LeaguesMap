# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

LeaguesMap is a single-page Leaflet map application for Old School RuneScape (OSRS) league task planning. It's vanilla JavaScript with no build step — files are served as-is.

## Commands

- **Dev server:** `python server.py` (serves at http://127.0.0.1:8000, configurable via `SERVER_HOST`/`SERVER_PORT`)
- **Run all E2E tests:** `npm run test:e2e`
- **Run core tests (P0+P1):** `npm run test:e2e:core`
- **Run perf tests:** `npm run test:e2e:perf`
- **Run single test file:** `npx playwright test tests/p2.spec.js`
- **Run single test by name:** `npx playwright test -g "test name"`
- **Interactive test UI:** `npm run test:e2e:ui`
- **View test report:** `npm run test:e2e:report`

Note: P0 and P1 tests are currently `.skip()`-ed. Tests use Chromium only.

## Architecture

**No build system.** Vanilla JS with ES6 modules, served directly by a Python HTTP server. No transpilation, bundling, or framework.

### Entry Flow
`index.html` → `js/main/main_osrs.js` → creates `L.gameMap()` and attaches all plugins/controls.

### Plugin System
Each feature is a Leaflet plugin in `js/plugins/` using the UMD wrapper pattern (`L.Control.extend`):

| Plugin | Role |
|--------|------|
| `leaflet.tasks.js` | Task search, completion tracking, strategy points |
| `leaflet.planner.js` | Task planner with drag-drop, grouping, route persistence |
| `leaflet.displays.js` | Unified search (items/NPCs/shops), 3D toggle |
| `leaflet.objects.js` | NPC/object/scenery layer rendering |
| `leaflet.navigator.js` | Region filter control, breadcrumb navigation |
| `leaflet.plane.js` | Multi-plane (floor) switching |
| `leaflet.dive.js` | Diving minigame mode |
| `leaflet.era.js` | Historical OSRS era selection |

### Data
- `data_osrs/*.json` — game data (monsters, items, shops, scenery). Large files (~22MB total).
- `route_jsons/` — preset task routes with `manifest.json` index.
- External data fetched from OSRS Wiki and GitHub CDNs, cached via `js/data/json-cache.js` (promise-based with fallbacks).

### State & Communication
- **Persistence:** All user state in `localStorage` (completed tasks, planner groups, routes, UI prefs).
- **Globals:** Plugins expose APIs on `window` (e.g., `window._completedTasks`, `window._plannerAddTask`, `window.runescape_map`).
- **Inter-plugin events:** `CustomEvent` dispatch on `window` (e.g., `regionControlReady`).

### Layers
`layers/` and `js/layers.js` define the custom `L.GameMap` class extending `L.Map` with tile layer configuration for OSRS map tiles.

## Testing

Playwright E2E tests in `tests/`. Helper utilities in `tests/helpers/app.js` provide `clearAppStorage`, `gotoApp`, `openPlannerTab`, and `seedPlannerWithFirstTasks`. Tests run against `python server.py` (auto-started by Playwright config).

## Lint

ESLint config at `js/.eslintrc.js` — ES2020, browser env, eslint:recommended. Globals include `L`, `define`, `require`, `module` for UMD compatibility.
