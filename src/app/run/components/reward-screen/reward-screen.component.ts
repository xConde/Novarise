import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RelicDefinition, RELIC_DEFINITIONS, RelicId, RelicRarity } from '../../models/relic.model';
import { RewardScreenConfig, RewardItem, CardReward } from '../../models/encounter.model';
import { ChallengeDefinition, CHALLENGE_SCORE_TO_GOLD_RATIO, computeChallengeGoldBonus } from '../../data/challenges';

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
  @Output() rewardCollected = new EventEmitter<RewardItem>();
  @Output() screenClosed = new EventEmitter<void>();

  selectedRelic: RelicId | null = null;
  relicPicked = false;
  cardPicked = false;

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
    this.rewardCollected.emit(reward);
  }

  onCardSkipped(): void {
    this.cardPicked = true;
  }

  get canContinue(): boolean {
    const relicDone = this.relicPicked || this.config.relicChoices.length === 0;
    const cardDone = this.cardPicked || this.config.cardChoices.length === 0;
    return relicDone && cardDone;
  }

  continue(): void {
    this.screenClosed.emit();
  }
}
