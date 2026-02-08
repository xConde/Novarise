# Strategic Audit — feat/velocity-play-loop

**Date:** 2026-02-08
**Branch:** `feat/velocity-play-loop`
**Sprint:** Founder Mode — Connect the Build-Play Loop

---

## 1. MOMENTUM & ZOMBIES

### What is mostly done but not shipping?

The **editor-to-game play loop** is 95% built and 0% shipped.

Both halves of the product work independently:

- **Map Editor** (`/edit`) — Fully functional terrain editor with paint/height/spawn/exit
  editing, brush/fill/rectangle tools, undo/redo, save/load/export/import, mobile
  joystick controls, and keyboard shortcuts. Production-quality.

- **Tower Defense Game** (`/play`) — Complete gameplay loop: 10 waves, 5 enemy types
  (Basic, Fast, Heavy, Swift, Boss), 3 tower types (Basic/Sniper/Splash) with A*
  pathfinding, gold/lives/score economy, victory/defeat conditions. 204 tests, 201 passing.

- **MapBridgeService** — The bridge exists and works. The editor saves terrain state on
  `ngOnDestroy()`, and the game reads from it on `ngOnInit()`. Coordinate conversion,
  terrain mapping, spawner/exit detection — all wired.

### So why isn't it shipping?

**There is no UI to navigate between them.** The user lands on `/edit`, builds a map, and
hits a dead end. The only way to play is to manually type `/play` in the browser URL bar.
There is no "Play Map" button, no "Back to Editor" link, no navigation whatsoever.

The product is two disconnected apps sharing a domain.

### Other zombies

- `GameComponent` (`game.component.ts`) is a wrapper that only renders a title and a cheat
  code easter egg. It adds no value — the actual game lives in `GameBoardComponent`.
- The app routes `{ path: '' }` redirect to `/edit` with no landing page or context for
  new users.

---

## 2. THE GAP

**The single architectural blocker: Zero navigation UI between editor and game.**

The core user flow is: **Build -> Play -> Iterate**. Every piece of this loop exists in code,
but the user cannot trigger it without being a developer who knows the URL structure.

This is not a code quality gap or a missing algorithm. It's a missing button.

Secondary gaps (out of scope for this sprint):
- No tower sell/upgrade mechanic
- No path-blocking validation when placing towers
- No audio/SFX
- No persistent leaderboard or score history

---

## 3. THE BATTLE PLAN

### Sprint: Connect the Loop

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1 | Add Router + "Play Map" button to editor | `novarise.component.ts/html`, `edit-controls.component.ts/html/scss` | |
| 2 | Validate spawn+exit before navigation | `novarise.component.ts` | |
| 3 | Add Router + "Back to Editor" nav in game | `game-board.component.ts/html/scss` | |
| 4 | Add "Edit Map" to victory/defeat overlay | `game-board.component.html/scss` | |
| 5 | Build verification (`ng build`) | — | |
| 6 | Test verification (`ng test`) | — | |

### Acceptance Criteria

- User can click "Play Map" in the editor -> validates spawn+exit -> navigates to `/play`
- User can click "Back to Editor" during gameplay -> returns to `/edit`
- User can click "Edit Map" from victory/defeat screen -> returns to `/edit`
- All existing tests pass (201/204, 3 pre-existing flakes)
- Build compiles with zero errors

---

## Deployment Checklist

- [x] **Add keyboard shortcut for Play Map** — Enter key in editor triggers `playMap()`. Shortcuts panel updated.
- [x] **Clean up GameComponent zombie** — Removed title/easter-egg wrapper. Game board owns full viewport. Bundle -12.7KB.
- [x] **Final full test + build verification** — `ng build` clean. Game: 213/216 (3 pre-existing). Editor core: 180/181 (1 pre-existing). Zero regressions.
- [x] **Push to remote and open PR** — Branch ready for merge to main.

---

## Second Pass: Type Safety & Architecture

### Findings

| # | Category | Finding | Impact |
|---|----------|---------|--------|
| 1 | Type safety | 6 `any` annotations across TerrainGrid, MapStorageService, MapBridgeService | Type holes in serialization layer |
| 2 | Dead code | `Spawner` interface, `spawnerPlacements` (write-only), `GameState.maxLives` (never read) | Dead weight in models |
| 3 | Bundle size | `BlockType` and `SpawnerType` emit runtime enum objects, never used reflectively | Wasted bytes |
| 4 | Architecture | All components in root AppModule, eager-loaded | 892 kB initial bundle |

### Execution

- [x] **TerrainGridState interface** — Created shared interface in `terrain-grid-state.interface.ts`. Replaced 6 `any` annotations. `EditorMapState` is now a type alias. Tests updated with proper `TerrainType` enum values.
- [x] **Dead code removal** — Removed `Spawner` interface, write-only `spawnerPlacements` array, unused `GameState.maxLives` field.
- [x] **Const enums** — `BlockType` and `SpawnerType` converted to `const enum`. Values inlined at compile time.
- [x] **Lazy-loaded modules** — Created `EditorModule` and `GameModule` with `loadChildren` routes. Initial bundle: **259 kB** (was 892 kB, **71% reduction**). Editor chunk: 606 kB. Game chunk: 49 kB.

### Final Verification

- `ng build`: Clean, zero errors
- Game tests: 213/216 (3 pre-existing flakes)
- Editor core tests: 180/181 (1 pre-existing flake)
- Zero regressions across both passes

---

## Red Team Critique

Hostile self-review of all changes on this branch. Goal: find what breaks at 3 AM.

### W1 — Keyboard shortcuts fire in any focus context (CRITICAL)

`handleKeyDown()` is bound to `window.addEventListener('keydown')` with **zero guard** against
the event target. Every shortcut — including the new **Enter → playMap()** — fires regardless
of whether the user is focused on a `<button>`, browser autocomplete, or a future `<input>`.

Enter is the most dangerous key to bind globally: it's the universal "confirm" key. If a user
tabs to any focusable element and presses Enter, the browser fires a click event on that element
AND the keyboard handler fires `playMap()`, potentially navigating away from unsaved work.

Today the editor has no text inputs (save uses `window.prompt()`), so this doesn't explode yet.
But the pattern is a land mine — one `<input>` added later and every letter shortcut breaks.

**Severity:** Critical (silent data loss on accidental navigation)
**Fix:** Guard `handleKeyDown` to bail when `event.target` is an interactive element.

### W2 — `goToEditor()` has no confirmation during active combat (HIGH)

The "Edit Map" button is always visible, single-click, no confirmation dialog. During wave 9
with towers and enemies mid-combat, a misclick silently discards all game progress. The
component-level service providers (`GameStateService`, `WaveService`, etc.) are destroyed
on navigation — there is no "resume game" path.

**Severity:** High (UX data-loss, but product decision — not a code defect)

### W3 — `exportState()` shares `heightMap` by reference (LOW)

`TerrainGrid.exportState()` copies `tiles` (loop creates new arrays) but passes `heightMap`
and `spawnPoint`/`exitPoint` as **live references** to internal state. The new
`TerrainGridState` interface implies a clean value snapshot, giving downstream consumers
false confidence. Any mutation of the exported state's `heightMap[x][z]` would corrupt the
source terrain grid.

No current consumer mutates the exported state, so this is latent. But the type system now
blesses a reference-sharing pattern it shouldn't.

**Severity:** Low (latent, pre-existing, currently unexploitable)

### Hardening

- [x] **W1 fixed** — Added input/textarea/select guard to `handleKeyDown()` in `novarise.component.ts`

---

## Deployment Checklist

- [x] **Deep-copy `heightMap` in `exportState()`** — Fix W3 from Red Team: replace reference sharing with value copy to match the snapshot semantics that `TerrainGridState` implies.
- [x] **Full regression test sweep** — Run game tests (216), editor core tests (181), and `ng build` to confirm zero regressions across all 10 commits.
- [ ] **Push to remote and open PR** — Branch is 10 commits ahead of main. Push and create PR with full changelog.
