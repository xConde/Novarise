import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RelicDefinition, RELIC_DEFINITIONS, RelicId, RelicRarity } from '../../models/relic.model';
import { RewardScreenConfig, RewardItem } from '../../models/encounter.model';

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

  /** Resolve relic definitions from reward IDs for display. */
  get relicCards(): RelicDefinition[] {
    return this.config.relicChoices
      .map(r => RELIC_DEFINITIONS[r.relicId])
      .filter((r): r is RelicDefinition => r !== undefined);
  }

  getRarityClass(rarity: RelicRarity): string {
    return RARITY_CLASS[rarity] ?? 'common';
  }

  pickRelic(relic: RelicDefinition): void {
    this.selectedRelic = relic.id;
    this.relicPicked = true;
    this.rewardCollected.emit({ type: 'relic', relicId: relic.id });
  }

  skipRelics(): void {
    this.relicPicked = true;
  }

  continue(): void {
    this.screenClosed.emit();
  }
}
