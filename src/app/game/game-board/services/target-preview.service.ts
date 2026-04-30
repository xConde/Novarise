import { Injectable, OnDestroy, Optional } from '@angular/core';
import { Subscription } from 'rxjs';
import { Enemy } from '../models/enemy.model';
import { PlacedTower, getEffectiveStats } from '../models/tower.model';
import { TowerCombatService } from './tower-combat.service';
import { EnemyService } from './enemy.service';

/** Sentinel used in the dirty set to mean "invalidate everything". */
const DIRTY_ALL = '*';

/**
 * Caches the current preview target per tower so the aim subsystem can query
 * it every frame without driving targeting-mode logic itself.
 *
 * Component-scoped — provided in `GameBoardComponent.providers`. Lifecycle
 * is tied to the encounter; the cache is reset between encounters via
 * `clearAll()`.
 *
 * Cache model: a dirty-Set<string> tracks which tower keys need recompute.
 * The special sentinel `'*'` means "all towers are dirty". On each
 * `getPreviewTarget` call the tower's key is checked against the dirty set;
 * if dirty, `findTarget` is called and the result is cached. This amortises
 * the per-tower `findTarget` cost across the frames between enemy events
 * rather than recomputing unconditionally every frame.
 *
 * Invalidation events:
 *  - Enemy spawn  → invalidate ALL (any tower may now have a target)
 *  - Enemy move   → invalidate ALL (best-target distances shifted)
 *  - Enemy remove → invalidate ALL (dead enemies are no longer candidates)
 *  - Tower placed → invalidate that tower's key (new tower needs first target)
 *  - Targeting-mode change → invalidate that tower's key (different pick rule)
 *  - Tower upgrade / spec → invalidate that tower's key (range may have grown)
 *
 * Over-invalidation on enemy events (all towers dirtied per move/spawn/remove)
 * is intentional: EnemyService emits one signal per turn-step, not per enemy,
 * so the cost is O(enemies-changed × towers) once per turn rather than every
 * frame. findTarget is O(local) via spatialGrid.queryRadius, so bulk recompute
 * is fast.
 *
 * Key format: `"${row}-${col}"` — matches the key format used by
 * TowerCombatService and BoardMeshRegistryService throughout the codebase.
 */
@Injectable()
export class TargetPreviewService implements OnDestroy {
  private readonly cache = new Map<string, Enemy | null>();
  /** Dirty set. Contains specific tower keys or DIRTY_ALL. */
  private readonly dirty = new Set<string>();

  private readonly subscriptions = new Subscription();

  constructor(
    // @Optional() so test beds that don't provide TowerCombatService still
    // compile. When absent, getPreviewTarget always returns null.
    @Optional() private combatService?: TowerCombatService,
    // @Optional() so test beds that omit EnemyService still compile.
    // When absent, the service skips the enemy-change subscription.
    @Optional() private enemyService?: EnemyService,
  ) {
    this.wireEnemySubscription();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * Returns the highest-priority in-range target for the given tower, using
   * the tower's current targeting mode.
   *
   * Uses `getEffectiveStats` so that level-scaled range and specialization
   * bonuses are applied, matching the stats `fireTurn` would use. Without
   * this, a T3 SNIPER (specialization +50% range) would aim at enemies
   * outside L1 range that it can actually hit, while ignoring enemies inside
   * effective range that are outside L1 range.
   *
   * Returns the cached value when the tower's key is clean. Recomputes and
   * updates the cache when the key is dirty or not yet cached.
   */
  getPreviewTarget(tower: PlacedTower): Enemy | null {
    if (!this.combatService) return null;
    const key = `${tower.row}-${tower.col}`;
    const isDirty = this.dirty.has(DIRTY_ALL) || this.dirty.has(key);
    if (!isDirty && this.cache.has(key)) {
      return this.cache.get(key) ?? null;
    }
    const stats = getEffectiveStats(tower.type, tower.level, tower.specialization);
    const result = this.combatService.findTarget(tower, stats);
    this.cache.set(key, result);
    this.dirty.delete(key);
    // When DIRTY_ALL was set and this is the first tower read after the bulk
    // invalidation, leave DIRTY_ALL in the set — it will be cleared when
    // tickPreviewCache() runs a full pass, or stay until the next read per key
    // naturally clears it. To avoid stale DIRTY_ALL blocking clean entries,
    // we check isDirty per-key by also consulting DIRTY_ALL above.
    return result;
  }

  /**
   * Marks the cache entry for one tower (or all towers when no key is given)
   * as dirty so the next `getPreviewTarget` call recomputes it.
   *
   * @param towerKey  `"${row}-${col}"` key. Omit to invalidate all towers.
   */
  invalidate(towerKey?: string): void {
    if (towerKey === undefined) {
      this.dirty.clear();
      this.dirty.add(DIRTY_ALL);
    } else {
      // If DIRTY_ALL is already set, individual key adds are redundant but harmless.
      this.dirty.add(towerKey);
    }
  }

  /**
   * Removes DIRTY_ALL from the dirty set once all towers have been read at
   * least once since the last bulk invalidation. Called at the end of each
   * `tickAim` pass to ensure the bulk-dirty sentinel doesn't accumulate.
   *
   * A targeted DIRTY_ALL clearance (rather than clearing the whole dirty set)
   * preserves any per-key dirty entries that were added mid-frame between
   * tickPreviewCache and the next getPreviewTarget call.
   */
  tickPreviewCache(): void {
    this.dirty.delete(DIRTY_ALL);
  }

  /** Clears the entire cache and dirty set. Call on encounter teardown. */
  clearAll(): void {
    this.cache.clear();
    this.dirty.clear();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /**
   * Subscribe to `EnemyService.getEnemiesChanged()`. Any enemy roster change
   * (spawn, move, remove) triggers a bulk invalidation. STRONGEST/WEAKEST
   * targeting modes depend on enemy health, but since we invalidate ALL on any
   * roster change, health-based modes are covered without needing to filter.
   *
   * Over-invalidation trade-off: all towers are marked dirty on each enemy-
   * step, which means up to 30 findTarget calls per turn resolution. findTarget
   * is O(local) via spatialGrid.queryRadius, so this is acceptable within the
   * 2ms-per-frame perf budget established in the aim-plan Phase A perf gate.
   */
  private wireEnemySubscription(): void {
    if (!this.enemyService) return;
    const sub = this.enemyService.getEnemiesChanged().subscribe(() => {
      this.invalidate(); // bulk-dirty all towers
    });
    this.subscriptions.add(sub);
  }

  /**
   * Returns the current dirty-set size. Exposed for specs that need to assert
   * invalidation fired without going through a full getPreviewTarget cycle.
   * Returns -1 if DIRTY_ALL is set (signals "everything is dirty").
   */
  getDirtyCount(): number {
    if (this.dirty.has(DIRTY_ALL)) return -1;
    return this.dirty.size;
  }
}
