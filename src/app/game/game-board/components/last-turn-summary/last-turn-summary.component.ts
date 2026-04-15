import { Component, HostBinding, Input } from '@angular/core';
import { TurnEventRecord } from '../../services/turn-history.service';

// Back-compat alias for call sites that still import TurnSummary.
export type TurnSummary = TurnEventRecord;

/**
 * LastTurnSummaryComponent — right-side "RECAP" panel mirroring the left-side
 * INCOMING spawn preview. Renders the most recent completed turns (most
 * recent highlighted, older dimmed) so the player can scan what just
 * happened without having to recall from memory.
 *
 * Replaces the earlier 2.5s bottom-center flash; the panel is persistent for
 * the duration of combat and updates live via `records` input (driven by
 * TurnHistoryService.records$ on the parent).
 *
 * The panel hides itself entirely when there are no records to show (fresh
 * encounter, turn 0) so it doesn't clutter the setup moment.
 */
@Component({
  selector: 'app-last-turn-summary',
  templateUrl: './last-turn-summary.component.html',
  styleUrls: ['./last-turn-summary.component.scss'],
})
export class LastTurnSummaryComponent {
  /**
   * Turn records to display. Sorted oldest → newest by TurnHistoryService's
   * rolling buffer; the component reverses for display (newest first).
   */
  @Input() records: readonly TurnEventRecord[] = [];

  /** Maximum number of turn rows to render at once (high-level consolidation). */
  private static readonly MAX_ROWS = 3;

  /** Most recent N records, newest first. The first row is the current highlight. */
  get displayRows(): TurnEventRecord[] {
    if (this.records.length === 0) return [];
    return [...this.records].reverse().slice(0, LastTurnSummaryComponent.MAX_ROWS);
  }

  /** True when there's at least one completed turn to show. */
  get hasRecords(): boolean {
    return this.records.length > 0;
  }

  /**
   * Hide the host element entirely when there are no records — avoids an
   * empty glass panel sitting at the right edge on a fresh encounter (before
   * the player has resolved any turns).
   */
  @HostBinding('class.last-turn-summary--empty')
  get isEmpty(): boolean {
    return !this.hasRecords;
  }

  /**
   * True when a row has nothing noteworthy (no cards played, no kills, no
   * gold, no lives lost). Shown as a muted "— quiet turn —" placeholder so
   * the row stays present (players see turn pacing) without being noisy.
   */
  isQuietTurn(row: TurnEventRecord): boolean {
    return row.cardsPlayed === 0
      && row.kills === 0
      && row.goldEarned === 0
      && row.livesLost === 0;
  }
}
