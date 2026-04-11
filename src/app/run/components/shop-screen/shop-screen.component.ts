import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { ShopItem } from '../../models/encounter.model';
import { RelicDefinition, RelicRarity, RELIC_DEFINITIONS } from '../../models/relic.model';
import { CardDefinition, CardRarity } from '../../models/card.model';
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
  /** Emits item index, or -1 for heal purchase. */
  @Output() itemBought = new EventEmitter<number>();
  @Output() shopLeft = new EventEmitter<void>();

  readonly healCost = SHOP_CONFIG.healCostPerLife;
  readonly maxHealPerVisit = SHOP_CONFIG.maxHealPerVisit;
  healCount = 0;

  /** Pre-computed relic definitions — avoids per-CD-cycle allocations in template. */
  resolvedItems: ResolvedShopItem[] = [];

  ngOnChanges(): void {
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
}
