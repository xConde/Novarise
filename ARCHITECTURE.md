# Architecture — Novarise

## Directory Map

```
src/app/
├── game/                          # Tower defense game (/play, /maps)
│   ├── game-board/
│   │   ├── constants/             # 16 config files (see Constants Architecture)
│   │   ├── models/                # tower, enemy, wave, game-state, score, modifier, wave-preview
│   │   ├── services/              # 20 services (see Service Scopes)
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
├── landing/                       # Landing page (/)
└── profile/                       # Player profile (/profile)
```

## Module Boundaries

All routes lazy-loaded. `GameGuard` is root-provided.

**`GameModule` (`/play`)** provides: `GameBoardService`

**`GameBoardComponent`** provides (component-scoped): `EnemyService`, `GameStateService`, `WaveService`, `TowerCombatService`, `AudioService`, `ParticleService`, `ScreenShakeService`, `GoldPopupService`, `FpsCounterService`, `GameStatsService`, `DamagePopupService`, `MinimapService`, `TowerPreviewService`, `PathVisualizationService`, `StatusEffectService`

**`EditorModule` (`/edit`)** provides: `PathValidationService`

**Root-scoped** (survive route transitions): `MapBridgeService`, `SettingsService`, `PlayerProfileService`, `EditorStateService`, `EditHistoryService`, `CameraControlService`, `MapStorageService`, `MapShareService`, `MapTemplateService`

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
  ├── ParticleService       (VFX on kill/impact)
  ├── AudioService          (SFX on fire/kill)
  └── GameStatsService      (kill tracking, score)

EnemyService
  ├── StatusEffectService   (speed modifier reads)
  └── GameStateService      (leak → decrement lives)

GameBoardComponent
  ├── GameBoardService      (board mutations)
  ├── GameStateService      (phase transitions)
  ├── TowerCombatService    (combat loop)
  ├── EnemyService          (spawn/move loop)
  ├── WaveService           (wave start/end)
  ├── MinimapService        (canvas overlay)
  ├── TowerPreviewService   (ghost tower hover)
  └── PathVisualizationService (V-key overlay)
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

## File Size Reference

Files over 500 LOC — be careful editing these, they are dense:

| File | LOC | Notes |
|------|-----|-------|
| `game-board/game-board.component.ts` | 1993 | God component — Three.js loop coordinator |
| `games/novarise/novarise.component.ts` | 1916 | God component — editor renderer |
| `services/enemy.service.ts` | 904 | A* pathfinding + spawn + movement |
| `services/tower-combat.service.ts` | 898 | Targeting + projectiles + spatial grid |
| `game-board/game-board.service.ts` | 708 | Board gen + path-block BFS |
