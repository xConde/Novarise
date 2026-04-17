# Architecture — Novarise

## Directory Map

```
src/
├── app/
│   ├── campaign/                      # Campaign mode (/campaign)
│   │   ├── maps/                      # 16 hand-crafted maps: intro-maps, early-maps, mid-maps, late-maps
│   │   ├── models/                    # campaign.model.ts (CampaignLevel, progress), challenge.model.ts
│   │   ├── services/                  # CampaignService, CampaignMapService, ChallengeEvaluatorService
│   │   ├── waves/                     # campaign-waves.ts (per-level wave defs), balance.spec.ts
│   │   └── campaign.component.ts      # Level select UI
│   ├── core/                          # App-wide singletons (survive all route transitions)
│   │   ├── services/                  # Root-scoped services (index.ts barrel)
│   │   │   └── error-handler, map-bridge, map-share, map-storage, map-template,
│   │   │       player-profile, settings, storage, tutorial
│   │   └── models/                    # map-schema.ts, map-template.model.ts (index.ts barrel)
│   ├── game/                          # Tower defense game (/play, /maps)
│   │   ├── game-board/
│   │   │   ├── components/
│   │   │   │   ├── game-hud/              # HUD display (lives, gold, wave, score, time)
│   │   │   │   ├── game-results-overlay/  # Victory/defeat overlay (stars, score, challenges)
│   │   │   │   ├── game-setup-panel/      # Pre-game setup (difficulty, modifiers, start)
│   │   │   │   ├── tower-info-panel/      # Selected tower stats, upgrade, sell, spec
│   │   │   │   └── tutorial-spotlight/    # Non-blocking tutorial cards
│   │   │   ├── constants/             # 16 config files + index.ts barrel (see Constants Architecture)
│   │   │   ├── models/                # tower, enemy, wave, game-state, score, modifier, wave-preview,
│   │   │   │                          #   enemy-info (encyclopedia), tower-info (encyclopedia), endless-wave
│   │   │   │                          #   index.ts barrel
│   │   │   ├── services/              # 32 services (see Service Scopes)
│   │   │   │   ├── enemy-mesh-factory.service.ts  # Enemy mesh creation (extracted from EnemyService)
│   │   │   │   ├── enemy-visual.service.ts         # Status particles, animations, tints
│   │   │   │   ├── game-input.service.ts            # Keyboard handling and hotkey management
│   │   │   │   ├── tile-highlight.service.ts        # Tile heatmap highlighting for tower placement
│   │   │   │   ├── tower-animation.service.ts       # Tower idle animations and tile pulse
│   │   │   │   ├── range-visualization.service.ts   # Range ring and selection ring lifecycle
│   │   │   │   └── tower-mesh-factory.service.ts    # Tower mesh creation (extracted from GameBoardService)
│   │   │   ├── testing/               # Shared factories: test-board, test-enemy, test-spies
│   │   │   └── utils/                 # coordinate-utils, min-heap, object-pool, spatial-grid, three-utils, assert-never
│   │   ├── guards/                    # GameGuard — requires MapBridge loaded or ?quickplay=true
│   │   ├── game-board.component.ts    # Main game renderer/loop (~2337 LOC)
│   │   ├── game-board.component.html  # Template (~387 LOC, decomposed into 5 child components)
│   │   ├── game-board.service.ts      # Board generation, path-block validation (~432 LOC)
│   │   └── map-select/                # Map selection screen (/maps)
│   ├── games/novarise/                # Map editor (/edit)
│   │   ├── constants/                 # editor-camera, editor-scene, editor-ui
│   │   ├── core/                      # Editor-scoped services + index.ts barrel
│   │   │   └── camera-control, edit-history, editor-notification, editor-scene,
│   │   │       editor-state, path-validation, terrain-edit
│   │   ├── features/
│   │   │   ├── mobile-controls/       # VirtualJoystick, TouchDetection, MobileControlsModule
│   │   │   ├── terrain-editor/        # TerrainGrid class + state interface
│   │   │   └── ui-controls/           # EditControlsComponent
│   │   ├── models/                    # terrain-types.enum.ts
│   │   └── novarise.component.ts      # Editor renderer/interactions (~1513 LOC)
│   ├── landing/                       # Landing page (/) — Campaign button + progress display
│   ├── profile/                       # Player profile (/profile) — 26 achievements, 4 categories, settings
│   └── shared/utils/                  # Reusable utilities: focus-trap.util.ts
└── styles/                            # SCSS partials (split from global styles.css)
    ├── _variables.scss                # All :root custom properties
    ├── _base.scss                     # Reset, body, scrollbar, focus-visible, skip-link
    ├── _animations.scss               # All @keyframes definitions
    ├── _game-board.scss, _game-hud.scss, _game-overlays.scss  # Game styles
    ├── _editor.scss, _editor-modals.scss                       # Editor styles
    └── _landing.scss, _campaign.scss, _profile.scss, _pages.scss  # Page styles
```

## Module Boundaries

All routes lazy-loaded. `gameGuard` and `gameLeaveGuard` are functional guards (CanActivateFn/CanDeactivateFn).

**`CampaignModule` (`/campaign`)** provides: `CampaignService`, `CampaignMapService`, `ChallengeEvaluatorService`

**`GameModule` (`/play`)** provides: `GameBoardService`

**`GameBoardComponent`** provides (component-scoped): `SceneService`, `EnemyService`, `EnemyVisualService`, `PathfindingService`, `GameStateService`, `WaveService`, `TowerCombatService`, `AudioService`, `ParticleService`, `ScreenShakeService`, `GoldPopupService`, `FpsCounterService`, `GameStatsService`, `DamagePopupService`, `MinimapService`, `TowerPreviewService`, `PathVisualizationService`, `StatusEffectService`, `TilePricingService`, `PriceLabelService`, `GameNotificationService`, `ChallengeTrackingService`, `GameEndService`, `GameSessionService`, `TowerInteractionService`, `CombatLoopService`, `TileHighlightService`, `TowerAnimationService`, `RangeVisualizationService`, `TowerMeshFactoryService`, `EnemyMeshFactoryService`, `GameInputService`

**`EditorModule` (`/edit`)** provides: `PathValidationService`, `EditorSceneService`, `EditorNotificationService`, `TerrainEditService`, `EditorStateService`, `EditHistoryService`, `CameraControlService`

**Root-scoped** (survive route transitions, all in `core/services/`): `MapBridgeService`, `SettingsService`, `PlayerProfileService`, `MapStorageService`, `MapShareService`, `MapTemplateService`, `StorageService`, `TutorialService`, `ErrorHandlerService`

## Data Flow

```
Editor (novarise.component.ts)
  └─ MapStorageService (localStorage read/write)
  └─ EditHistoryService (undo/redo commands)
  └─ EditorStateService (BehaviorSubject tile grid)
  └─ PathValidationService (BFS path check before save)
        │
        ▼  on "Play" → MapBridgeService.setMap()  [root-scoped, survives route transition]
        │
Game (game-board.component.ts)
  └─ MapBridgeService.getMap() → board[row][col] layout
  └─ GameStateService (phase: SETUP → COMBAT → INTERMISSION → …)
  └─ GameBoardService (tile mesh creation, tower placement)
  └─ EnemyService (A* pathfinding, spawn, movement, modifier effects)
  └─ TowerCombatService (targeting, projectiles, spatial grid, object pool)
  └─ WaveService (wave definitions, endless scaling)
  └─ StatusEffectService (SLOW/BURN/POISON, immunity, speed restoration)
```

State changes flow through `GameStateService` BehaviorSubjects. All consumers subscribe; no direct method calls between sibling services except through `GameBoardComponent` as coordinator.

## Service Dependency Graph (critical paths)

```
TowerCombatService
  ├── EnemyService          (reads enemy positions/health, hit flash on damage)
  ├── StatusEffectService   (applies BURN/POISON on hit)
  ├── ParticleService       (VFX on kill/impact — delegated to CombatVFXService)
  ├── AudioService          (SFX on fire/kill)
  ├── GameStatsService      (kill tracking, score)
  ├── TowerAnimationService (muzzle flash on fire)
  └── CombatVFXService      (chain arcs, impact flashes, mortar blast zones)

EnemyService
  ├── StatusEffectService      (speed modifier reads)
  ├── GameStateService         (leak → decrement lives)
  ├── PathfindingService       (A* path computation, path cache, flying straight paths)
  ├── EnemyMeshFactoryService  (mesh creation for all 8 enemy types)
  └── EnemyVisualService       (status particles, animations, tints per frame)

GameBoardComponent
  ├── GameBoardService         (board mutations)
  ├── GameStateService         (phase transitions)
  ├── TowerCombatService       (combat loop)
  ├── EnemyService             (spawn/move loop)
  ├── WaveService              (wave start/end)
  ├── GameInputService         (keyboard hotkeys)
  ├── MinimapService           (canvas overlay)
  ├── TowerPreviewService      (ghost tower hover)
  ├── PathVisualizationService (V-key overlay)
  ├── SceneService             (Three.js scene/camera/renderer/lights/post-processing)
  ├── TowerInteractionService  (place/sell/upgrade business logic)
  ├── GameEndService           (victory/defeat/quit recording, challenge evaluation)
  ├── ChallengeTrackingService (goldSpent, towersPlaced, towerTypesUsed tracking)
  └── GameSessionService       (service reset orchestration, campaign wave loading)
```

## Constants Architecture

`game/game-board/constants/` (16 files) — rendering/physics/combat configs, with `index.ts` barrel:

| File | Contents |
|------|----------|
| `board`, `camera`, `rendering`, `lighting` | Board geometry, camera, Three.js renderer, lights |
| `combat`, `physics`, `status-effect` | Attack rates, `PHYSICS_CONFIG` (1/60 timestep), SLOW/BURN/POISON |
| `particle`, `effects`, `minimap`, `path` | VFX, bloom, minimap canvas, path overlay |
| `audio`, `ui`, `preview`, `damage-popup`, `touch` | SFX volumes, HUD, ghost tower, popups, touch targets |

`game/game-board/models/` — model interfaces with `index.ts` barrel.

`core/services/` — root-scoped services with `index.ts` barrel.

`core/models/` — shared models (map-schema, map-template) with `index.ts` barrel.

`games/novarise/constants/` (3 files): `editor-camera`, `editor-scene`, `editor-ui`

`games/novarise/core/` — editor services with `index.ts` barrel.

**Rule:** Balance values (tower stats, enemy stats, wave defs) live in `models/`, not `constants/`.

## Campaign System

**Route:** `/campaign` — lazy-loaded `CampaignModule`

**Map library** (`campaign/maps/`): 16 hand-crafted maps across 5 tiers, each a `CampaignMap` extending `MapData`. Maps range from 10×10 (Intro) to 20×20 (Endgame) with 1–4 spawners and 1–4 exits.

| File | Maps | Tier |
|------|------|------|
| `intro-maps.ts` | First Light, The Bend, Serpentine, The Fork | Levels 1–4 |
| `early-maps.ts` | Twin Gates, Open Ground, The Narrows, Crystal Maze | Levels 5–8 |
| `mid-maps.ts` | Crossfire, The Spiral, Siege, Labyrinth | Levels 9–12 |
| `late-maps.ts` | Fortress, Gauntlet, Storm, Novarise | Levels 13–16 |

**Wave definitions** (`campaign/waves/campaign-waves.ts`): Per-level wave arrays (6–12 waves each) with tier-appropriate enemy rosters. `balance.spec.ts` contains 69 assertions codifying game economics.

**Services:**
- `CampaignService` — progress tracking, level unlock gates, localStorage persistence (root-scoped via `CampaignModule`)
- `CampaignMapService` — map lookup by level index, `CampaignMap` → `MapData` bridging
- `ChallengeEvaluatorService` — evaluates 32 challenges (6 types: NoDamage, SpeedRun, LimitedTowers, GoldEfficiency, PerfectWaves, NoSlow) across all 16 maps

**Models** (`campaign/models/`):
- `campaign.model.ts` — `CampaignLevel`, `CampaignProgress`, `CampaignMap`, unlock gate logic
- `challenge.model.ts` — `ChallengeDefinition`, `ChallengeResult`, 6 `ChallengeType` variants

**Endless mode** (`game-board/models/endless-wave.model.ts`): 7 wave templates with boss milestones at waves 5/10/15/20, score streak bonuses, and difficulty-scaled enemy rosters beyond wave 10.

**Tutorial** (`game-board/services/tutorial.service.ts`): 6-step onboarding + 3 strategy tips (gated to game 2+), localStorage persistence, injected into `GameBoardComponent`.

**Encyclopedia** (`game-board/models/enemy-info.model.ts`, `tower-info.model.ts`): Tabbed panel (Enemies/Towers) toggled with E key. Enemy tab: stats, weaknesses, lore. Tower tab: all 6 types with stats, descriptions, L3 specialization branches. Wave preview shows tactical badges (immunities, splits, shield HP, leak damage).

**Achievement categories** (`achievement.model.ts`): 26 achievements across 4 categories: Combat, Campaign, Endless, Challenge. Threshold constants and helper functions extracted from `PlayerProfileService` into a dedicated model file.

## Ascent Mode (Roguelite Shell)

**Route:** `/ascent` — lazy-loaded `AscentModule`

**Module structure:**
- `AscentComponent` — root coordinator with view mode state machine (`start` | `map` | `reward` | `shop` | `rest` | `event` | `act-transition` | `summary`)
- `NodeMapComponent` — SVG node map rendering with bezier-curve connections and absolute-positioned node buttons
- `RewardScreenComponent` — post-combat relic choice (pick one of 3, or skip)
- `ShopScreenComponent` — relic shop + per-life healing
- `RestScreenComponent` — campfire heal with CSS-only fire animation
- `EventScreenComponent` — narrative choice events with outcome panel
- `ActTransitionComponent` — act completion overlay showing boss name and act stats
- `RunSummaryComponent` — end-of-run stats: score, kills, gold, timeline, relic strip
- `RelicInventoryComponent` — compact relic bar with mouse-position-clamped tooltips

**Services (all root-scoped via `providedIn: 'root'`, survive `/ascent` ↔ `/play` transitions):**
- `RunService` — central run orchestrator; BehaviorSubject state for `runState$` and `nodeMap$`; manages full lifecycle: start → encounter → reward → advance → end
- `RelicService` — pull-model relic effects; cached `RelicModifiers` rebuilt only when relic set changes; trigger-based relics (`ARCHITECTS_BLUEPRINT`, `REINFORCED_WALLS`, `LUCKY_COIN`) handled separately
- `NodeMapGeneratorService` — deterministic seeded node graph (mulberry32 RNG); 11 content rows + boss row; SHOP guaranteed row 5, REST guaranteed row 8
- `WaveGeneratorService` — procedural wave composition with depth-tiered enemy pools; elite nodes inject a BOSS wave; boss nodes use themed presets from `boss-presets.ts`
- `EncounterService` — node → `EncounterConfig` orchestration; loads campaign map into `MapBridgeService` before `/play` navigation
- `RunEventBusService` — pub-sub `Subject<RunEvent>` for cross-service events (encounter start/end, wave, kills, gold)
- `RunPersistenceService` — localStorage save/resume; keys: `novarise_ascent_run`, `novarise_ascent_map`, `novarise_ascent_max_ascension`

**Constants** (`ascent/constants/ascent.constants.ts`):
- `NODE_MAP_CONFIG` — row counts, node type weights, guaranteed row positions, elite row bounds
- `ENCOUNTER_CONFIG` — wave counts per encounter type, enemy scaling, elite/boss health/gold multipliers
- `REWARD_CONFIG` — gold base/per-row, relic choice counts, elite/boss gold reward multipliers
- `SHOP_CONFIG` — relic count, price by rarity, heal cost/limit
- `REST_CONFIG` — heal percentage (0.3), minimum heal (2)
- `RUN_CONFIG` — seed primes for resume/act progression, score per kill, min starting gold/lives
- `RELIC_EFFECT_CONFIG` — non-obvious relic numeric values (IRON_HEART bonus, LUCKY_COIN probability/multiplier, tower-specific multipliers)
- `createSeededRng(seed)` — mulberry32 PRNG returning `[0, 1)` floats

**Integration points with existing game:**
- `TowerCombatService`: reads `RelicService.getDamageMultiplier()`, `getFireRateMultiplier()`, `getRangeMultiplier()`, `getSplashRadiusMultiplier()`, `getChainBounceBonus()`, `rollLuckyCoin()`
- `CombatLoopService`: reads `RelicService.getGoldMultiplier()`, `shouldBlockLeak()`, emits `RunEventBusService` events
- `TowerInteractionService`: reads `RelicService.getTowerCostMultiplier()`, `getUpgradeCostMultiplier()`, `getSellRefundRate()`, `isNextTowerFree()` / `consumeFreeTower()`
- `EnemyService`: reads `RelicService.getEnemySpeedMultiplier()`, `getSpawnIntervalMultiplier()`
- `GameStateService`: ascension modifier effects applied via `EncounterConfig`; `setInitialLives()` receives lives from `RunState`
- `GameBoardComponent`: calls `RunService.recordEncounterResult()` on victory/defeat; reads `EncounterConfig` for wave definitions

**Data flow:**
```
AscentComponent → RunService.prepareEncounter()
  → EncounterService.prepareEncounter() + loadEncounterMap()
      → WaveGeneratorService (waves)
      → CampaignMapService.loadLevel() → MapBridgeService.setEditorMapState()
  → navigate /play
      → GameBoardComponent reads map + encounter waves
      → on finish → RunService.recordEncounterResult()
  → navigate /ascent
      → AscentComponent.handleEncounterReturn()
          → RunService.consumePendingEncounterResult()
          → victory: show reward screen; defeat: show summary
```

## Extracted Services (hardening history)

Services extracted from the god component and oversized services over multiple hardening branches:

| Service | LOC | Extracted From | Responsibility |
|---------|-----|----------------|----------------|
| `GameEndService` | ~180 | `game-board.component.ts` | Victory/defeat/quit recording, `gameEndRecorded` guard, `buildGameEndStats`, challenge evaluation + campaign completion |
| `ChallengeTrackingService` | ~80 | `game-board.component.ts` | Accumulates `totalGoldSpent`, `maxTowersPlaced`, `towerTypesUsed` during gameplay |
| `GameSessionService` | ~120 | `game-board.component.ts` | `resetAllServices()` orchestration across all game services, campaign wave loading |
| `PathfindingService` | ~200 | `enemy.service.ts` | A* with MinHeap, path cache, straight-line paths for flying enemies |
| `CombatVFXService` | ~115 | `tower-combat.service.ts` | Chain arcs, impact flashes, mortar blast zone meshes |
| `SceneService` | ~459 | `game-board.component.ts` | Three.js scene, camera, renderer, lights, post-processing, skybox, particles, GLSL shaders |
| `TowerInteractionService` | ~252 | `game-board.component.ts` | Tower place/sell/upgrade business logic with path-block + affordability validation |
| `EnemyMeshFactoryService` | ~234 | `enemy.service.ts` | Enemy mesh creation for all 8 types (hardening-viii S26) |
| `EnemyVisualService` | ~312 | `enemy.service.ts` | Status particles, animations, tints per frame (hardening-viii S27) |
| `GameInputService` | ~90 | `game-board.component.ts` | Keyboard handling and hotkey management (hardening-viii S8) |
| `TerrainEditService` | ~291 | `novarise.component.ts` | Terrain editing logic — brush, flood-fill, rectangle, clear (hardening-viii S19) |
| `AchievementModel` | — | `player-profile.service.ts` | 26 achievement definitions, threshold constants, helper functions (now in `achievement.model.ts`) |

## File Size Reference

Files over 500 LOC — be careful editing these, they are dense:

| File | LOC | Notes |
|------|-----|-------|
| `game-board/game-board.component.ts` | ~2337 | Main coordinator — delegates to CombatLoopService, GameInputService |
| `games/novarise/novarise.component.ts` | ~1513 | Editor coordinator — delegates to EditorSceneService, TerrainEditService |
| `services/enemy.service.ts` | ~798 | Spawn + movement + death/hit/shield (mesh in EnemyMeshFactory, visuals in EnemyVisual) |
| `services/tower-combat.service.ts` | ~862 | Targeting + projectiles + per-tower visuals (VFX in CombatVFXService) |
| `services/scene.service.ts` | ~459 | Game Three.js infrastructure |
| `core/editor-scene.service.ts` | ~463 | Editor Three.js infrastructure |
| `game-board/game-board.service.ts` | ~432 | Board gen + path-block BFS |
| `services/enemy-visual.service.ts` | ~312 | Status particles, animations, tints (extracted from EnemyService) |
| `services/enemy-mesh-factory.service.ts` | ~234 | Enemy mesh creation (extracted from EnemyService) |
| `games/novarise/core/terrain-edit.service.ts` | ~291 | Terrain editing logic (extracted from novarise.component.ts) |
| `services/combat-loop.service.ts` | ~250 | Physics stepping, kill/leak/wave processing |
| `services/tower-mesh-factory.service.ts` | ~300 | Tower mesh creation (extracted from GameBoardService) |
| `services/game-input.service.ts` | ~90 | Keyboard handling and hotkey management |
| `services/tile-highlight.service.ts` | ~204 | Tile heatmap highlighting for tower placement |
| `services/range-visualization.service.ts` | ~135 | Range ring and selection ring lifecycle |
| `services/tower-animation.service.ts` | ~155 | Tower idle animations, tile pulse, muzzle flash |
