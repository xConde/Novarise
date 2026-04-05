# Hardening VIII — Repository Architecture Plan

> 50 sprints to straighten out and organize the Novarise repository for long-term health.
> Branch: `feat/hardening-viii`
> Created: 2026-04-05

---

## Executive Summary

### What This Is
A structural hardening pass focused on **code organization, decomposition, and maintainability** — not features, not gameplay, not visuals. Every sprint keeps all 4,024 tests green and introduces no behavioral changes.

### Why Now
Eight hardening branches have shipped gameplay, visuals, and content. The codebase works. But the organizational debt accumulated during rapid feature development now creates friction on every change:

- **Two god components** (2,398 + 1,721 LOC) concentrate too many concerns
- **12 root-scoped services** are scattered across feature modules instead of `core/`
- **3,534 lines of global CSS** in a single file
- **Deep import paths** (../../../../) due to missing barrel files
- **Duplicated patterns** (52+ disposal calls, inline spy creation) instead of shared utilities
- **Oversized services** (enemy.service.ts at 1,258 LOC) violating single responsibility
- **No linting tooling** — relying solely on TypeScript strict mode
- **Stale documentation** — ARCHITECTURE.md references outdated LOC counts

### Success Criteria
After all 50 sprints:
- No source file exceeds 800 LOC (currently: 2,398 max)
- No spec file exceeds 1,500 LOC (currently: 3,536 max)
- All root-scoped services live in `core/` or `shared/`
- All cross-module imports use path aliases (`@core/`, `@shared/`, etc.)
- styles.css split into organized partials under 500 LOC each
- ESLint configured and passing in CI
- All documentation reflects actual current state
- 4,024+ tests still passing, zero regressions

### Risk Profile
**Low.** Every sprint is a pure refactor — move code, extract services, rename imports. No logic changes. Tests are the safety net. If a sprint breaks tests, the fix is always "the refactor missed an import or provider."

---

## Current State Snapshot

### File Size Hotspots (LOC)

| File | LOC | Problem |
|------|-----|---------|
| `game-board.component.ts` | 2,398 | 35+ injected services, 60+ methods, handles input/rendering/combat/UI/pause/camera |
| `game-board.component.spec.ts` | 3,536 | Mirrors god component — untestable in isolation |
| `novarise.component.ts` | 1,721 | 55+ methods, mixes terrain editing/brush/file I/O/markers/modals |
| `enemy.service.ts` | 1,258 | Spawning + mesh creation + visual effects + combat damage + path management |
| `enemy.service.spec.ts` | 2,566 | Mirrors oversized service |
| `tower-combat.service.ts` | 862 | Dense but structured; `update()` at ~200 LOC |
| `tower-combat.service.spec.ts` | 2,264 | Mirrors combat service density |
| `styles.css` | 3,534 | All styles global, no component scoping |
| `profile.component.scss` | 455 | Large for a single component |
| `map-storage.service.ts` | 450 | Root-scoped but buried in `games/novarise/core/` |

### Structural Issues

| Issue | Impact | Files Affected |
|-------|--------|----------------|
| Root-scoped services in wrong locations | Confusing DI, deep imports | 12 services |
| No barrel files (index.ts) | Verbose imports, tight coupling | ~100+ import sites |
| No path aliases | Deep relative paths (../../../../) | ~10 cross-module files |
| Duplicated disposal patterns | Maintenance burden, inconsistency | 14 files, 52+ calls |
| `shared/utils/` underutilized | Cross-cutting utils buried in features | 1 file (focus-trap only) |
| Service-level public types | Types not discoverable in models | ~15 inline type defs |
| No ESLint | Quality depends on human memory | All files |
| Stale docs | Misleading LOC counts, completed items in backlog | 3 doc files |

---

## Phase Overview

| Phase | Sprints | Focus | Key Metric |
|-------|---------|-------|------------|
| 1: Shared Infrastructure | S1–S7 | Core module, barrel files, path aliases, shared utilities | Import depth ≤ 2 levels |
| 2: Game Board Decomposition | S8–S18 | Break apart 2,398 LOC god component | Component ≤ 800 LOC |
| 3: Editor Decomposition | S19–S25 | Break apart 1,721 LOC editor component | Component ≤ 800 LOC |
| 4: Service Decomposition | S26–S32 | Break apart oversized services | No service > 600 LOC |
| 5: CSS Architecture | S33–S38 | Split 3,534 LOC global stylesheet | No CSS file > 500 LOC |
| 6: Type System & Code Quality | S39–S43 | Extract inline types, remove dead code | Zero inline public types |
| 7: Test Architecture | S44–S47 | Decompose large specs, consolidate helpers | No spec > 1,500 LOC |
| 8: Infrastructure & Docs | S48–S50 | ESLint, docs refresh, Angular upgrade prep | CI enforces lint |

---

## Phase 1: Shared Infrastructure (S1–S7)

> Establish the organizational foundation that all subsequent phases depend on.
> These sprints MUST run first — later phases import from the locations created here.

### S1: Core Module Foundation

**Goal:** Create a proper `core/` directory for app-wide singleton services.

**Changes:**
- Create `src/app/core/services/` directory
- Move `error-handler.service.ts` → `core/services/`
- Move `storage.service.ts` from `game/game-board/services/` → `core/services/`
- Move `settings.service.ts` from `game/game-board/services/` → `core/services/`
- Update all imports across the codebase (automated find-replace)
- Verify all module providers still resolve

**Files touched:** ~15–20 (import updates)
**Tests:** All 4,024 must pass
**Risk:** Low — pure file moves + import rewrites

---

### S2: Core Services Migration — Game Board Root-Scoped

**Goal:** Move remaining root-scoped services out of `game/game-board/services/`.

**Changes:**
- Move `player-profile.service.ts` → `core/services/`
- Move `map-bridge.service.ts` → `core/services/`
- Move `audio.service.ts` → `core/services/` (root-scoped, used by game + potentially editor)
- Move `tutorial.service.ts` → `core/services/`
- Update all imports

**Files touched:** ~25–30
**Tests:** All pass
**Risk:** Low — same pattern as S1

---

### S3: Core Services Migration — Editor Root-Scoped

**Goal:** Move root-scoped services out of `games/novarise/core/`.

**Changes:**
- Move `map-storage.service.ts` → `core/services/`
- Move `map-schema.ts` → `core/models/` (create directory)
- Move `map-share.service.ts` → `core/services/`
- Move `map-template.service.ts` → `core/services/`
- Move `map-template.model.ts` → `core/models/`
- Move `touch-detection.service.ts` from `games/novarise/features/mobile-controls/services/` → `core/services/`
- Update all imports

**Files touched:** ~20–25
**Tests:** All pass
**Risk:** Low — editor services have fewer consumers than game services

---

### S4: Shared Utilities — Three.js Disposal

**Goal:** Eliminate 52+ duplicated disposal calls with a shared utility.

**Changes:**
- Create `shared/utils/three-disposal.util.ts`:
  - `disposeMesh(mesh)` — disposes geometry + material (handles Material[])
  - `disposeObject3D(obj)` — recursive traverse + dispose
  - `disposeMaterialSafe(mat)` — handles Material | Material[] (move from existing `three-utils.ts`)
- Move `three-utils.ts` from `game/game-board/utils/` → `shared/utils/`
- Replace inline disposal patterns across 14 files with utility calls
- Add comprehensive tests for disposal utilities

**Files touched:** ~16–18
**Tests:** All pass + new disposal utility tests
**Risk:** Low — disposal is well-understood, utility is straightforward

---

### S5: Barrel Files — Game Module

**Goal:** Create index.ts exports for game subdirectories to simplify imports.

**Changes:**
- Create `game/game-board/models/index.ts` — export all model interfaces, enums, configs
- Create `game/game-board/constants/index.ts` — export all constant configs
- Create `game/game-board/utils/index.ts` — export all utilities
- Create `game/game-board/testing/index.ts` — already exists, verify completeness
- Update internal imports where paths simplify (prefer barrel over deep paths)

**Files touched:** ~30–40 (import simplifications)
**Tests:** All pass
**Risk:** Low — barrel files are additive, existing imports still work

---

### S6: Barrel Files — Campaign & Editor

**Goal:** Create index.ts exports for campaign and editor modules.

**Changes:**
- Create `campaign/models/index.ts`
- Create `campaign/services/index.ts`
- Create `games/novarise/core/index.ts`
- Create `games/novarise/constants/index.ts`
- Create `core/services/index.ts` (for the new core location)
- Create `core/models/index.ts`
- Fix deep import paths — `../../../../campaign/models/` becomes `../../../../campaign/models`

**Files touched:** ~20–25
**Tests:** All pass
**Risk:** Low

---

### S7: TypeScript Path Aliases

**Goal:** Replace deep relative imports with readable aliases.

**Changes:**
- Add to `tsconfig.json` paths:
  - `@core/*` → `src/app/core/*`
  - `@shared/*` → `src/app/shared/*`
  - `@game/*` → `src/app/game/*`
  - `@editor/*` → `src/app/games/novarise/*`
  - `@campaign/*` → `src/app/campaign/*`
- Update cross-module imports to use aliases (prioritize files with ../../../../ paths)
- Verify `ng build --configuration=production` still works
- Verify `ng test` still works (Karma needs alias resolution)

**Files touched:** ~15–20 cross-module imports
**Tests:** All pass + production build succeeds
**Risk:** Medium — Karma/webpack alias resolution needs verification. Revert if build breaks.

---

## Phase 2: Game Board Decomposition (S8–S18)

> Incrementally extract concerns from the 2,398 LOC god component.
> Each sprint extracts one cohesive group of methods into a new service.
> Target: game-board.component.ts ≤ 800 LOC after S18.

### S8: Extract GameInputService

**Goal:** Move keyboard handling and hotkey management out of the component.

**Extract from game-board.component.ts:**
- `handleKeyboard()` (~85 LOC) — complex keybinding dispatcher
- `setupKeyboardControls()` (~17 LOC) — event listener setup

**New file:** `game/game-board/services/game-input.service.ts`
**Pattern:** Service owns keydown handler, exposes Observable<KeyAction> or callback registration. Component subscribes and delegates to appropriate services.

**Also:**
- Extract hotkey bindings to `constants/input.constants.ts` (HOTKEY_CONFIG)
- Remove keyboard logic from component

**LOC reduction:** ~100 from component
**Tests:** New `game-input.service.spec.ts` + update component spec
**Risk:** Low — keyboard events are self-contained

---

### S9: Extract CameraPanService

**Goal:** Move camera pan computation out of the component.

**Extract from game-board.component.ts:**
- `updateCameraPan()` (~115 LOC) — screen-relative pan computation with boundary clamping

**New file:** `game/game-board/services/camera-pan.service.ts`
**Pattern:** Service takes camera reference + pan inputs, computes new position each frame.

**LOC reduction:** ~115 from component
**Tests:** New spec + update component spec
**Risk:** Low — pure math + camera mutation, no side effects

---

### S10: Extract TowerPlacementService

**Goal:** Move drag-and-drop tower placement out of the component.

**Extract from game-board.component.ts:**
- `onTowerDragStart()` (~48 LOC)
- `onDragMove()` (~40 LOC)
- `onDragEnd()` (~37 LOC)
- `cancelDrag()` (~8 LOC)
- `removeDragListeners()` (~9 LOC)
- `tryPlaceTower()` (~37 LOC)
- `selectTowerType()` (~10 LOC)
- `cancelPlacement()` (~10 LOC)

**New file:** `game/game-board/services/tower-placement.service.ts`
**Pattern:** Service manages placement state (selectedTowerType, isDragging, dragThreshold). Component calls `service.startDrag()`, `service.tryPlace()`, etc. Service emits placement events.

**LOC reduction:** ~200 from component
**Tests:** New spec + update component spec
**Risk:** Medium — drag state is coupled to DOM events. Needs careful event listener management.

---

### S11: Extract GamePauseService

**Goal:** Centralize pause/resume/quit logic.

**Extract from game-board.component.ts:**
- `togglePause()` (~17 LOC)
- `setupAutoPause()` (~7 LOC)
- `canLeaveGame()` (~25 LOC)
- `requestQuit()` / `confirmQuit()` / `cancelQuit()` (~15 LOC)
- `onPauseOverlayClick()` (~4 LOC)

**New file:** `game/game-board/services/game-pause.service.ts`
**Pattern:** Service owns isPaused, isQuitPending state. Delegates to GameStateService for phase transitions. Component binds to service observables.

**LOC reduction:** ~70 from component
**Tests:** New spec + update component spec
**Risk:** Low — pause is well-isolated

---

### S12: Consolidate Tower Upgrade into TowerInteractionService

**Goal:** Move upgrade/sell/specialization logic into the existing TowerInteractionService.

**Extract from game-board.component.ts:**
- `upgradeTower()` (~57 LOC) — upgrade logic with specialization branching
- `sellTower()` (~39 LOC) — sell with double-click confirm
- `applySpecializationVisual()` (~16 LOC)

**Modify:** `game/game-board/services/tower-interaction.service.ts` (currently 252 LOC)
**Pattern:** TowerInteractionService already handles place/sell/upgrade business logic. These component methods are the remaining upgrade orchestration that should live there.

**LOC reduction:** ~110 from component
**Tests:** Update tower-interaction.service.spec.ts + component spec
**Risk:** Low — TowerInteractionService already owns this domain

---

### S13: Extract TowerSelectionService

**Goal:** Centralize tower inspection and selection state.

**Extract from game-board.component.ts:**
- `selectPlacedTower()` (~24 LOC)
- `refreshTowerInfoPanel()` (~19 LOC)
- `deselectTower()` (~10 LOC)
- `cycleTargeting()` (~6 LOC)
- Associated state: `selectedTower`, `selectedTowerInfo`, `selectedTowerStats`, `upgradePreview`, `showSpecializationChoice`, `specOptions`

**New file:** `game/game-board/services/tower-selection.service.ts`
**Pattern:** Service owns selection state as BehaviorSubjects. Component binds template to service observables. TowerInfoPanel child component reads from service.

**LOC reduction:** ~60 from component
**Tests:** New spec + update component spec
**Risk:** Low — selection is read-heavy, few side effects

---

### S14: Extract ChallengeDisplayService

**Goal:** Move challenge indicator computation out of the component.

**Extract from game-board.component.ts:**
- `updateChallengeIndicators()` (~15 LOC)
- `buildIndicator()` (~35 LOC) — per-challenge progress computation
- `isChallengeAlreadyCompleted()` / `isChallengeCompleted()` (~4 LOC)
- Associated state: `challengeIndicators` array

**New file:** `game/game-board/services/challenge-display.service.ts`
**Pattern:** Service computes indicator state from ChallengeTrackingService snapshots. Exposes `indicators$` observable.

**LOC reduction:** ~55 from component
**Tests:** New spec + update component spec
**Risk:** Low — pure computation

---

### S15: Consolidate Restart into GameSessionService

**Goal:** Move restart/cleanup orchestration into the existing GameSessionService.

**Extract from game-board.component.ts:**
- `restartGame()` (~75 LOC) — full reset orchestration
- `cleanupGameObjects()` (~75 LOC) — Three.js disposal sweep

**Modify:** `game/game-board/services/game-session.service.ts` (currently ~120 LOC)
**Pattern:** GameSessionService already owns `resetAllServices()`. Move the full restart sequence (including Three.js cleanup and re-init) there. Component calls `gameSession.restart()`.

**LOC reduction:** ~150 from component
**Tests:** Update game-session.service.spec.ts + component spec
**Risk:** Medium — cleanup touches scene objects owned by multiple services. Need to verify disposal order.

---

### S16: Simplify Interaction Setup

**Goal:** Refactor the 74+91 LOC interaction setup methods to delegate to extracted services.

**Refactor in game-board.component.ts:**
- `setupMouseInteraction()` (~74 LOC) → Thin delegation to TowerPlacementService (drag), TowerSelectionService (click), TowerPreviewService (hover)
- `setupTouchInteraction()` (~91 LOC) → Same delegation for touch events
- `handleInteraction()` (~58 LOC) → Route to TowerPlacementService or TowerSelectionService based on mode

**LOC reduction:** ~120 from component (delegation replaces inline logic)
**Tests:** Update component spec
**Risk:** Medium — interaction dispatch is the component's core responsibility; must ensure no event handling gaps

---

### S17: Enrich MinimapService

**Goal:** Move minimap orchestration logic into MinimapService.

**Extract from game-board.component.ts:**
- `buildMinimapTerrainCache()` (~18 LOC)
- `updateMinimap()` (~20 LOC)
- Minimap-related state management

**Modify:** `game/game-board/services/minimap.service.ts`
**Pattern:** MinimapService already owns canvas rendering. Move terrain cache building and per-frame update orchestration inside. Component just calls `minimapService.update()` in the animation loop.

**LOC reduction:** ~40 from component
**Tests:** Update minimap.service.spec.ts + component spec
**Risk:** Low

---

### S18: Game Board Cleanup & Spec Decomposition

**Goal:** Final pass on game-board.component.ts + split the 3,536 LOC spec file.

**Component cleanup:**
- Verify component is ≤ 800 LOC (should be ~700–800 after S8–S17 removed ~1,020 LOC)
- Extract any remaining >20 LOC methods to appropriate services
- Remove dead private methods left behind from extractions
- Update constructor injection list (remove services no longer directly used)

**Spec decomposition:**
- game-board.component.spec.ts (3,536 LOC) → split along extracted service boundaries
- Move keyboard tests → game-input.service.spec.ts
- Move camera tests → camera-pan.service.spec.ts
- Move drag tests → tower-placement.service.spec.ts
- Move pause tests → game-pause.service.spec.ts
- Move challenge tests → challenge-display.service.spec.ts
- Keep only component-level integration tests in component spec

**Target:** component spec ≤ 1,500 LOC
**Tests:** Same count, redistributed across files
**Risk:** Low — pure test reorganization

---

## Phase 3: Editor Decomposition (S19–S25)

> Incrementally extract concerns from the 1,721 LOC editor component.
> Target: novarise.component.ts ≤ 800 LOC after S25.

### S19: Extract TerrainEditService

**Goal:** Move terrain painting logic out of the component.

**Extract from novarise.component.ts:**
- `applyEdit()` (~110 LOC) — multi-tool dispatcher (paint, fill, rectangle)
- `trackTileForUndo()` (~16 LOC)
- `flashTileEdit()` (~38 LOC)
- `flashMarkerRejection()` (~9 LOC)
- `floodFill()` (~77 LOC)

**New file:** `games/novarise/core/terrain-edit.service.ts`
**Pattern:** Service takes terrain grid reference, applies edits, coordinates with EditHistoryService for undo. Component calls `terrainEdit.applyBrush(tile, mode)`.

**LOC reduction:** ~250 from component
**Tests:** New spec
**Risk:** Low — terrain editing is well-defined

---

### S20: Extract BrushPreviewService

**Goal:** Move brush indicator and preview mesh management out of the component.

**Extract from novarise.component.ts:**
- `createBrushIndicator()` (~21 LOC)
- `updateBrushPreview()` (~40 LOC)
- `updateBrushPreviewPositions()` (~32 LOC)
- `hideBrushPreview()` (~6 LOC)
- `getAffectedTiles()` (~30 LOC)

**New file:** `games/novarise/core/brush-preview.service.ts`
**Pattern:** Service owns brush indicator mesh and preview meshes. Adds/removes from scene. Component calls `brushPreview.update(position)` on mousemove.

**LOC reduction:** ~130 from component
**Tests:** New spec
**Risk:** Low — preview is visual-only, no state side effects

---

### S21: Extract RectangleToolService

**Goal:** Move rectangle selection and fill out of the component.

**Extract from novarise.component.ts:**
- `fillRectangle()` (~79 LOC)
- `updateRectanglePreview()` (~58 LOC)
- `clearRectanglePreview()` (~12 LOC)

**New file:** `games/novarise/core/rectangle-tool.service.ts`
**Pattern:** Service manages rectangle state (start corner, end corner, preview meshes). Component calls `rectangleTool.start()`, `rectangleTool.update()`, `rectangleTool.apply()`.

**LOC reduction:** ~150 from component
**Tests:** New spec
**Risk:** Low

---

### S22: Extract MapFileService

**Goal:** Move file I/O and autosave logic out of the component.

**Extract from novarise.component.ts:**
- `saveGridState()` (~12 LOC)
- `promptForMapNameAndSave()` (~20 LOC)
- `loadGridState()` (~33 LOC)
- `tryLoadCurrentMap()` (~20 LOC)
- `loadTemplate()` (~23 LOC)
- `exportCurrentMap()` (~16 LOC)
- `importMapFromFile()` (~83 LOC)
- `startAutosave()` / `saveDraft()` / `clearDraft()` / `loadDraft()` (~37 LOC)

**New file:** `games/novarise/core/map-file.service.ts`
**Pattern:** Service wraps MapStorageService with component-level concerns (autosave, draft, name prompting). Component calls `mapFile.save()`, `mapFile.load()`, etc.

**LOC reduction:** ~244 from component
**Tests:** New spec
**Risk:** Low — file I/O is well-isolated

---

### S23: Extract SpawnExitMarkerService

**Goal:** Move spawn/exit marker mesh management out of the component.

**Extract from novarise.component.ts:**
- `createSpawnExitMarkers()` (~6 LOC)
- `createSpawnMarkerMesh()` (~17 LOC)
- `createExitMarkerMesh()` (~18 LOC)
- `updateSpawnMarkers()` / `updateExitMarkers()` (~60 LOC)
- `updateSpawnMarker()` / `updateExitMarker()` (~8 LOC)

**New file:** `games/novarise/core/spawn-exit-marker.service.ts`
**Pattern:** Service creates and manages marker meshes. Adds to/removes from scene. Component calls `markers.rebuild()` after spawn/exit changes.

**LOC reduction:** ~110 from component
**Tests:** New spec
**Risk:** Low

---

### S24: Editor Component Cleanup

**Goal:** Final pass on novarise.component.ts.

**Changes:**
- Verify component is ≤ 800 LOC (should be ~837 after S19–S23 removed ~884 LOC)
- Extract any remaining >20 LOC methods
- Simplify `setupInteraction()` to delegate to extracted services
- Simplify `handleKeyDown()` to delegate to services
- Remove dead code from extractions
- Update constructor injections

**Tests:** All pass
**Risk:** Low

---

### S25: Editor Spec Decomposition

**Goal:** Split novarise.component.spec.ts along extracted service boundaries.

**Changes:**
- Move terrain editing tests → terrain-edit.service.spec.ts
- Move brush preview tests → brush-preview.service.spec.ts
- Move rectangle tests → rectangle-tool.service.spec.ts
- Move file I/O tests → map-file.service.spec.ts
- Move marker tests → spawn-exit-marker.service.spec.ts
- Keep component-level integration tests in component spec

**Tests:** Same count, redistributed
**Risk:** Low

---

## Phase 4: Service Decomposition (S26–S32)

> Break apart oversized services. Target: no service exceeds 600 LOC.

### S26: Extract EnemyMeshFactoryService

**Goal:** Extract mesh creation from enemy.service.ts, matching the TowerMeshFactoryService pattern.

**Extract from enemy.service.ts (1,258 LOC):**
- `createEnemyMesh()` (~72 LOC)
- `createEnemyGeometry()` (~37 LOC)
- `createBossCrown()` (~20 LOC)
- `createShieldMesh()` (~23 LOC)
- `removeShieldMesh()` (~16 LOC)
- `createMiniSwarmMesh()` (~43 LOC)

**New file:** `game/game-board/services/enemy-mesh-factory.service.ts`
**Pattern:** Pure factory — creates meshes based on EnemyType. No state. Follows TowerMeshFactoryService precedent.

**LOC reduction:** ~210 from enemy.service.ts
**Tests:** New spec
**Risk:** Low — mesh creation is stateless

---

### S27: Extract EnemyVisualService

**Goal:** Extract status particle and animation logic from enemy.service.ts.

**Extract from enemy.service.ts:**
- `updateStatusVisuals()` (~31 LOC)
- `updateStatusEffectParticles()` (~75 LOC)
- `createStatusParticles()` (~23 LOC)
- `removeStatusParticles()` (~19 LOC)
- `resetStatusParticlePosition()` (~31 LOC)
- `tintChildMeshes()` (~17 LOC)
- `getStatusParticleGeometry()` / `getStatusParticleMaterial()` (~17 LOC)
- `updateEnemyAnimations()` (~10 LOC)

**New file:** `game/game-board/services/enemy-visual.service.ts`
**Pattern:** Service manages enemy visual effects per frame. Called from the animation loop. Owns shared particle geometry/materials.

**LOC reduction:** ~225 from enemy.service.ts
**Tests:** New spec
**Risk:** Low — visual effects are read-only against enemy state

---

### S28: Extract EnemyHealthService

**Goal:** Extract health/damage/death visual logic from enemy.service.ts.

**Extract from enemy.service.ts:**
- `updateHealthBars()` (~33 LOC)
- `startHitFlash()` / `updateHitFlashes()` (~40 LOC)
- `startDyingAnimation()` / `updateDyingAnimations()` (~50+ LOC)

**New file:** `game/game-board/services/enemy-health.service.ts`
**Pattern:** Service manages health bar meshes, hit flash state, and dying animations. Called per frame.

**LOC reduction:** ~125 from enemy.service.ts
**Tests:** New spec
**Risk:** Low

---

### S29: Enemy Service Cleanup

**Goal:** Verify enemy.service.ts is under 600 LOC and clean up.

**Changes:**
- Verify LOC target (~698 remaining after S26–S28 removed ~560)
- If still over 600: extract `spawnMiniSwarm()` and swarm logic (~50 LOC) into EnemyMeshFactoryService or new SwarmService
- Remove dead private methods
- Update constructor injection list
- Update ARCHITECTURE.md enemy service entry

**Tests:** All pass
**Risk:** Low

---

### S30: Split tower-combat.service.ts update() Method

**Goal:** Break the ~200 LOC `update()` method into named phases.

**Refactor in tower-combat.service.ts (862 LOC):**
- Extract `updateTowerFiring()` — per-tower targeting + projectile creation
- Extract `updateProjectileMovement()` — projectile physics + collision
- Extract `updateMortarZones()` — DoT zone lifecycle
- Keep `update()` as thin orchestrator calling the three phases

**LOC reduction:** Net zero (internal restructure), but readability greatly improved
**Tests:** All pass — behavior unchanged
**Risk:** Low — pure internal method extraction

---

### S31: Extract ChainLightningService

**Goal:** Move chain lightning logic out of tower-combat.service.ts.

**Extract from tower-combat.service.ts:**
- `fireChainLightning()` (~64 LOC)
- `findChainTarget()` (~24 LOC)

**New file:** `game/game-board/services/chain-lightning.service.ts`
**Pattern:** Service handles chain targeting logic and damage application. TowerCombatService calls `chainLightning.fire(tower, target)` for Chain towers.

**LOC reduction:** ~90 from tower-combat.service.ts
**Tests:** New spec
**Risk:** Low — chain logic is self-contained

---

### S32: Tower Combat Cleanup

**Goal:** Verify tower-combat.service.ts is under 600 LOC.

**Changes:**
- Verify LOC target (~772 remaining after S31 removed 90)
- If still over 600: extract `applySlowAura()` (~17 LOC) + mortar zone creation (~51 LOC) into dedicated services
- Otherwise: internal cleanup only
- Update ARCHITECTURE.md

**Tests:** All pass
**Risk:** Low

---

## Phase 5: CSS Architecture (S33–S38)

> Split the 3,534 LOC global stylesheet into organized partials.
> Target: no CSS file exceeds 500 LOC, clear domain boundaries.

### S33: CSS Variable Audit & Cleanup

**Goal:** Extract remaining hardcoded values to CSS custom properties.

**Changes:**
- Extract ~15 hardcoded hex colors (`#fff`, `#4caf50`, `#f44336`) to named variables
- Standardize font sizes — map `.6rem`, `.65rem` to existing scale or create `--font-size-4xs`
- Replace ~10 hardcoded transitions with `var(--transition-*)` variables
- Extract repeated `rgba(20, 20, 35, ...)` patterns to alpha variants

**Files touched:** styles.css only
**Tests:** Visual regression check (manual), build budget check
**Risk:** Low — CSS-only changes

---

### S34: Split styles.css — Foundation Layer

**Goal:** Extract foundation styles into partials.

**Changes:**
- Create `src/styles/` directory
- Extract `_variables.scss` — all `:root` custom properties (~185 LOC)
- Extract `_base.scss` — reset, body, scrollbar, focus-visible, skip-link (~100 LOC)
- Extract `_animations.scss` — all @keyframes definitions (~150 LOC)
- Extract `_utilities.scss` — reduced-motion, hover-none media queries (~50 LOC)
- Update `styles.css` to `@import` partials
- Update angular.json if needed

**LOC reduction:** ~485 from styles.css
**Tests:** Build budget check, visual check
**Risk:** Low — SCSS import mechanics are well-understood

---

### S35: Split styles.css — Game Styles

**Goal:** Extract game-board related styles.

**Changes:**
- Extract `_game-board.scss` — board container, tower bar, game controls (~400 LOC)
- Extract `_game-hud.scss` — HUD, wave preview, notifications (~300 LOC)
- Extract `_game-overlays.scss` — pause, results, setup panel, encyclopedia (~400 LOC)

**LOC reduction:** ~1,100 from styles.css
**Tests:** Build budget check
**Risk:** Low

---

### S36: Split styles.css — Editor Styles

**Goal:** Extract editor-related styles.

**Changes:**
- Extract `_editor.scss` — editor layout, controls, terrain tools (~300 LOC)
- Extract `_editor-modals.scss` — inline modal overlays (~150 LOC)

**LOC reduction:** ~450 from styles.css
**Tests:** Build budget check
**Risk:** Low

---

### S37: Split styles.css — Page Styles

**Goal:** Extract per-route page styles.

**Changes:**
- Extract `_landing.scss` — landing page layout, backdrop, buttons (~200 LOC)
- Extract `_campaign.scss` — campaign grid, level cards, progress (~300 LOC)
- Extract `_profile.scss` — profile layout, achievement cards, settings (~200 LOC)
- Extract `_map-select.scss` — map grid, cards, actions (~150 LOC)

**LOC reduction:** ~850 from styles.css
**Tests:** Build budget check
**Risk:** Low

---

### S38: CSS Dead Code Audit

**Goal:** Find and remove unused CSS rules.

**Changes:**
- Audit each partial for rules with no matching selectors in templates
- Remove dead rules (e.g., `.close-button` rule with no template consumer)
- Verify no CSS file exceeds 500 LOC
- Verify total CSS within budget (30KB warn / 40KB error)
- Document CSS architecture in a comment at top of styles.css

**Tests:** Build budget check
**Risk:** Low — removal of dead rules

---

## Phase 6: Type System & Code Quality (S39–S43)

> Extract inline types, remove deprecated code, strengthen type safety.

### S39: Extract Service-Level Public Types to Models

**Goal:** Move public interfaces out of services into model files where they're discoverable.

**Types to extract:**
- `KillInfo` from tower-combat.service.ts → `combat-frame.model.ts`
- `CombatAudioEvent` from tower-combat.service.ts → `combat-frame.model.ts`
- `GameNotification` from game-notification.service.ts → new `game-notification.model.ts`
- `GameSettings` from settings.service.ts → new `settings.model.ts`
- `TilePriceInfo` from tile-pricing.service.ts → new or existing model
- `GameEndResult` from game-end.service.ts → `game-state.model.ts`
- `DamageResult` from enemy.service.ts → `enemy.model.ts`
- `ConvertedBoard` from map-bridge.service.ts → existing model
- `MinimapEntityData` / `MinimapTerrainData` from minimap.service.ts → new `minimap.model.ts`

**Pattern:** Leave private/internal types in services. Only extract types that appear in public method signatures or are consumed by other services.

**Files touched:** ~20
**Tests:** All pass
**Risk:** Low — pure type moves

---

### S40: Remove Deprecated Code

**Goal:** Clean out deprecated markers and dead code.

**Changes:**
- Remove deprecated `ENDLESS_CONFIG` from wave.model.ts (authoritative source is endless-wave.model.ts)
- Search for `@deprecated` markers across codebase and resolve each
- Search for `// removed`, `// dead code`, `// TODO: remove` comments and clean up
- Verify no exports are unused (barrel file audit)

**Files touched:** ~5–10
**Tests:** All pass
**Risk:** Low

---

### S41: Coordinate Utility Consolidation

**Goal:** Ensure all coordinate conversions use the shared utility.

**Changes:**
- Audit all inline coordinate math in services (world↔grid, editor↔game)
- Ensure `coordinate-utils.ts` covers all patterns
- Replace any inline conversions with utility calls
- Document the three coordinate systems in the utility file header

**Files touched:** ~5–8
**Tests:** All pass
**Risk:** Low

---

### S42: Enum Exhaustiveness Audit

**Goal:** Verify all switch statements over enums use assert-never for exhaustiveness.

**Changes:**
- Grep for `switch.*TowerType\|EnemyType\|TerrainType\|GamePhase\|DifficultyLevel\|ChallengeType\|StatusEffectType`
- Verify each switch has a `default: assertNever(x)` case
- Add missing exhaustiveness checks
- This prevents silent failures when new enum values are added

**Files touched:** ~10–15
**Tests:** All pass + compile-time safety improved
**Risk:** Low

---

### S43: TypeScript Strict Audit

**Goal:** Verify zero `any` types and maximum strict mode compliance.

**Changes:**
- `grep -r ': any\b'` across source (not spec) files — fix any found
- `grep -r 'as any'` — fix or document each cast
- Verify `noImplicitAny`, `strictNullChecks` are catching everything
- Check for `// @ts-ignore` or `// @ts-expect-error` — remove or replace with proper typing

**Files touched:** Variable
**Tests:** All pass
**Risk:** Low

---

## Phase 7: Test Architecture (S44–S47)

> Decompose large spec files, consolidate test helpers.

### S44: Consolidate Inline Spy Patterns

**Goal:** Extend test-spies.factory.ts to cover services that still use inline spy creation.

**Changes:**
- Audit the ~18 spec files with inline `jasmine.createSpyObj()` calls
- Add missing factory functions to test-spies.factory.ts:
  - `createTowerInteractionServiceSpy()`
  - `createTilePricingServiceSpy()`
  - `createGameEndServiceSpy()`
  - `createGameSessionServiceSpy()`
  - `createCombatLoopServiceSpy()`
  - `createWaveServiceSpy()`
  - `createTileHighlightServiceSpy()`
  - And any others for newly extracted services from Phase 2–4
- Replace inline spy creation in spec files with factory calls

**Files touched:** ~20
**Tests:** Same count, cleaner setup
**Risk:** Low

---

### S45: Enemy Service Spec Decomposition

**Goal:** Split the 2,566 LOC enemy.service.spec.ts along extracted service boundaries.

**Changes:**
- Move mesh creation tests → enemy-mesh-factory.service.spec.ts
- Move visual effect tests → enemy-visual.service.spec.ts
- Move health/damage tests → enemy-health.service.spec.ts
- Keep core spawning/movement tests in enemy.service.spec.ts

**Target:** No spec file > 1,000 LOC
**Tests:** Same count, redistributed
**Risk:** Low

---

### S46: Tower Combat Spec Decomposition

**Goal:** Split the 2,264 LOC tower-combat.service.spec.ts.

**Changes:**
- Move chain lightning tests → chain-lightning.service.spec.ts
- Move targeting tests → if TowerTargetingService was extracted
- Organize remaining tests into describe blocks by concern
- Target: spec ≤ 1,500 LOC

**Tests:** Same count
**Risk:** Low

---

### S47: Test Coverage Gap Audit

**Goal:** Ensure all new services from Phase 2–4 have comprehensive tests.

**Changes:**
- List all services created in S8–S32
- Verify each has a spec file with tests covering public API
- Add missing tests for edge cases
- Verify total test count ≥ 4,024 (should be higher with new service tests)

**Tests:** Should exceed 4,024
**Risk:** Low

---

## Phase 8: Infrastructure & Documentation (S48–S50)

> Finalize with tooling, documentation, and forward-looking prep.

### S48: ESLint Setup

**Goal:** Add ESLint to enforce code quality rules in CI.

**Changes:**
- Install `@angular-eslint/schematics` and configure
- Key rules:
  - `@typescript-eslint/no-explicit-any` — error
  - `@typescript-eslint/no-unused-vars` — error
  - `import/order` — warn (auto-fixable)
  - `no-console` — warn (except `console.error`)
  - `@angular-eslint/component-max-inline-declarations` — appropriate limit
- Fix auto-fixable violations
- Add `npm run lint` to CI pipeline (`.github/workflows/ci.yml`)
- Add `npm run lint` script to package.json

**Files touched:** Config files + CI + auto-fixable violations
**Tests:** All pass + lint passes
**Risk:** Medium — auto-fix may change formatting. Review carefully.

---

### S49: Documentation Refresh

**Goal:** All documentation reflects actual current state.

**Changes:**
- **ARCHITECTURE.md:**
  - Update directory map with new `core/`, `shared/`, `styles/` directories
  - Update all LOC counts to match post-decomposition sizes
  - Add new services from Phase 2–4 to service list
  - Update module boundaries section
  - Update file size reference table

- **STRATEGIC_AUDIT.md:**
  - Add Hardening VIII summary section
  - Mark all completed items
  - Archive old sprint checklists that are fully resolved

- **FUTURE_PLANS.md:**
  - Move completed items to "Completed" section (or remove)
  - Update remaining backlog
  - Add Angular upgrade as priority item

- **MEMORY.md:**
  - Trim to under 200 lines
  - Update service list with new services
  - Update LOC references

- **CLAUDE.md:**
  - Update service documentation
  - Add path alias documentation
  - Update testing section with new test helper locations

**Files touched:** 5 markdown files
**Tests:** N/A
**Risk:** None

---

### S50: Angular Upgrade Preparation

**Goal:** Audit and document the path to Angular 16+/17+ (standalone components, signals).

**Changes:**
- Run `ng update @angular/core@16 --force` in dry-run mode to identify breaking changes
- Document deprecated APIs used in codebase:
  - `CanActivate` interface → functional guards (already partially done)
  - `@NgModule` → standalone components migration path
  - `ViewEncapsulation` implications for CSS splitting
- Create `ANGULAR_UPGRADE.md` with:
  - Step-by-step upgrade plan (15 → 16 → 17)
  - Per-module migration checklist
  - Risk assessment for standalone component conversion
  - Test strategy for upgrade validation
- Verify TypeScript 5.x compatibility by checking tsconfig
- **Do NOT perform the upgrade** — just document the plan

**Files touched:** New ANGULAR_UPGRADE.md only
**Tests:** All pass (no code changes)
**Risk:** None — documentation only

---

## Sprint Dependency Graph

```
Phase 1 (Foundation)
S1 → S2 → S3      (core module migration — sequential)
S1 → S4            (shared utils needs core/ to exist)
S5 → S6            (game barrels before campaign/editor barrels)
S6 → S7            (barrels before path aliases)

Phase 2 (Game Board) — all depend on S7
S8, S9             (can parallel — input vs camera)
S10                (depends on S8 — shares input event handling)
S11                (independent)
S12, S13           (can parallel — tower upgrade vs selection)
S14                (independent)
S15                (depends on S11 — restart needs pause service)
S16                (depends on S10, S13 — delegates to placement + selection)
S17                (independent)
S18                (depends on all S8-S17 — final cleanup)

Phase 3 (Editor) — all depend on S7
S19, S20           (can parallel — editing vs brush preview)
S21                (depends on S19 — rectangle uses terrain edit patterns)
S22                (independent)
S23                (independent)
S24                (depends on S19-S23)
S25                (depends on S24)

Phase 4 (Services) — depends on S4 (shared disposal utils)
S26, S27, S28      (can parallel — mesh/visual/health extractions)
S29                (depends on S26-S28)
S30                (independent)
S31                (depends on S30)
S32                (depends on S31)

Phase 5 (CSS) — independent of Phases 2-4
S33                (standalone)
S34                (depends on S33)
S35, S36, S37      (can parallel — game/editor/pages)
S38                (depends on S35-S37)

Phase 6 (Types) — depends on Phases 2-4
S39                (depends on Phase 4 — types move after services split)
S40, S41, S42, S43 (can parallel — independent audits)

Phase 7 (Tests) — depends on Phases 2-4
S44                (depends on Phase 4 — spy factories for new services)
S45, S46           (can parallel — enemy/combat spec splits)
S47                (depends on S44-S46)

Phase 8 (Infra) — terminal
S48                (depends on Phase 6 — lint after type cleanup)
S49                (depends on all phases — docs reflect final state)
S50                (independent — can run anytime)
```

---

## Parallelization Opportunities

For maximum throughput, these sprint groups can run concurrently:

| Parallel Group | Sprints | Prereqs |
|---------------|---------|---------|
| Group A | S8 + S9 | S7 |
| Group B | S12 + S13 | S7 |
| Group C | S19 + S20 | S7 |
| Group D | S22 + S23 | S7 |
| Group E | S26 + S27 + S28 | S4 |
| Group F | S35 + S36 + S37 | S34 |
| Group G | S40 + S41 + S42 + S43 | Phase 4 |
| Group H | S45 + S46 | Phase 4 |

**Optimal critical path:** S1 → S2 → S3 → S4 → S5 → S6 → S7 → Phase 2 → Phase 4 → Phase 7 → S49

---

## Execution Rules

1. **Every sprint keeps all tests green.** No exceptions. If a refactor breaks a test, fix it in the same sprint.
2. **One commit per sprint.** Each sprint is atomic and revertable.
3. **No behavior changes.** If a sprint changes observable behavior (even "improvements"), it's out of scope.
4. **Run `ng build --configuration=production` after every sprint** — catch tree-shaking issues early.
5. **Update ARCHITECTURE.md in the sprint that changes the architecture** — don't defer to S49.
6. **If a sprint is harder than expected, split it.** Don't merge half-done extractions.
7. **Test count should only go up.** New services need new tests.

---

## Metrics Dashboard (fill in as sprints complete)

| Metric | Before | After S7 | After S18 | After S25 | After S32 | After S38 | After S50 |
|--------|--------|----------|-----------|-----------|-----------|-----------|-----------|
| game-board.component.ts LOC | 2,398 | — | ≤800 | — | — | — | ≤800 |
| novarise.component.ts LOC | 1,721 | — | — | ≤800 | — | — | ≤800 |
| enemy.service.ts LOC | 1,258 | — | — | — | ≤600 | — | ≤600 |
| tower-combat.service.ts LOC | 862 | — | — | — | ≤600 | — | ≤600 |
| styles.css LOC | 3,534 | — | — | — | — | ≤500 | ≤500 |
| Max spec file LOC | 3,536 | — | — | — | — | — | ≤1,500 |
| Root services in core/ | 1 | 12+ | — | — | — | — | All |
| Barrel files | 2 | — | — | — | — | — | 10+ |
| Test count | 4,024 | 4,024 | 4,050+ | 4,080+ | 4,120+ | 4,120+ | 4,150+ |
| ESLint passing | No | — | — | — | — | — | Yes |
