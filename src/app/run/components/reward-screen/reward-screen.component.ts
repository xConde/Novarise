import { Component, HostListener, Input, Output, EventEmitter } from '@angular/core';
import { RelicDefinition, RELIC_DEFINITIONS, RelicId, RelicRarity } from '../../models/relic.model';
import { RewardScreenConfig, RewardItem, CardReward } from '../../models/encounter.model';
import { ChallengeDefinition, CHALLENGE_SCORE_TO_GOLD_RATIO, computeChallengeGoldBonus } from '../../data/challenges';
import { getCardDefinition } from '../../constants/card-definitions';
import { NodeType } from '../../models/node-map.model';
import { SKIP_GOLD_BY_NODE_TYPE } from '../../constants/run.constants';

/** CSS class suffix returned per rarity. */
const RARITY_CLASS: Record<RelicRarity, string> = {
  [RelicRarity.COMMON]: 'common',
  [RelicRarity.UNCOMMON]: 'uncommon',
  [RelicRarity.RARE]: 'rare',
};

@Component({
  selector: 'app-reward-screen',
  templateUrl: './reward-screen.component.html',
  styleUrls: ['./reward-screen.component.scss'],
})
export class RewardScreenComponent {
  @Input() config!: RewardScreenConfig;
  /** Node type drives the skip-gold amount shown on the card-draft skip button. */
  @Input() nodeType: NodeType = NodeType.COMBAT;
  @Output() rewardCollected = new EventEmitter<RewardItem>();
  @Output() screenClosed = new EventEmitter<void>();

  selectedRelic: RelicId | null = null;
  relicPicked = false;
  cardPicked = false;
  /** Name of the card the player added to their deck — shown in the confirmation line. */
  pickedCardName: string | null = null;

  /** Gold awarded when the player skips the card reward — 0 if none for this node type. */
  get skipGoldAmount(): number {
    return SKIP_GOLD_BY_NODE_TYPE[this.nodeType] ?? 0;
  }

  /** Resolve relic definitions from reward IDs for display. */
  get relicCards(): RelicDefinition[] {
    return this.config.relicChoices
      .map(r => RELIC_DEFINITIONS[r.relicId])
      .filter((r): r is RelicDefinition => r !== undefined);
  }

  getRarityClass(rarity: RelicRarity): string {
    return RARITY_CLASS[rarity] ?? 'common';
  }

  /** Per-challenge gold bonus shown next to each completed challenge. */
  challengeGoldBonus(challenge: ChallengeDefinition): number {
    return Math.round(challenge.scoreBonus / CHALLENGE_SCORE_TO_GOLD_RATIO);
  }

  /** Total gold from all completed challenges — shown in the section header. */
  get totalChallengeGold(): number {
    return computeChallengeGoldBonus(this.config.completedChallenges);
  }

  pickRelic(relic: RelicDefinition): void {
    this.selectedRelic = relic.id;
    this.relicPicked = true;
    this.rewardCollected.emit({ type: 'relic', relicId: relic.id });
  }

  skipRelics(): void {
    this.relicPicked = true;
  }

  onCardPicked(reward: CardReward): void {
    this.cardPicked = true;
    const def = getCardDefinition(reward.cardId);
    this.pickedCardName = def?.name ?? null;
    this.rewardCollected.emit(reward);
  }

  /** Display name for the currently-selected relic — null when skipped. */
  get selectedRelicName(): string | null {
    if (!this.selectedRelic) return null;
    return RELIC_DEFINITIONS[this.selectedRelic]?.name ?? null;
  }

  onCardSkipped(): void {
    this.cardPicked = true;
    const bonus = this.skipGoldAmount;
    if (bonus > 0) {
      this.rewardCollected.emit({ type: 'gold', amount: bonus });
    }
  }

  get canContinue(): boolean {
    const relicDone = this.relicPicked || this.config.relicChoices.length === 0;
    const cardDone = this.cardPicked || this.config.cardChoices.length === 0;
    return relicDone && cardDone;
  }

  continue(): void {
    this.screenClosed.emit();
  }

  /**
   * Keyboard shortcuts for the reward screen.
   *  - 1 / 2 / 3 (and numpad) pick the Nth visible option — relic first, then card
   *  - Esc skips the currently-active section (relic if pending, else card)
   *  - Space is intercepted when focus is on the document body to suppress page
   *    scroll, since there's nothing to "activate" with it. If a button is
   *    focused, the browser default (activate) still fires.
   */
  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    // Ignore keystrokes from text inputs/textareas (no fields today, but future-proof).
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    if (event.key === 'Escape') {
      if (this.relicCards.length > 0 && !this.relicPicked) {
        event.preventDefault();
        this.skipRelics();
      } else if (this.config.cardChoices.length > 0 && !this.cardPicked && (this.relicPicked || this.config.relicChoices.length === 0)) {
        event.preventDefault();
        this.onCardSkipped();
      }
      return;
    }

    // Number keys — pick the Nth visible option.
    const n = this.parseNumberKey(event.key);
    if (n !== null) {
      if (this.relicCards.length > 0 && !this.relicPicked) {
        const relic = this.relicCards[n - 1];
        if (relic) {
          event.preventDefault();
          this.pickRelic(relic);
        }
      } else if (this.config.cardChoices.length > 0 && !this.cardPicked) {
        const card = this.config.cardChoices[n - 1];
        if (card) {
          event.preventDefault();
          this.onCardPicked(card);
        }
      }
      return;
    }

    if (event.key === ' ' && (target === null || target === document.body)) {
      // Swallow space when nothing useful is focused — avoids page-scroll and
      // avoids accidental activation bubbling from unrelated focus state.
      event.preventDefault();
    }
  }

  private parseNumberKey(key: string): number | null {
    if (key >= '1' && key <= '9') return Number(key);
    return null;
  }
}
