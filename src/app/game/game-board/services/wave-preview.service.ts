import { Injectable } from '@angular/core';
import { EnemyType } from '../models/enemy.model';
import { WaveService } from './wave.service';
import { RelicService } from '../../../run/services/relic.service';

/** Summary of a future wave's enemy composition, for the spawn-preview HUD. */
export interface FutureWaveSummary {
  /** 1-indexed wave number (matches what the HUD shows). */
  readonly waveNumber: number;
  /** Enemy counts grouped by type. Ordered by first appearance in the wave. */
  readonly enemies: readonly { readonly type: EnemyType; readonly count: number }[];
}

/**
 * Tracks how many upcoming *waves* the player can see beyond the current one,
 * and produces grouped composition summaries for the HUD.
 *
 * Two bonus sources compose additively:
 *  - Permanent: read live from `RelicService.getMods().wavePreviewBonus`
 *    (e.g. SCOUTING_LENS → +2 while held).
 *  - One-shot: incremented by scout spell cards (SCOUT_AHEAD, SCOUT_ELITE)
 *    and persists for the remainder of the encounter. Reset between encounters.
 *
 * Component-scoped — the one-shot counter is encounter-lifecycle state.
 * Call `resetForEncounter()` from the component's restart/encounter-start path.
 */
@Injectable()
export class WavePreviewService {
  private oneShotBonus = 0;

  constructor(
    private waveService: WaveService,
    private relicService: RelicService,
  ) {}

  /**
   * Grant the player extra wave-preview depth for the rest of this encounter.
   * Called from the scout-spell handler; stacks additively with existing bonus.
   */
  addOneShotBonus(waves: number): void {
    if (waves <= 0) return;
    this.oneShotBonus += waves;
  }

  /** Current total preview depth (waves past the current one). 0 means no future waves visible. */
  getPreviewDepth(): number {
    const permBonus = this.relicService.getModifiers().wavePreviewBonus;
    return this.oneShotBonus + permBonus;
  }

  /**
   * Returns grouped enemy summaries for the next `getPreviewDepth()` waves
   * past `currentWaveIndex`. Handles both legacy `entries[]` and authored
   * `spawnTurns[][]` wave formats.
   *
   * Empty array when no bonus is active or no future waves remain.
   *
   * @param currentWaveIndex 0-indexed current wave. The NEXT wave is currentWaveIndex + 1.
   */
  getFutureWavesSummary(currentWaveIndex: number): FutureWaveSummary[] {
    const depth = this.getPreviewDepth();
    if (depth <= 0) return [];

    const defs = this.waveService.getWaveDefinitions();
    const out: FutureWaveSummary[] = [];

    for (let i = 1; i <= depth; i++) {
      const idx = currentWaveIndex + i;
      if (idx < 0 || idx >= defs.length) break;

      const def = defs[idx];
      // Preserve insertion order: Map keeps first-seen-first-out semantics.
      const grouped = new Map<EnemyType, number>();

      if (def.spawnTurns) {
        for (const turn of def.spawnTurns) {
          for (const type of turn) {
            grouped.set(type, (grouped.get(type) ?? 0) + 1);
          }
        }
      } else if (def.entries) {
        for (const entry of def.entries) {
          grouped.set(entry.type, (grouped.get(entry.type) ?? 0) + entry.count);
        }
      }

      out.push({
        waveNumber: idx + 1,
        enemies: Array.from(grouped.entries()).map(([type, count]) => ({ type, count })),
      });
    }

    return out;
  }

  /** Reset encounter-scoped state. Call from the component's encounter-start / restart path. */
  resetForEncounter(): void {
    this.oneShotBonus = 0;
  }

  // ── Checkpoint serialize/restore ────────────────────────────────────────
  // Wave-preview is a low-stakes cosmetic bonus; only the one-shot counter
  // needs to survive a save/resume so a mid-encounter scout card stays in
  // effect. Permanent bonus is derived from RelicService which has its own
  // serialization.

  serialize(): { oneShotBonus: number } {
    return { oneShotBonus: this.oneShotBonus };
  }

  /**
   * Restore one-shot bonus from a checkpoint snapshot.
   *
   * Defensive: a malformed snapshot (missing field, wrong type) would otherwise
   * let `undefined`/`NaN` poison `getPreviewDepth()` arithmetic and silently
   * zero out scout reveals for the rest of the encounter. Any input that isn't
   * a finite non-negative integer coerces to 0 — the safest default (no bonus).
   *
   * See STRATEGIC_AUDIT.md Finding 1 (Phase 9–12 red team).
   */
  restore(snapshot: { oneShotBonus: number } | null | undefined): void {
    const raw = snapshot?.oneShotBonus;
    const valid = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0;
    this.oneShotBonus = valid ? Math.floor(raw) : 0;
  }
}
