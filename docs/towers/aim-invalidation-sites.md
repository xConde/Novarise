# Aim-Invalidation Sites

Tower cache invalidation hooks wired in Phase C (sprints 37-39).

## What gets invalidated when

### Bulk invalidation (all towers dirtied)

| Event | Source | Method |
|---|---|---|
| Enemy spawns | `EnemyService.spawnEnemy` → `enemiesChanged.next('spawn')` | `TargetPreviewService.invalidate()` |
| Enemies move | `EnemyService.stepEnemiesOneTurn` → `enemiesChanged.next('move')` | `TargetPreviewService.invalidate()` |
| Enemy removed | `EnemyService.removeEnemy` → `enemiesChanged.next('remove')` | `TargetPreviewService.invalidate()` |

Enemy moves are the most frequent trigger (once per turn resolution). All towers are dirtied because any tower's nearest/first/strongest target could shift when enemy positions change.

### Per-tower invalidation

| Event | Source file | Call site | Key |
|---|---|---|---|
| Tower placed via card | `game-board.component.ts` `tryPlaceTower` | After `registerTower` | `${row}-${col}` |
| Tower upgraded (manual) | `game-board.component.ts` `upgradeTower` | After `towerInteractionService.upgradeTower` succeeds | `selectedTowerInfo.id` |
| FORTIFY card fires | `card-play.service.ts` `fortifyRandomTower` | After each free upgrade loop iteration | `${row}-${col}` |
| Targeting mode cycled | `game-board.component.ts` `cycleTargeting` | After `towerSelectionService.cycleTargeting` | `${tower.row}-${tower.col}` |

## Over-invalidation trade-offs

- **Enemy move invalidates ALL towers**: EnemyService emits one signal per `stepEnemiesOneTurn` call (once per turn), not per enemy. This means O(towers) cache misses per turn-step. With ≤30 towers and `findTarget` running in O(local) via `spatialGrid.queryRadius`, the recompute cost is well within the 2ms-per-frame budget established in the aim-plan Phase A perf gate.
- **STRONGEST/WEAKEST modes and enemy damage**: Enemy `damageEnemy` does NOT emit an `enemiesChanged` signal. Health-based targeting modes will therefore not recompute on mid-combat damage ticks — only on spawn/move/remove. This is acceptable because: (a) targeting-mode picks only affect which enemy is aimed at, not fire resolution; (b) the aim visual follows moves faithfully; (c) re-adding a damage signal would emit dozens of times per turn-step, increasing invalidation cost. If a future sprint needs health-sensitivity, add `'damage'` to the Subject payload and gate bulk-dirty behind a STRONGEST/WEAKEST mode check in `TargetPreviewService.wireEnemySubscription`.

## Sites NOT hooked (acceptable gaps)

- **Relic effects that grant passive range bonuses**: relics that modify the global modifier stats (e.g. `MODIFIER_STAT.TOWER_RANGE`) affect all towers via `getEffectiveStats`. These activate on relic pickup (encounter setup), not mid-turn. The next enemy-move event will flush the cache anyway.
- **Turn-scoped modifier cards that alter tower stats**: `CardEffectService.applyModifier` writes to global modifier active-list; individual tower effective stats derive from this at call time. No per-tower cache entry is stale beyond the next enemy event. Over-invalidation path via enemy move covers it.
