import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CardDefinition, CardId, CardRarity, CardType } from '../../models/card.model';
import { CardReward } from '../../models/encounter.model';
import { getCardDefinition } from '../../constants/card-definitions';

@Component({
  selector: 'app-card-draft',
  templateUrl: './card-draft.component.html',
  styleUrls: ['./card-draft.component.scss'],
})
export class CardDraftComponent {
  @Input() cardChoices: CardReward[] = [];
  /** Gold awarded on skip (0 = show plain "Skip Card"). */
  @Input() skipGoldAmount = 0;
  @Output() cardPicked = new EventEmitter<CardReward>();
  @Output() skipped = new EventEmitter<void>();

  selectedCard: CardId | null = null;

  get resolvedCards(): Array<{ reward: CardReward; definition: CardDefinition }> {
    return this.cardChoices.map(reward => ({
      reward,
      definition: getCardDefinition(reward.cardId),
    }));
  }

  pickCard(reward: CardReward): void {
    this.selectedCard = reward.cardId;
    this.cardPicked.emit(reward);
  }

  skip(): void {
    this.skipped.emit();
  }

  getTypeClass(type: CardType): string {
    return `card-draft__card--${type}`;
  }

  getRarityClass(rarity: CardRarity): string {
    return `card-draft__card--rarity-${rarity}`;
  }

  getFrameClass(type: CardType): string {
    return `card-draft__card--frame-${type}`;
  }
}
