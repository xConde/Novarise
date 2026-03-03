---
name: new-enemy
description: Scaffold a new enemy type end-to-end following the established config-driven pattern.
disable-model-invocation: true
argument-hint: "[enemy-name] [archetype: tank|speed|special]"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(npm test *)
---

# New Enemy Scaffolding

Add a new enemy type to Novarise following the established patterns exactly.

**Arguments:** `$0` = enemy name (e.g., "shielded"), `$1` = archetype (tank, speed, or special)

## Checklist

### 1. Add Enum Value
**File:** `src/app/game/game-board/models/enemy.model.ts`

Add to `EnemyType` enum:
```typescript
ENEMY_NAME = 'ENEMY_NAME'
```
Use UPPER_SNAKE_CASE for both key and string value (matches existing: BASIC, FAST, HEAVY, SWIFT, BOSS).

### 2. Add Stats Config
**File:** `src/app/game/game-board/models/enemy.model.ts`

Add entry to `ENEMY_STATS` following the `EnemyStats` interface:
```typescript
[EnemyType.ENEMY_NAME]: {
  health: number,   // HP (existing range: 50-1000)
  speed: number,    // Tiles per second (existing range: 0.5-4.0)
  value: number,    // Gold reward on kill (existing range: 10-100)
  color: 0xRRGGBB,  // Mesh color — must be distinct from existing
  size: number      // Sphere radius (existing range: 0.25-0.6)
}
```

**Balance guidelines by archetype:**
- **tank:** High health (200-500), slow speed (0.5-1.5), high value (25-50), large size (0.35-0.5)
- **speed:** Low health (40-80), fast speed (3.0-5.0), medium value (15-25), small size (0.2-0.3)
- **special:** Medium health (80-200), medium speed (1.5-3.0), special mechanic (document in code comment), medium size (0.3-0.4)

**Existing enemy colors (avoid these):**
- Red (0xff0000) — BASIC
- Yellow (0xffff00) — FAST
- Blue (0x0000ff) — HEAVY
- Cyan (0x00ffff) — SWIFT
- Magenta (0xff00ff) — BOSS

### 3. Add to Wave Definitions
**File:** `src/app/game/game-board/models/wave.model.ts`

Add the new enemy to at least 2-3 wave definitions. Follow the progression:
- First appearance: waves 4-6 (small count, long spawn interval)
- Regular appearance: waves 7-9 (mixed with other types)
- Never dominate early waves (1-3) — those are for BASIC/FAST intro

```typescript
{ type: EnemyType.ENEMY_NAME, count: 3, spawnInterval: 1.5 }
```

### 4. Add Tests

**File:** `src/app/game/game-board/models/enemy.model.spec.ts`

Add tests for:
- Config completeness: all `EnemyStats` fields are defined and positive
- Color is unique (not used by any other enemy type)
- Size is within valid range (0.1-1.0)
- Speed is positive
- Value is positive integer

### 5. Run Tests
```bash
npm test -- --no-watch --browsers=ChromeHeadless
```
All tests must pass before considering this complete.

## Important
- Do NOT add magic numbers. All values go in `ENEMY_STATS`.
- Enemy mesh creation is automatic — `EnemyService.spawnEnemy()` reads `ENEMY_STATS[type].color` and `size` to create the sphere mesh. No mesh code changes needed.
- If adding a special enemy mechanic (shields, healing, splitting), that requires `EnemyService` changes — document the mechanic clearly and add dedicated tests.
- Health bar color transitions (green→yellow→red) are automatic based on health percentage.
