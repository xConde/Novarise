# Strategic Audit - Novarise Full Sweep (Sprint 2)

## 1. MOMENTUM & ZOMBIES

**Previous sprint delivered:**
- Phase A: Fixed all bugs (ghost shortcuts, memory leak, tower stacking)
- Phase B: Angular Router wired, game module registered, `/edit` and `/play` routes live
- Red Team: Hardened stale closure crash in EditHistoryService, removed dead viewport code

**Current state — what's built but not shipping:**

The editor and game are navigable but share **ZERO data**. They are two isolated systems behind a nav bar.

| System | Status | Gap |
|--------|--------|-----|
| Map Editor (`/edit`) | Fully functional — paint, height, spawn/exit, save/load, undo/redo, mobile controls | Builds maps that nothing consumes |
| Tower Defense (`/play`) | Functional — tower placement, A* pathfinding, 5 enemy types, 3 tower types | Uses hardcoded 25x20 board, ignores all editor maps |

The editor exports `{ gridSize, tiles[][], heightMap[][], spawnPoint, exitPoint }` via `TerrainGrid.exportState()`. The game's `GameBoardService` has no method to accept external data — its constructor hardcodes `generateBaseBoard()`, `generateExitTiles()`, `generateSpawner()`.

**Remaining zombies from Red Team:**
- GameBoardService singleton leaks tower state across route transitions (ghost towers)

## 2. THE GAP

**The single architectural blocker: No data bridge between editor and game.**

The editor builds maps with 4 terrain types, spawn/exit points, and a buildable grid — *explicitly designed for tower defense*. The game runs A* pathfinding on a board with traversable/non-traversable tiles, spawners, and exits — *exactly what the editor produces*. But there is no conversion layer between them.

**Specific technical gaps:**
1. No service to convert `TerrainType` → `BlockType` (editor → game data model)
2. `GameBoardService` has no `importBoard()` method — dimensions are `private readonly`
3. No mechanism to transfer map state across route transitions
4. `BlockType` enum lacks a `WALL` type for non-traversable terrain (CRYSTAL/ABYSS)
5. GameBoardService singleton never resets, causing ghost towers on re-navigation

## 3. THE BATTLE PLAN

### Phase C: Bridge Editor Maps to Game

**Step 1: Extend the game data model**
- [x] Add `BlockType.WALL` to `game-board-tile.ts` with `createWall()` factory
- [x] Update `GameBoardService.getTileColor()` to render WALL tiles

**Step 2: Create MapBridgeService**
- [x] New `providedIn: 'root'` service at `src/app/game/game-board/services/map-bridge.service.ts`
- [x] `setEditorMapState(state)` — stores terrain export for cross-route transfer
- [x] `convertToGameBoard(state)` — terrain type → BlockType conversion with coordinate transform
- [x] Mapping: BEDROCK/MOSS → BASE (traversable), CRYSTAL/ABYSS → WALL (non-traversable)
- [x] Spawn/exit point conversion from editor `{x, z}` to game `[row, col]`

**Step 3: Make GameBoardService accept external boards**
- [x] Add `importBoard(board, width, height)` method
- [x] Add `resetBoard()` to fix ghost tower singleton leak
- [x] Remove `readonly` from dimension fields so imports can set them

**Step 4: Wire the data flow**
- [x] `NovariseComponent.ngOnDestroy()` → save `terrainGrid.exportState()` to MapBridgeService
- [x] `GameBoardComponent.ngOnInit()` → check MapBridgeService, import or reset board
- [x] Write comprehensive unit tests for MapBridgeService (23 tests)

## Previous Sprint Log

### Phase A: Fix All Bugs & Stale References (DONE)
- [x] Remove "S - Smooth" from shortcuts panel
- [x] Add missing shortcuts: Ctrl+Z/Y, Ctrl+E/O, G/L
- [x] Fix memory leak in EditControlsComponent
- [x] Fix `GameBoardService.placeTower()` to mark tiles as occupied

### Phase B: Wire Up The Game Module (DONE)
- [x] Register GameComponent and GameBoardComponent in AppModule
- [x] Configure Angular Router with `/edit` and `/play` routes
- [x] Replace hardcoded `<app-novarise>` with `<router-outlet>`
- [x] Add navigation between editor and game modes

### Red Team Hardening (DONE)
- [x] Fix stale closure crash: clear EditHistoryService on component destroy
- [x] Remove dead `updateViewportVariable()` code

## Red Team Critique (Sprint 2 — Phase C Review)

Hostile review of the MapBridgeService integration and data flow wiring.

### CRITICAL: Zombie Animation Loops in Both Components

**Kill chain:** `/edit` → `/play` → `/edit` → **N zombie `requestAnimationFrame` loops running permanently**.

Both `NovariseComponent.animate()` (line 1501) and `GameBoardComponent.animate()` (line 491) call `requestAnimationFrame(this.animate)` at the TOP of the method without storing the return value. Neither `ngOnDestroy()` calls `cancelAnimationFrame()`.

When a component is destroyed via route navigation, the next queued animation callback still fires (it was already scheduled). It calls `requestAnimationFrame(this.animate)` again, perpetuating the loop forever. The arrow function captures `this`, pinning the entire component instance — including its disposed Three.js scene, renderer, meshes, and materials — in memory permanently.

After N round trips between `/edit` and `/play`, **2N animation loops** are running simultaneously, each calling `composer.render()` on disposed renderers. This is an ever-growing CPU and memory leak that degrades the application with every navigation.

**This was a latent bug made critical by routing (Phase B) and now elevated to the primary user flow by the bridge (Phase C).** Before routing, components were never destroyed, so the loop ran exactly once.

**Fix:** Store the animation frame ID. Cancel it at the top of `ngOnDestroy()` in both components.

### MODERATE: Resize Listeners Leak in Both Components

`NovariseComponent.initializeRendererAndViewport()` adds TWO resize handlers (window + visualViewport) as local `const resizeHandler` variables — never stored on the instance, never removed in `ngOnDestroy()`.

`GameBoardComponent.initializeRenderer()` adds one anonymous resize handler — also never removed.

Each navigation cycle stacks additional listeners that fire on window resize and call `this.renderer.setSize()` on disposed renderers. Not a crash (the disposed renderer silently ignores the call in most browsers), but a growing listener leak.

**Fix:** Store resize handlers as instance properties. Remove in `ngOnDestroy()`.

### MINOR: GameBoardService Constructor Double-Generation

`GameBoardService` is an AppModule singleton. Its constructor immediately runs `generateBaseBoard()`, `generateExitTiles()`, `generateSpawner()`. On first navigation to `/play`, `ngOnInit()` immediately calls either `importBoard()` or `resetBoard()`, discarding the constructor's work entirely. The initial board generation is wasted computation on every app load.

## Red Team Critique (Sprint 2 — Round 3)

Adversarial review focused on data integrity and silent failure modes in the bridge pipeline.

### CRITICAL: Unvalidated Bridge Import Creates Unplayable Game Boards

**Kill chain:** Cold start → `/edit` (default redirect, fresh blank map) → click "Play" → **game is a featureless grid with no enemies, no exit, no gameplay.**

`NovariseComponent.ngOnDestroy()` **always** snapshots the editor terrain to `MapBridgeService`, even when the map has no spawn point or exit point. `GameBoardComponent.ngOnInit()` checks `hasEditorMap()` → true → imports the blank map. The result is a 25×25 all-BASE board with zero SPAWNER tiles and zero EXIT tiles. `EnemyService.spawnEnemy()` silently returns null (`console.warn` only). The user sees a dead game with no feedback about why.

This is the **default user flow**: the app redirects to `/edit` on cold start. A user who never places spawn/exit and clicks Play hits this immediately. Pre-bridge, `/play` always loaded a functional hardcoded board. The bridge turns a reliable fallback into a trap.

**Additional silent failures:** Editor maps with all-WALL terrain (no traversable path), spawn surrounded by walls (A* returns empty), or spawn/exit at the same position all produce games that render but cannot function. No validation, no user feedback.

**Fix:** Validate the editor map in `GameBoardComponent.ngOnInit()` before importing. Require both `spawnPoint` and `exitPoint` to be non-null; fall back to `resetBoard()` otherwise.

### MODERATE: `exportState()` Returns `any` — No Type Safety at Bridge Boundary

`TerrainGrid.exportState()` has return type `any`. The bridge's `EditorMapState` interface defines the expected shape, but TypeScript cannot verify the contract at the call site:

```typescript
this.mapBridge.setEditorMapState(this.terrainGrid.exportState()); // any → EditorMapState
```

If `exportState()` ever changes its return shape (renames a field, changes a type), the bridge silently receives wrong data. No compile-time error. The game renders but terrain mapping produces incorrect results.

### MINOR: GameBoardComponent.ngOnDestroy() Cleanup Asymmetry

`NovariseComponent.ngOnDestroy()` thoroughly disposes brush meshes, rectangle previews, terrain grid, and renderer. `GameBoardComponent.ngOnDestroy()` only disposes the renderer — no `controls.dispose()`, no scene traversal for geometry/material disposal, no composer cleanup. Practically mitigated (renderer.dispose() kills the GL context, Angular DOM cleanup + GC handles the rest), but creates an inconsistent cleanup pattern that invites future resource leaks.

## Deployment Checklist

Concrete steps to take this from "started" to "shippable":

- [x] **1. Harden GameBoardComponent.ngOnDestroy()** — Dispose OrbitControls, traverse tileMeshes/towerMeshes Maps to dispose geometries and materials, dispose particle geometry/material, dispose EffectComposer render targets. Match NovariseComponent's cleanup rigor.
- [x] **2. Lazy-init GameBoardService constructor** — Remove eager board generation from constructor. The board is always replaced by `importBoard()` or `resetBoard()` in `ngOnInit()` before any rendering occurs, making the constructor work pure waste.
- [x] **3. Auto-save editor map on destroy** — Call `MapStorageService` to persist the current map to localStorage in `NovariseComponent.ngOnDestroy()` before terrain disposal. Prevents data loss when users navigate to `/play` and back.
- [x] **4. Unit tests for GameBoardService** — Cover `importBoard()`, `resetBoard()`, `canPlaceTower()`, `placeTower()`, and board dimension accessors. 29 tests, all passing.
