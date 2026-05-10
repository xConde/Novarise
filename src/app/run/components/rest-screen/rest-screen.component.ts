import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CardInstance, CardId, CardDefinition } from '../../models/card.model';
import { getCardDefinition } from '../../constants/card-definitions';

@Component({
  selector: 'app-rest-screen',
  templateUrl: './rest-screen.component.html',
  styleUrls: ['./rest-screen.component.scss'],
})
export class RestScreenComponent {
  @Input() currentLives!: number;
  @Input() maxLives!: number;
  @Input() healAmount!: number;
  /** All card instances in the player's deck (for upgrade selection). */
  @Input() deckCards: CardInstance[] = [];
  @Output() restChosen = new EventEmitter<void>();
  @Output() skipChosen = new EventEmitter<void>();
  /** Emits the instanceId of the card chosen for upgrade. */
  @Output() cardUpgraded = new EventEmitter<string>();

  /** Tracks which sub-action the player is performing at the rest site. */
  activeAction: 'none' | 'upgrade' = 'none';

  get livesAfterHeal(): number {
    return Math.min(this.maxLives, this.currentLives + this.healAmount);
  }

  get actualHeal(): number {
    return this.livesAfterHeal - this.currentLives;
  }

  get atFullHealth(): boolean {
    return this.currentLives >= this.maxLives;
  }

  /** Cards that can still be upgraded (not already upgraded and define at least one upgrade payload). */
  get upgradableCards(): CardInstance[] {
    return this.deckCards.filter(c => {
      if (c.upgraded) return false;
      const def = getCardDefinition(c.cardId);
      return def.upgradedEffect !== undefined || def.upgradedEnergyCost !== undefined;
    });
  }

  /** Returns the CardDefinition for an instance — used by app-game-card. */
  getCardDefinitionForInstance(card: CardInstance): CardDefinition {
    return getCardDefinition(card.cardId);
  }

  rest(): void {
    this.activeAction = 'none';
    this.restChosen.emit();
  }

  skip(): void {
    this.activeAction = 'none';
    this.skipChosen.emit();
  }

  showUpgradePanel(): void {
    this.activeAction = 'upgrade';
  }

  cancelUpgrade(): void {
    this.activeAction = 'none';
  }

  selectCardToUpgrade(card: CardInstance): void {
    this.activeAction = 'none';
    this.cardUpgraded.emit(card.instanceId);
  }

  /** Returns unique upgrade candidates: at most one entry per CardId. */
  getUniqueUpgradableCards(): CardInstance[] {
    const seen = new Set<CardId>();
    return this.upgradableCards.filter(c => {
      if (seen.has(c.cardId)) return false;
      seen.add(c.cardId);
      return true;
    });
  }
}
