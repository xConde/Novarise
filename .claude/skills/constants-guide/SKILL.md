---
name: constants-guide
description: Magic number prevention rules and constants architecture for Novarise. Use when writing or reviewing code that introduces numeric literals, color values, or configuration values.
user-invocable: false
---

# Constants Guide — Novarise

## Rule: No Magic Numbers

Every numeric literal, hex color, or configuration value in production code must be a named constant. The only exceptions are:
- `0`, `1`, `-1` used as identity values, booleans, or array offsets
- Loop counters and array indices
- `Math.PI` and standard math operations
- GLSL shader constants in template literals (document inline instead)
- Angular decorator arguments

## Where Constants Live

### Game Balance (already extracted — extend, don't duplicate)
| Config | File | Pattern |
|--------|------|---------|
| Tower stats | `models/tower.model.ts` | `TOWER_CONFIGS: Record<TowerType, TowerStats>` |
| Enemy stats | `models/enemy.model.ts` | `ENEMY_STATS: Record<EnemyType, EnemyStats>` |
| Wave defs | `models/wave.model.ts` | `WAVE_DEFINITIONS: WaveDefinition[]` |
| Terrain | `src/app/games/novarise/models/terrain-types.enum.ts` | `TERRAIN_CONFIGS` |
| Upgrades | `models/tower.model.ts` | `UPGRADE_MULTIPLIERS[]` |

### Infrastructure (create as needed)
```
src/app/game/game-board/constants/
├── board.constants.ts        # BOARD_CONFIG { width, height, tileSize, tileHeight }
├── rendering.constants.ts    # SCENE_CONFIG, FOG_CONFIG, POST_PROCESSING_CONFIG
├── lighting.constants.ts     # LIGHTS[] array of light configs
├── camera.constants.ts       # CAMERA_CONFIG { fov, near, far, distance, orbit bounds }
├── particle.constants.ts     # PARTICLE_CONFIG { count, colors, size, speeds }
└── ui.constants.ts           # HEALTH_BAR_CONFIG, PROJECTILE_VISUALS, TOWER_SCALE_CONFIG

src/app/games/novarise/constants/
├── editor-scene.constants.ts # Editor-specific lighting, fog, skybox
├── editor-camera.constants.ts# Camera speeds, bounds from CameraControlService
└── editor-ui.constants.ts    # Brush sizes, throttle intervals, marker geometry
```

## How to Structure a Config Object

Use typed config objects, not flat exports:

```typescript
// GOOD — grouped, typed, discoverable
export interface BoardConfig {
  width: number;
  height: number;
  tileSize: number;
  tileHeight: number;
}

export const BOARD_CONFIG: BoardConfig = {
  width: 25,
  height: 20,
  tileSize: 1,
  tileHeight: 0.2
};

// BAD — flat, no grouping, no type safety
export const BOARD_WIDTH = 25;
export const BOARD_HEIGHT = 20;
```

## Computed Over Duplicated

Never repeat a value that can be derived:

```typescript
// GOOD — spawner range computed from board size
private getSpawnerRange(type: SpawnerType) {
  const w = BOARD_CONFIG.width;
  const h = BOARD_CONFIG.height;
  switch (type) {
    case SpawnerType.TOP_RIGHT:
      return { minRow: 0, maxRow: 1, minCol: w - 2, maxCol: w - 1 };
    case SpawnerType.BOTTOM_LEFT:
      return { minRow: h - 2, maxRow: h - 1, minCol: 0, maxCol: 1 };
  }
}

// BAD — hardcoded for 25x20, breaks if board changes
return { minRow: 18, maxRow: 19, minCol: 23, maxCol: 24 };
```

## When You Touch a File

If you're editing a file and see magic numbers:
1. Extract them to the appropriate constants file (create it if needed)
2. Import and use the constant
3. Don't extract numbers from files you're not otherwise modifying (no drive-by refactors)

## Color Constants

Hex colors (`0xRRGGBB`) must be in a config object with a comment explaining the color:
```typescript
color: 0xd47a3a,  // Warm amber
emissive: 0xaa6a2a,  // Darker amber glow
```

## CSS Values

Shared CSS values use `:root` custom properties:
```css
:root {
  --theme-purple: #6a5a9a;
  --nav-bg: rgba(15, 12, 25, 0.95);
  --mobile-breakpoint: 768px;
}
```
