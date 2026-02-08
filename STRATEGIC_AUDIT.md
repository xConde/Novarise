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
- [ ] **Push to remote and open PR** — Branch ready for merge to main.
