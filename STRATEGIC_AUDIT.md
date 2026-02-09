# Strategic Audit — feat/velocity-tech-debt

**Date:** 2026-02-09
**Branch:** `feat/velocity-tech-debt`
**Sprint:** Founder Mode — Deep QA & Tech Debt Burn-down

---

## 1. MOMENTUM & ZOMBIES

### What shipped since last audit?

The editor-to-game play loop is **fully connected and merged to main**:
- "Play Map" button + Enter shortcut in editor
- "Back to Editor" in game HUD
- MapBridgeService state transfer validated
- Lazy-loaded modules: 259 kB initial bundle (down from 892 kB)
- 216 game tests, 181 editor tests, clean `ng build`

### What debt accumulated?

4 parallel deep-audit agents analyzed every `.ts`, `.html`, `.scss`, and `.spec.ts` file.
Total issues found: **~90 across 4 subsystems**.

---

## 2. THE GAP

**The single architectural blocker: Memory leaks and resource cleanup gaps in both Three.js components.**

### Critical Issues (Must Fix)

| # | Category | File | Issue |
|---|----------|------|-------|
| C1 | Memory leak | `novarise.component.ts:452-594` | 5 anonymous canvas event listeners (mousemove, touchstart, touchmove, touchend, touchcancel) cannot be removed in ngOnDestroy |
| C2 | Memory leak | `game-board.component.ts:147-195` | `restartGame()` doesn't dispose particles geometry/material or skybox before recreation |
| C3 | Memory leak | `game-board.service.ts:149,168` | `gridMaterial.clone()` creates 43+ material instances; parent material disposed but clones leak |
| C4 | Cleanup duplication | `game-board.component.ts:147-195 vs 651-740` | restartGame() and ngOnDestroy() have ~40 lines of duplicated cleanup logic |
| C5 | Type safety | `touch-detection.service.ts:61` | `(window as any).DocumentTouch` — only production `as any` cast |

### High Issues (Should Fix)

| # | Category | File | Issue |
|---|----------|------|-------|
| H1 | Missing tests | `edit-controls.component.ts` | No spec file — 6 @Output events, responsive behavior, tab navigation untested |
| H2 | Console logging | `map-storage.service.ts` | 15 console.log/warn/error calls in production service |
| H3 | Dead code | `editor-state.service.ts:155-176` | `getCursorForMode()` and `getColorForMode()` never called — duplicated inline in novarise.component.ts |
| H4 | Hardcoded colors | `app.component.css:13`, `novarise.component.scss:8` | Colors not using CSS custom properties from design system |
| H5 | Material type safety | `game-board.component.ts:164,676` | `(child.material as THREE.Material).dispose()` — no guard for material arrays |

### Medium Issues (Nice to Have)

| # | Category | File | Issue |
|---|----------|------|-------|
| M1 | File size | `novarise.component.ts` | 1632 lines — handles scene, editing, camera, input, persistence |
| M2 | File size | `game-board.component.ts` | 741 lines — mesh creation, interaction, animation loop |
| M3 | Accessibility | Templates | Missing `role` attributes on game HUD, tower selection, victory/defeat overlay |
| M4 | Missing route guard | `app-routing.module.ts` | No CanActivate guard validates spawn/exit exist before `/play` navigation |
| M5 | Subscription leak | `touch-detection.service.ts:34` | Constructor subscription never unsubscribed (root service, acceptable) |

---

## 3. THE BATTLE PLAN

### Sprint: Tech Debt Burn-down

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 1 | Fix anonymous canvas event listeners — store named refs, remove in ngOnDestroy | `novarise.component.ts` | CRITICAL |
| 2 | Fix restartGame() missing disposal — dispose particles + skybox before recreate | `game-board.component.ts` | CRITICAL |
| 3 | Fix grid material cloning — share single material instance across all lines | `game-board.service.ts` | CRITICAL |
| 4 | Extract shared cleanup method — deduplicate restartGame/ngOnDestroy | `game-board.component.ts` | CRITICAL |
| 5 | Remove `as any` — use proper type guard for DocumentTouch | `touch-detection.service.ts` | HIGH |
| 6 | Add material array guards — check Array.isArray before disposing | `game-board.component.ts` | HIGH |
| 7 | Remove dead EditorStateService methods — getCursorForMode/getColorForMode | `editor-state.service.ts` | HIGH |
| 8 | Strip console.log from production — replace with structured error handling | `map-storage.service.ts`, `enemy.service.ts` | HIGH |
| 9 | Extract hardcoded colors to CSS vars | `app.component.css`, `novarise.component.scss` | HIGH |
| 10 | Build + test verification | — | REQUIRED |

### Acceptance Criteria

- All 5 anonymous canvas listeners converted to named handler refs
- restartGame() disposes particles and skybox before recreation
- Grid lines share a single material instance (no .clone())
- Zero `as any` in production (non-test) code
- All material disposal uses array-safe guards
- `ng build` clean, `ng test` passes (known flakes excepted)

---

## Execution Log

### Fixes Applied

| # | Task | Status | Notes |
|---|------|--------|-------|
| C1 | Fix anonymous canvas event listeners | DONE | 5 listeners (mousemove, touchstart, touchmove, touchend, touchcancel) converted to named handler refs with proper cleanup in ngOnDestroy |
| C2 | Fix restartGame() missing disposal | DONE | Extracted `cleanupGameObjects()` shared method that disposes particles + skybox |
| C3 | Fix grid material cloning | DONE | Removed `.clone()` — all grid lines now share single `LineBasicMaterial` instance |
| C4 | Extract shared cleanup method | DONE | `cleanupGameObjects()` called by both `restartGame()` and `ngOnDestroy()` — eliminated ~40 lines of duplication |
| C5 | Remove `as any` | DONE | Replaced `(window as any).DocumentTouch` with `'DocumentTouch' in window` |
| H2 | Strip console.log | DONE | Removed 6 `console.log` calls from `MapStorageService`; kept `console.error`/`console.warn` for actual errors |
| H3 | Wire EditorStateService methods | DONE | Replaced inline color/cursor maps in mousemove handler with `editorState.getColorForMode()` and `getCursorForMode()` — zero dead code |
| H4 | CSS custom properties | DONE | Extracted 5 theme colors (`--theme-purple`, `--nav-bg`, etc.) to `:root`; updated `app.component.css` and `novarise.component.scss` |
| H5 | Material array guards | DONE | Added `disposeMaterial()` helper that handles both single and array material forms |
| BONUS | Fix ProxyZone crash | DONE | `touch-detection.service.spec.ts:252` — moved `fakeAsync()` from `describe()` callback to individual `it()` blocks. Recovered 3 previously unreachable tests. |

### Verification

- `ng build`: **Clean** — 259.55 kB initial, 0 errors
- `ng test`: **545 / 545 SUCCESS** (0 failures, 0 disconnects)
- Previous: 542 tests with ProxyZone crash killing runner — now all 545 pass
- Game module: 49.04 kB (down from 49.27 kB)

---
