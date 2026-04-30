import { Injectable, Optional } from '@angular/core';
import { Enemy } from '../models/enemy.model';
import { PlacedTower, getEffectiveStats } from '../models/tower.model';
import { TowerCombatService } from './tower-combat.service';

/**
 * Caches the current preview target per tower so the aim subsystem can query
 * it every frame without driving targeting-mode logic itself.
 *
 * Component-scoped — provided in `GameBoardComponent.providers`. Lifecycle
 * is tied to the encounter; the cache is reset between encounters via
 * `clearAll()`.
 *
 * Cache model for Phase A: every `getPreviewTarget` call resolves directly
 * against `TowerCombatService.findTarget`. Phase C will introduce dirty-flag
 * invalidation so bulk recompute is amortised across frames rather than
 * recomputed on every call.
 *
 * Key format: `"${row}-${col}"` — matches the key format used by
 * TowerCombatService and BoardMeshRegistryService throughout the codebase.
 */
@Injectable()
export class TargetPreviewService {
  private readonly cache = new Map<string, Enemy | null>();

  constructor(
    // @Optional() so test beds that don't provide TowerCombatService still
    // compile. When absent, getPreviewTarget always returns null.
    @Optional() private combatService?: TowerCombatService,
  ) {}

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
   * Delegates directly to `TowerCombatService.findTarget`. Phase C will gate
   * this behind a dirty flag so bulk recompute is amortised across frames.
   */
  getPreviewTarget(tower: PlacedTower): Enemy | null {
    if (!this.combatService) return null;
    const stats = getEffectiveStats(tower.type, tower.level, tower.specialization);
    return this.combatService.findTarget(tower, stats);
  }

  /**
   * Marks the cache entry for one tower (or all towers when no key is given)
   * as dirty so the next `getPreviewTarget` call recomputes it.
   *
   * Phase A: the cache is not yet used for memoisation, so this is a no-op
   * that exists for Phase C to plug dirty-flag logic into without changing
   * call sites.
   */
  invalidate(_towerKey?: string): void {
    // Phase C: set dirty flags here. No-op in Phase A.
  }

  /**
   * Recomputes dirty cache entries for all registered towers.
   *
   * Phase A: no-op. Phase C will perform the bounded per-frame recompute
   * budget (round-robin if the perf gate from the aim plan is exceeded).
   */
  tickPreviewCache(): void {
    // Phase C: recompute dirty entries here. No-op in Phase A.
  }

  /** Clears the entire cache. Call on encounter teardown. */
  clearAll(): void {
    this.cache.clear();
  }
}
