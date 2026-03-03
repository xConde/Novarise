---
name: new-tower
description: Scaffold a new tower type end-to-end following the established config-driven pattern.
disable-model-invocation: true
argument-hint: "[tower-name] [archetype: damage|utility|area]"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(npm test *)
---

# New Tower Scaffolding

Add a new tower type to Novarise following the established patterns exactly.

**Arguments:** `$0` = tower name (e.g., "frost"), `$1` = archetype (damage, utility, or area)

## Checklist

### 1. Add Enum Value
**File:** `src/app/game/game-board/models/tower.model.ts`

Add to `TowerType` enum:
```typescript
TOWER_NAME = 'tower_name'
```
Use lowercase snake_case for the string value.

### 2. Add Stats Config
**File:** `src/app/game/game-board/models/tower.model.ts`

Add entry to `TOWER_CONFIGS` following the `TowerStats` interface:
```typescript
[TowerType.TOWER_NAME]: {
  damage: number,        // Base damage per hit
  range: number,         // Tiles (typically 2-7)
  fireRate: number,      // Seconds between shots (lower = faster)
  cost: number,          // Gold to place (typically 50-150)
  projectileSpeed: number, // Tiles per second (typically 5-15)
  splashRadius: number,  // 0 for single-target, 1-3 for area
  color: 0xRRGGBB        // Projectile/mesh accent color
}
```

**Balance guidelines by archetype:**
- **damage:** High damage, medium range, slow fire rate, expensive (like Sniper)
- **utility:** Low/no damage, special effect, medium cost (debuffs, not kills)
- **area:** Low damage per hit, splash radius > 0, medium fire rate (like Splash)

### 3. Create Tower Mesh
**File:** `src/app/game/game-board/game-board.service.ts`

Add a new `case TowerType.TOWER_NAME:` in `createTowerMesh()`.

Follow the existing mesh pattern:
- Create 4-6 geometry pieces (cylinders, cones, spheres)
- One shared `MeshStandardMaterial` with the tower's color, emissive, metalness, roughness
- Position pieces vertically (y = 0.1 to ~1.5)
- Add all meshes to `towerGroup`

**Existing tower aesthetics for reference:**
- BASIC: Crystal obelisk (amber) — stacked cylinders + octahedron
- SNIPER: Crystalline spike (purple) — dodecahedron base + tapered cones
- SPLASH: Mushroom/spore (green) — stem + cap + floating spores

Design something visually distinct from all existing towers.

### 4. Add UI Button
**File:** `src/app/game/game-board/game-board.component.html`

Add a tower selection button matching the existing pattern:
```html
<button class="tower-btn"
        [class.selected]="selectedTowerType === TowerType.TOWER_NAME"
        [class.disabled]="!(gameState$ | async)?.gold || (gameState$ | async)!.gold < towerConfigs.TOWER_NAME.cost"
        (click)="selectTowerType(TowerType.TOWER_NAME)">
  <span class="tower-icon">ICON</span>
  <span class="tower-name">Tower Name</span>
  <span class="tower-cost">{{towerConfigs.TOWER_NAME.cost}}g</span>
</button>
```

### 5. Add Tests
**File:** `src/app/game/game-board/models/tower.model.spec.ts` (create if it doesn't exist)

Add tests for:
- Config completeness: all `TowerStats` fields are defined
- `getEffectiveStats()` returns correct values at each level
- `getUpgradeCost()` returns correct values for the new type
- `getSellValue()` returns 50% of invested gold

### 6. Run Tests
```bash
npm test -- --no-watch --browsers=ChromeHeadless
```
All tests must pass before considering this complete.

## Important
- Do NOT add magic numbers anywhere. All values go in `TOWER_CONFIGS`.
- The tower color must be visually distinct from all existing towers in `TOWER_CONFIGS`. Check existing colors before choosing.
- If adding a utility tower (no damage), set `damage: 0` and document the special behavior in a code comment.
- `splashRadius: 0` means single-target. Any value > 0 triggers splash damage logic in `TowerCombatService`.
