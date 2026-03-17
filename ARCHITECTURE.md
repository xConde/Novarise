# Architecture — Novarise

## Directory Map

```
src/app/
├── campaign/                      # Campaign mode (/campaign)
│   ├── maps/                      # 16 hand-crafted maps: intro-maps, early-maps, mid-maps, late-maps
│   ├── models/                    # campaign.model.ts (CampaignLevel, progress), challenge.model.ts
│   ├── services/                  # CampaignService, CampaignMapService, ChallengeEvaluatorService
│   ├── waves/                     # campaign-waves.ts (per-level wave defs), balance.spec.ts
│   └── campaign.component.ts      # Level select UI
├── game/                          # Tower defense game (/play, /maps)
│   ├── game-board/
│   │   ├── constants/             # 16 config files (see Constants Architecture)
│   │   ├── models/                # tower, enemy, wave, game-state, score, modifier, wave-preview,
│   │   │                          #   enemy-info (encyclopedia), endless-wave (template-based gen)
│   │   ├── services/              # 22 services — includes TutorialService (see Service Scopes)
│   │   ├── testing/               # Shared factories: test-board, test-enemy, test-spies
│   │   └── utils/                 # coordinate-utils, min-heap, object-pool, spatial-grid, three-utils
│   ├── guards/                    # GameGuard — requires MapBridge loaded or ?quickplay=true
│   ├── game-board.component.ts    # Main game renderer/loop (1993 LOC)
│   ├── game-board.service.ts      # Board generation, mesh creation, path-block validation (708 LOC)
│   └── map-select/                # Map selection screen (/maps)
├── games/novarise/                # Map editor (/edit)
│   ├── constants/                 # editor-camera, editor-scene, editor-ui
│   ├── core/                      # Editor services (see Service Scopes)
│   ├── features/
│   │   ├── mobile-controls/       # VirtualJoystick, TouchDetection, MobileControlsModule
│   │   ├── terrain-editor/        # TerrainGrid class + state interface
│   │   └── ui-controls/           # EditControlsComponent
│   ├── models/                    # terrain-types.enum.ts
│   └── novarise.component.ts      # Editor renderer/interactions (1916 LOC)
├── landing/                       # Landing page (/) — Campaign button + progress display
└── profile/                       # Player profile (/profile) — 26 achievements, 4 categories
```

## Module Boundaries

All routes lazy-loaded. `gameGuard` and `gameLeaveGuard` are functional guards (CanActivateFn/CanDeactivateFn).

**`CampaignModule` (`/campaign`)** provides: `CampaignService`, `CampaignMapService`, `ChallengeEvaluatorService`

**`GameModule` (`/play`)** provides: `GameBoardService`

**`GameBoardComponent`** provides (component-scoped): `EnemyService`, `GameStateService`, `WaveService`, `TowerCombatService`, `AudioService`, `ParticleService`, `ScreenShakeService`, `GoldPopupService`, `FpsCounterService`, `GameStatsService`, `DamagePopupService`, `MinimapService`, `TowerPreviewService`, `PathVisualizationService`, `StatusEffectService`, `TutorialService`, `GameEndService`, `ChallengeTrackingService`, `GameSessionService`, `PathfindingService`, `CombatVFXService`, `SceneService`, `TowerInteractionService`, `CombatLoopService`

**`EditorModule` (`/edit`)** provides: `PathValidationService`, `EditorSceneService`

**Root-scoped** (survive route transitions): `MapBridgeService`, `SettingsService`, `PlayerProfileService`, `EditorStateService`, `EditHistoryService`, `CameraControlService`, `MapStorageService`, `MapShareService`, `MapTemplateService`, `StorageService`

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
  ├── EnemyService          (reads enemy positions/health)
  ├── StatusEffectService   (applies BURN/POISON on hit)
  ├── ParticleService       (VFX on kill/impact — delegated to CombatVFXService)
  ├── AudioService          (SFX on fire/kill)
  ├── GameStatsService      (kill tracking, score)
  └── CombatVFXService      (chain arcs, impact flashes, mortar blast zones)

EnemyService
  ├── StatusEffectService   (speed modifier reads)
  ├── GameStateService      (leak → decrement lives)
  └── PathfindingService    (A* path computation, path cache, flying straight paths)

GameBoardComponent
  ├── GameBoardService      (board mutations)
  ├── GameStateService      (phase transitions)
  ├── TowerCombatService    (combat loop)
  ├── EnemyService          (spawn/move loop)
  ├── WaveService           (wave start/end)
  ├── MinimapService        (canvas overlay)
  ├── TowerPreviewService   (ghost tower hover)
  ├── PathVisualizationService (V-key overlay)
  ├── SceneService          (Three.js scene/camera/renderer/lights/post-processing)
  ├── TowerInteractionService (place/sell/upgrade business logic)
  ├── GameEndService        (victory/defeat/quit recording, challenge evaluation)
  ├── ChallengeTrackingService (goldSpent, towersPlaced, towerTypesUsed tracking)
  └── GameSessionService    (service reset orchestration, campaign wave loading)
```

## Constants Architecture

`game/game-board/constants/` (16 files) — rendering/physics/combat configs:

| File | Contents |
|------|----------|
| `board`, `camera`, `rendering`, `lighting` | Board geometry, camera, Three.js renderer, lights |
| `combat`, `physics`, `status-effect` | Attack rates, `PHYSICS_CONFIG` (1/60 timestep), SLOW/BURN/POISON |
| `particle`, `effects`, `minimap`, `path` | VFX, bloom, minimap canvas, path overlay |
| `audio`, `ui`, `preview`, `damage-popup`, `touch` | SFX volumes, HUD, ghost tower, popups, touch targets |

`games/novarise/constants/` (3 files): `editor-camera`, `editor-scene`, `editor-ui`

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

**Tutorial** (`game-board/services/tutorial.service.ts`): 5-step onboarding overlay, localStorage persistence, injected into `GameBoardComponent`.

**Enemy encyclopedia** (`game-board/models/enemy-info.model.ts`): `EnemyInfo` model with stats, weaknesses, and lore. In-game panel toggled with E key; wave preview shows NEW badges for first-encounter enemies.

**Achievement categories** (`achievement.model.ts`): 26 achievements across 4 categories: Combat, Campaign, Endless, Challenge. Threshold constants and helper functions extracted from `PlayerProfileService` into a dedicated model file.

## New Services (feat/product-campaign tech debt)

Eight services extracted from the god component and oversized services:

| Service | LOC | Extracted From | Responsibility |
|---------|-----|----------------|----------------|
| `GameEndService` | ~180 | `game-board.component.ts` | Victory/defeat/quit recording, `gameEndRecorded` guard, `buildGameEndStats`, challenge evaluation + campaign completion |
| `ChallengeTrackingService` | ~80 | `game-board.component.ts` | Accumulates `totalGoldSpent`, `maxTowersPlaced`, `towerTypesUsed` during gameplay |
| `GameSessionService` | ~120 | `game-board.component.ts` | `resetAllServices()` orchestration across all game services, campaign wave loading |
| `PathfindingService` | ~200 | `enemy.service.ts` | A* with MinHeap, path cache, straight-line paths for flying enemies |
| `CombatVFXService` | ~115 | `tower-combat.service.ts` | Chain arcs, impact flashes, mortar blast zone meshes |
| `SceneService` | ~459 | `game-board.component.ts` | Three.js scene, camera, renderer, lights, post-processing, skybox, particles, GLSL shaders |
| `TowerInteractionService` | ~252 | `game-board.component.ts` | Tower place/sell/upgrade business logic with path-block + affordability validation |
| `AchievementModel` | — | `player-profile.service.ts` | 26 achievement definitions, threshold constants, helper functions (now in `achievement.model.ts`) |

**God component reduction:** `game-board.component.ts` 2892 → 2314 LOC (−578 lines, −20%)

## File Size Reference

Files over 500 LOC — be careful editing these, they are dense:

| File | LOC | Notes |
|------|-----|-------|
| `game-board/game-board.component.ts` | ~2256 | Main coordinator — delegates to CombatLoopService |
| `games/novarise/novarise.component.ts` | ~1558 | Editor coordinator — delegates to EditorSceneService |
| `services/scene.service.ts` | ~459 | Game Three.js infrastructure |
| `core/editor-scene.service.ts` | ~463 | Editor Three.js infrastructure |
| `services/enemy.service.ts` | ~800 | Spawn + movement (A* in PathfindingService) |
| `services/tower-combat.service.ts` | ~780 | Targeting + projectiles (VFX in CombatVFXService) |
| `game-board/game-board.service.ts` | ~708 | Board gen + path-block BFS |
| `services/combat-loop.service.ts` | ~250 | Physics stepping, kill/leak/wave processing |
