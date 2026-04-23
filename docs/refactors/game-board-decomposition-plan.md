# GameBoardComponent Decomposition Plan

**Source:** `src/app/game/game-board/game-board.component.ts` (1894 lines)
**Status:** PLAN ONLY — not executed. Pick one cluster at a time.
**Authored:** 2026-04-23 by Opus Plan agent during `refactor/post-pivot-cleanup` session.

## Context and hard constraints

This component has already been through multiple decomposition rounds. The `providers:` list contains 50+ component-scoped services (GameInputService, EnemyMeshFactoryService, TurnHistoryService, TowerSelectionService, etc.). What is left is mostly:

- UI timer state (banners, warnings)
- Callback-wiring blocks that glue component-scoped services to root services
- The 18-step checkpoint restore coordinator
- Fresh-encounter bootstrap sequence
- Angular lifecycle wrappers (`ngOnInit`, `ngAfterViewInit`, `ngOnDestroy`)
- Small passthrough getters/setters to sub-services (already delegated correctly)

### Booby traps — any change must preserve these

1. **18-step restore ordering is load-bearing.**
   - path mutations BEFORE elevation BEFORE towers BEFORE enemies (pathfinding grid needs this)
   - graph rebuild AFTER `restoreTowers` (keyToId population dependency)
   - `combatLoopService.setTurnNumber` BEFORE mortar zone restore (expiry math)
   - `GameStateService.restoreFromCheckpoint` is STEP 17 — must run after everything else (triggers UI subscribers)
   - `setMaxWaves` phase guard requires SETUP; must run BEFORE `gameState.restoreFromCheckpoint` flips phase
   - Moving any step is REJECTED. Extraction must preserve the method body verbatim.

2. **DI hierarchy trap (Sprint 41 regression).**
   `PathMutationService`, `ElevationService`, `LineOfSightService`, `TerraformMaterialPoolService` must live in the component's `providers:` list because sibling services that use them are component-scoped. Any extraction that moves them into a `providedIn: 'root'` service or into GameModule WILL break restore and repath. Leave the `providers:` array alone.

3. **Three.js disposal contract.**
   Per `CLAUDE.md`: every Three.js object created needs disposal in `ngOnDestroy`. The `cleanupGameObjects()` method is the single cleanup path for disposal. Any extracted state that creates meshes/geometries/materials must (a) own a `cleanup(scene)` method that disposes, (b) be called from either `cleanupGameObjects()` or `ngOnDestroy` directly. No silent leaks.

4. **Already-extracted services — do NOT re-invent.**
   GameInputService, EnemyMeshFactoryService, EnemyVisualService, TurnHistoryService, GamePauseService, CardPlayService, TowerPlacementService, TowerSelectionService, WaveCombatFacadeService, TutorialFacadeService are already component-scoped. The next layer is smaller, UI-only state.

## Responsibility map (line ranges in current file)

| Lines | Responsibility |
|-------|----------------|
| 153–157 | `providers:` list (DO NOT TOUCH) |
| 159–391 | Field declarations + DI constructor |
| 393–591 | `ngOnInit` — subscriptions, wiring, encounter bootstrap dispatch |
| 598–652 | `initFreshEncounter()` |
| 654–771 | `ngAfterViewInit` — renderer init, pointer/hotkey/cardPlay wiring |
| 773–900 | Tower/card UI handlers (thin passthroughs already) |
| 914–1016 | Tile highlight + upgrade/sell/select passthroughs |
| 1061–1177 | `startWave()`, `endTurn()`, turn banner, RECAP |
| 1184–1419 | **`restoreFromCheckpoint()` — 18-step coordinator (HIGH RISK)** |
| 1424–1491 | `importBoard()`, `renderGameBoard()`, `addGridLines()` |
| 1493–1502 | Path-blocked warning timer |
| 1515–1609 | `onTilePlace()` / `tryPlaceTower()` |
| 1613–1698 | Pause menu + endless toggle |
| 1708–1749 | Formatted-time + spawn-preview getters |
| 1751–1780 | Range + path overlay toggles |
| 1791–1820 | `applySurveyorRodEffect()` |
| 1824–1893 | `ngOnDestroy` + `cleanupGameObjects` |

## Cluster 1 — TurnBannerController (SAFE, do first)

- **State owned:** `showTurnBanner: boolean`, `turnBannerTimer`, `isEndingTurn: boolean` (optional — or keep on component)
- **Methods owned:** `flashTurnBanner()`, banner timeout cleanup in `ngOnDestroy`
- **Template contract:** component exposes `showTurnBanner` via getter (or service reference in template via `public`)
- **Target location:** `src/app/game/game-board/services/turn-banner.service.ts`
- **Interface:**
  ```ts
  interface TurnBannerService {
    readonly showBanner: boolean;
    flash(): void;          // starts or resets 1200ms timer
    cleanup(): void;        // clears timer
  }
  ```
- **Ordering dependencies:** None. Called from `endTurn()` only.
- **Three.js:** None.
- **Save/restore:** None.
- **Risk tier:** **LOW**
- **How to wire:** Add `TurnBannerService` to component `providers:`. Replace `flashTurnBanner()` body with `this.turnBannerService.flash()`. Replace template `showTurnBanner` bindings with `turnBannerService.showBanner` (expose `public` in constructor) OR keep a component getter `get showTurnBanner() { return this.turnBannerService.showBanner; }` to avoid template churn. Call `turnBannerService.cleanup()` from `ngOnDestroy` (replaces the existing `if (this.turnBannerTimer !== null)` block).
- **Validation:** Manual — end a turn, confirm banner shows for ~1.2s. Unit test: `flash()` twice within 1.2s stays visible until 1.2s after the second call.

## Cluster 2 — PathBlockedWarningController (SAFE)

- **State owned:** `pathBlocked: boolean`, `pathBlockedTimerId`
- **Methods owned:** `showPathBlockedWarning()`, cleanup in `ngOnDestroy`
- **Target location:** `src/app/game/game-board/services/path-blocked-warning.service.ts`
- **Interface:**
  ```ts
  interface PathBlockedWarningService {
    readonly blocked: boolean;
    show(): void;  // auto-dismisses after UI_CONFIG.pathBlockedDismissMs
    cleanup(): void;
  }
  ```
- **Ordering dependencies:** None.
- **Risk tier:** **LOW** (identical shape to Cluster 1)
- **Note:** Could be generalized to a single `TransientUiFlagService` that takes a dismiss duration, but first extract Cluster 1 and Cluster 2 independently to avoid scope creep. Generalization is Phase 2.

## Cluster 3 — SpawnPreviewController (SAFE-MEDIUM)

- **State owned:** `wavePreview: WavePreviewEntry[]`, `waveTemplateDescription: string | null`
- **Methods owned:** the preview-refresh logic currently inlined in the `stateSubscription.next` handler and in `initFreshEncounter()` + final step of `restoreFromCheckpoint()`.
- **Target location:** `src/app/game/game-board/services/spawn-preview-view.service.ts`
- **Interface:**
  ```ts
  interface SpawnPreviewViewService {
    readonly entries: WavePreviewEntry[];
    readonly templateDescription: string | null;
    refreshForState(state: GameState, isEndless: boolean, customDefs: WaveDef[] | undefined): void;
  }
  ```
- **Ordering dependencies:**
  - In the stateSubscription: called AFTER `this.gameState = state` assignment but BEFORE terminal-phase early return. Preserve this.
  - In `restoreFromCheckpoint`: called as Step 18 — AFTER `gameState.restoreFromCheckpoint` has set phase to COMBAT/INTERMISSION. MUST remain Step 18.
- **Three.js:** None (data only).
- **Save/restore coupling:** **Read-only consumer** of restored state — safe.
- **Risk tier:** **LOW-MEDIUM** — the pattern of "refresh after phase/wave change" is currently inlined in 3 places. Centralising into the service is a behavioural change if any caller is missed. Grep for every `getWavePreviewFull(` callsite before extracting.
- **Do NOT** move preview logic into restore coordinator. Leave the CALL at Step 18; only the body moves.

## Cluster 4 — ItemService callback wiring (SAFE)

Lines 544–582. This is the `itemService.registerCombatCallbacks(...)` + `registerRunCallbacks(...)` block. It is pure wiring between component-scoped and root services.

- **Target location:** `src/app/game/game-board/services/item-callbacks-wiring.service.ts`
- **Interface:**
  ```ts
  interface ItemCallbacksWiringService {
    wire(): void;          // registers both combat + run callbacks
    unwire(): void;        // currently handled by itemService.unregisterCallbacks()
  }
  ```
- **DI note:** This service would inject `ItemService`, `GameStateService`, `EnemyService`, `SceneService`, `DeckService`, `WaveService`, `RunService`, and it needs to be **component-scoped** so it gets the component's copies of EnemyService/SceneService/etc. Register it in the component `providers:` list — not `providedIn: 'root'`. (This is exactly the Sprint 41 DI hierarchy trap: the wiring service MUST live as a peer of the services it wires.)
- **Ordering dependencies:** Must run after services it binds exist (trivially true once DI-injected) and before `initFreshEncounter()`/`restoreFromCheckpoint()` (which might trigger item effects).
- **Risk tier:** **LOW** (pure extraction of a contiguous block).

## Cluster 5 — EncounterBootstrapCoordinator (MEDIUM)

- **State owned:** Calls `initFreshEncounter()` body + `applySurveyorRodEffect()`
- **Target location:** `src/app/game/game-board/services/encounter-bootstrap.service.ts`
- **Interface:**
  ```ts
  interface EncounterBootstrapService {
    bootstrapFresh(): void;   // replaces initFreshEncounter()
  }
  ```
- **Ordering dependencies (INTERNAL — DO NOT REORDER):**
  1. `setInitialLives` + `addGold` + `snapshotInitialGold`
  2. `setCustomWaves` + `setMaxWaves` (phase-guarded, must be SETUP)
  3. `ascensionModifier.apply`
  4. `cardEffectService.reset` (root-scoped — survives route transitions, must be explicit)
  5. `combatLoopService.reset` (SPEED_RUN turnsUsed regression — must run)
  6. `applySurveyorRodEffect` (if hasSurveyorRod — depends on fresh elevation state)
  7. `wavePreviewService.resetForEncounter`
  8. `gamePauseService.reset`
  9. `deckService.resetForEncounter` + `drawForWave`
  10. preview seed + `startWave`
- **Three.js:** Only via `applySurveyorRodEffect` which calls `elevationService.setAbsolute` (service handles disposal).
- **Risk tier:** **MEDIUM** — the ordering comments in the source are load-bearing memory from specific bugs. Extraction must preserve every comment verbatim.
- **Validation:** Integration test: fresh encounter → confirm starting gold includes relic bonus, confirm 5 elevated tiles when SURVEYOR_ROD is active, confirm opening hand drawn.

## Cluster 6 — CheckpointRestoreCoordinator (HIGH — do LAST)

- **State owned:** The 18-step `restoreFromCheckpoint()` body in its entirety.
- **Target location:** `src/app/game/game-board/services/checkpoint-restore-coordinator.service.ts`
- **Interface:**
  ```ts
  interface CheckpointRestoreCoordinatorService {
    restore(scene: THREE.Scene): RestoreOutcome;  // returns { ok: boolean; fellBackToFresh: boolean }
  }
  ```
- **Ordering dependencies (FROZEN):** Steps 1 through 18 as currently written. See source comments at each step for the rationale — those comments encode past bugs. Copy them verbatim.
- **DI note:** This service must be **component-scoped**. It touches PathMutationService, ElevationService, WaveService, GameStateService, CombatLoopService, EnemyService, StatusEffectService, TowerCombatService, TowerGraphService, BoardMeshRegistryService, SceneService — many of which are already component-scoped. If the coordinator is `providedIn: 'root'`, Angular will inject a DIFFERENT (root-level, possibly undefined) instance of those peers — the Sprint 41 regression. Register in component `providers:`.
- **Three.js:** Creates tower + enemy meshes, elevates tiles, swaps tile meshes. All must still be cleaned up via `cleanupGameObjects()` — which is unchanged because the services themselves (TowerCombatService, EnemyService, ElevationService) own their cleanup contracts.
- **Fallback behaviour:** The existing `catch` block calls `gameSessionService.resetAllServices` then `initFreshEncounter()`. The extracted service should delegate the fallback to a callback so the component retains lifecycle control:
  ```ts
  coordinator.restore(scene, { onFallback: () => this.initFreshEncounter() });
  ```
- **Risk tier:** **HIGH** — this is the single most audit-sensitive method in the codebase. Extract verbatim, keep all comments, do not "clean up" or reorder anything.
- **Validation:** Save/resume across all 5 node types (combat, elite, boss, event, shop-from-combat), verify v4/v5/v9/v10 migration paths still trigger, verify the elevation-then-tower-Y fixup at line 1283 still fires.

## Cluster 7 — LifecycleWiringAggregator (optional, LOW priority)

If after extractions 1-6 `ngAfterViewInit` is still unwieldy, consider an aggregator service that owns `boardPointer.init`, `touchInteraction.init`, `towerPlacementService.init`, `gameInput.init`, `cardPlayService.init`, `minimapService.init` wiring. But this mostly moves code without reducing risk, and couples the service to many DOM-element `ElementRef`s. Low ROI. **Recommend: skip unless the rest of this plan shrinks the component below ~600 lines and more is desired.**

## Do NOT extract

1. **`providers:` list** — brittle per Sprint 41. Reordering or moving entries anywhere else regresses DI hierarchy.
2. **`ngOnDestroy` body and `cleanupGameObjects()`** — they ARE the Three.js disposal contract. Consolidation of cleanup INTO the extracted services is fine; the caller orchestration must stay here.
3. **`stateSubscription` terminal-phase block (lines 431–454)** — builds `EncounterResult` and routes to `/run`. This is the single source of truth for encounter completion; moving it into a service breaks the router dependency chain and risks double-routing. Leave it at the component.
4. **`setupAutoPause` + `activatePauseFocus`** — uses `@ViewChild('pauseOverlay')` which cannot survive service extraction without Angular acrobatics. Focus trap must stay component-resident.
5. **Thin passthrough getters/setters to TowerSelectionService, GamePauseService, TowerPlacementService** — already correctly delegated. Removing the passthrough would require template changes across `game-board.component.html` and all its child HUD components. Not worth it.
6. **`onTilePlace` / `tryPlaceTower`** — sit between BoardPointerService, CardPlayService, TowerInteractionService, TowerMeshLifecycleService, TowerCombatService, TowerUpgradeVisualService. The dispatch logic is specifically designed to be thin glue; extracting it would re-introduce cross-service coupling.

## Recommended sprint order

1. **Sprint A (1–2 days):** Clusters 1 + 2 — the two banner/warning controllers. Zero coupling to save/restore. Proof-of-pattern.
2. **Sprint B (1 day):** Cluster 4 — ItemCallbacksWiringService. Contiguous block extraction.
3. **Sprint C (2 days):** Cluster 3 — SpawnPreviewController. Requires grep sweep of every `getWavePreviewFull(` call; low risk but touches 3 callsites.
4. **Sprint D (3 days):** Cluster 5 — EncounterBootstrapCoordinator. Preserve comments. Add an integration test covering SURVEYOR_ROD + fresh encounter.
5. **Sprint E (5 days, audit-heavy):** Cluster 6 — CheckpointRestoreCoordinator. Pair with Sprint 41 memory. Do a full save/resume QA pass across encounter types and migration versions.
6. **Cluster 7** — skip for now.

## Measurement

| | Before | Estimated after A–E |
|---|---|---|
| Component LOC | 1894 | ~950 |
| Methods on component class | 60+ | ~40 |
| Private timer state on component | 3 timers | 0 (all inside services) |

## Per-sprint validation checklist

Every sprint MUST:
- Run the existing `game-board.component.spec.ts` (component-level tests).
- Manually test one save + resume cycle (Sprint 41 regression guard).
- Verify `ngOnDestroy` still disposes cleanly (no console warnings about undisposed Three.js geometry — use `THREE.Cache` inspector in dev tools).
- Confirm the new service is in `providers:` of the component, NOT `providedIn: 'root'`, unless explicitly stateless.
