import { Component, HostBinding, Input } from '@angular/core';
import { TurnEventRecord } from '../../services/turn-history.service';
import { TowerType } from '../../models/tower.model';

// Back-compat alias for call sites that still import TurnSummary.
export type TurnSummary = TurnEventRecord;

/** One row of per-tower kill attribution in the expanded view. */
export interface KillAttributionEntry {
  /** Tower type, or 'dot' for non-tower status-effect kills. */
  readonly key: TowerType | 'dot';
  /** Tower level (1–3) or 0 for DoT. Drives the tier suffix. */
  readonly level: number;
  /**
   * Compact display label — "B" / "Sn" / "M3" / "DoT". Tier-1 towers omit
   * the number suffix (user intent: "tier 1 doesn't get anything special").
   * Tier 2+ append the level.
   */
  readonly shortLabel: string;
  /** Full human-readable label with tier — used in the tooltip. */
  readonly fullLabel: string;
  /** Number of kills this (type, level) pair landed this turn. */
  readonly count: number;
}

/** Long-form tower names for tooltips + screen readers. */
const TOWER_FULL_NAMES: Record<TowerType | 'dot', string> = {
  [TowerType.BASIC]: 'Basic',
  [TowerType.SNIPER]: 'Sniper',
  [TowerType.SPLASH]: 'Splash',
  [TowerType.SLOW]: 'Slow',
  [TowerType.CHAIN]: 'Chain',
  [TowerType.MORTAR]: 'Mortar',
  dot: 'DoT',
};

/**
 * Compact 1–2 letter tokens per tower type. Chess-style abbreviation so
 * multiple attributions fit on a single line. Players unfamiliar with the
 * shorthand get the long form via a `title` tooltip on hover.
 */
const TOWER_SHORT_TOKENS: Record<TowerType | 'dot', string> = {
  [TowerType.BASIC]: 'B',
  [TowerType.SNIPER]: 'Sn',
  [TowerType.SPLASH]: 'Sp',
  [TowerType.SLOW]: 'Sl',
  [TowerType.CHAIN]: 'C',
  [TowerType.MORTAR]: 'M',
  dot: 'DoT',
};

/**
 * LastTurnSummaryComponent — right-side "RECAP" panel mirroring INCOMING.
 * Shows the most recent 3 completed turns at a glance; clicking a row
 * expands it inline to reveal per-tower kill attribution.
 *
 * Data model (per TurnEventRecord): turn number, gold earned, damage dealt,
 * kills + per-tower breakdown, cards played, lives lost. Rendered in the
 * order gold → damage → kills → cards → lives (user requirement: gold
 * exchange first, `|` separators).
 */
@Component({
  selector: 'app-last-turn-summary',
  templateUrl: './last-turn-summary.component.html',
  styleUrls: ['./last-turn-summary.component.scss'],
})
export class LastTurnSummaryComponent {
  @Input() records: readonly TurnEventRecord[] = [];

  private static readonly MAX_ROWS = 3;

  /** Turn numbers currently expanded (inline breakdown visible). */
  private readonly expandedTurns = new Set<number>();

  /** Most recent N records, newest first. First element is the top row. */
  get displayRows(): TurnEventRecord[] {
    if (this.records.length === 0) return [];
    return [...this.records].reverse().slice(0, LastTurnSummaryComponent.MAX_ROWS);
  }

  get hasRecords(): boolean {
    return this.records.length > 0;
  }

  @HostBinding('class.last-turn-summary--empty')
  get isEmpty(): boolean {
    return !this.hasRecords;
  }

  /**
   * Quiet turn = literally nothing happened. With damage tracking added,
   * a turn with hits-but-no-kills no longer reads as quiet — which is good,
   * that's the "towers fired but didn't finish anyone off" case the player
   * definitely wants to see.
   */
  isQuietTurn(row: TurnEventRecord): boolean {
    return row.cardsPlayed === 0
      && row.kills === 0
      && row.damageDealt === 0
      && row.goldEarned === 0
      && row.livesLost === 0;
  }

  isExpanded(row: TurnEventRecord): boolean {
    return this.expandedTurns.has(row.turnNumber);
  }

  toggleExpanded(row: TurnEventRecord): void {
    if (this.expandedTurns.has(row.turnNumber)) {
      this.expandedTurns.delete(row.turnNumber);
    } else {
      this.expandedTurns.add(row.turnNumber);
    }
  }

  /**
   * Per-(tower type, level) kill attribution, sorted by count desc so the
   * highest-contributing entry surfaces first. Compact chess-style label
   * in `shortLabel` ("B" / "Sn2" / "M3"), full expanded label in
   * `fullLabel` for tooltips. Tier-1 towers omit the number suffix per
   * user spec. Empty when the turn had no kills.
   */
  killAttribution(row: TurnEventRecord): KillAttributionEntry[] {
    const out: KillAttributionEntry[] = [];
    for (const entry of row.killsByTower) {
      if (entry.count <= 0) continue;
      const token = TOWER_SHORT_TOKENS[entry.type] ?? String(entry.type);
      const name = TOWER_FULL_NAMES[entry.type] ?? String(entry.type);
      // Tier-1 (level 1) → no suffix. Tier 2+ → numeric suffix. DoT has
      // level 0 and also omits the suffix.
      const suffix = entry.level >= 2 ? String(entry.level) : '';
      const shortLabel = `${token}${suffix}`;
      const fullLabel = entry.level >= 2
        ? `${name} Tier ${entry.level}`
        : name;
      out.push({
        key: entry.type,
        level: entry.level,
        shortLabel,
        fullLabel,
        count: entry.count,
      });
    }
    out.sort((a, b) => b.count - a.count);
    return out;
  }

  /** True when there's enough detail in a row to justify expanding it. */
  hasExpandableDetail(row: TurnEventRecord): boolean {
    return row.kills > 0 || row.damageDealt > 0;
  }
}
