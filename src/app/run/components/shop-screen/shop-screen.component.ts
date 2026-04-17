import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { ShopItem } from '../../models/encounter.model';
import { RelicDefinition, RelicRarity, RELIC_DEFINITIONS } from '../../models/relic.model';
import { CardDefinition, CardInstance, CardRarity } from '../../models/card.model';
import { getCardDefinition } from '../../constants/card-definitions';
import { SHOP_CONFIG } from '../../constants/run.constants';

/** CSS class suffix returned per rarity. */
const RARITY_CLASS: Record<RelicRarity | CardRarity, string> = {
  [RelicRarity.COMMON]: 'common',
  [RelicRarity.UNCOMMON]: 'uncommon',
  [RelicRarity.RARE]: 'rare',
  [CardRarity.STARTER]: 'common',
};

/** Pre-resolved shop item with relic or card definition cached. */
export interface ResolvedShopItem {
  readonly item: ShopItem;
  readonly index: number;
  readonly relic: RelicDefinition | null;
  readonly card: CardDefinition | null;
  readonly rarityClass: string;
}

@Component({
  selector: 'app-shop-screen',
  templateUrl: './shop-screen.component.html',
  styleUrls: ['./shop-screen.component.scss'],
})
export class ShopScreenComponent implements OnChanges {
  @Input() shopItems: ShopItem[] = [];
  @Input() currentGold = 0;
  @Input() currentLives = 0;
  @Input() maxLives = 0;
  /** All card instances in the player's deck — fed in for the card-remove picker. */
  @Input() deckCards: CardInstance[] = [];
  /** Emits item index, or -1 for heal purchase. */
  @Output() itemBought = new EventEmitter<number>();
  @Output() shopLeft = new EventEmitter<void>();
  /** Emits the instanceId of the card the player chose to permanently remove. */
  @Output() cardRemoved = new EventEmitter<string>();

  readonly healCost = SHOP_CONFIG.healCostPerLife;
  readonly maxHealPerVisit = SHOP_CONFIG.maxHealPerVisit;
  readonly cardRemoveCost = SHOP_CONFIG.cardRemoveCost;
  healCount = 0;
  /** True after the player has used the one card-remove slot for this shop visit. */
  cardRemoveUsed = false;
  /** Toggle between the default shop view and the card-removal picker. */
  activeAction: 'none' | 'remove' = 'none';

  /** Pre-computed relic definitions — avoids per-CD-cycle allocations in template. */
  resolvedItems: ResolvedShopItem[] = [];

  ngOnChanges(): void {
    // Reset per-visit shop state on every new shop visit (new shopItems input binding).
    this.healCount = 0;
    this.cardRemoveUsed = false;
    this.activeAction = 'none';
    this.resolvedItems = this.shopItems.map((item, index) => {
      const relic = this.resolveRelicDef(item);
      const card = this.resolveCardDef(item);
      const rarity = relic?.rarity ?? card?.rarity;
      return {
        item,
        index,
        relic,
        card,
        rarityClass: rarity ? (RARITY_CLASS[rarity] ?? 'common') : 'common',
      };
    });
    this.relicItems = this.resolvedItems.filter(r => r.item.item.type === 'relic');
    this.cardItems = this.resolvedItems.filter(r => r.item.item.type === 'card');
  }

  /** Pre-computed lists used in template to avoid pure-pipe allocation per-CD. */
  relicItems: ResolvedShopItem[] = [];
  cardItems: ResolvedShopItem[] = [];

  canAfford(cost: number): boolean {
    return this.currentGold >= cost;
  }

  canHeal(): boolean {
    return (
      this.currentLives < this.maxLives &&
      this.healCount < this.maxHealPerVisit &&
      this.currentGold >= this.healCost
    );
  }

  private resolveRelicDef(item: ShopItem): RelicDefinition | null {
    if (item.item.type === 'relic') {
      return RELIC_DEFINITIONS[item.item.relicId] ?? null;
    }
    return null;
  }

  private resolveCardDef(item: ShopItem): CardDefinition | null {
    if (item.item.type === 'card') {
      return getCardDefinition(item.item.cardId) ?? null;
    }
    return null;
  }

  buyItem(index: number): void {
    if (index < 0 || index >= this.shopItems.length) return;
    if (!this.canAfford(this.shopItems[index].cost)) return;
    this.itemBought.emit(index);
  }

  buyHeal(): void {
    if (!this.canHeal()) return;
    this.healCount++;
    this.itemBought.emit(-1);
  }

  leave(): void {
    this.shopLeft.emit();
  }

  /** True when the card-remove slot is still available AND the player can afford it. */
  canRemoveCard(): boolean {
    return !this.cardRemoveUsed
      && this.currentGold >= this.cardRemoveCost
      && this.removableCards.length > 0;
  }

  /** Cards eligible for removal — non-starter cards only (StS convention). */
  get removableCards(): CardInstance[] {
    return this.deckCards.filter(c => {
      const def = getCardDefinition(c.cardId);
      return def.rarity !== CardRarity.STARTER;
    });
  }

  /** Open the card-removal picker. No-op if the slot has been used or unaffordable. */
  showRemovePanel(): void {
    if (!this.canRemoveCard()) return;
    this.activeAction = 'remove';
  }

  /** Cancel the picker, return to default shop view. */
  cancelRemove(): void {
    this.activeAction = 'none';
  }

  /** Player picked a card. Mark slot used, close picker, emit upward. */
  selectCardToRemove(card: CardInstance): void {
    if (this.cardRemoveUsed) return;
    this.cardRemoveUsed = true;
    this.activeAction = 'none';
    this.cardRemoved.emit(card.instanceId);
  }

  /** Display name for a card instance — delegates to definition lookup. */
  getCardName(card: CardInstance): string {
    return getCardDefinition(card.cardId).name;
  }

  /** Description shown next to the name in the picker. */
  getCardDescription(card: CardInstance): string {
    return getCardDefinition(card.cardId).description;
  }
}
