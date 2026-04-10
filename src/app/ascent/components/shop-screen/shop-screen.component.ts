import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { ShopItem } from '../../models/encounter.model';
import { RelicDefinition, RelicRarity, RELIC_DEFINITIONS } from '../../models/relic.model';
import { SHOP_CONFIG } from '../../constants/ascent.constants';

/** CSS class suffix returned per rarity. */
const RARITY_CLASS: Record<RelicRarity, string> = {
  [RelicRarity.COMMON]: 'common',
  [RelicRarity.UNCOMMON]: 'uncommon',
  [RelicRarity.RARE]: 'rare',
};

/** Pre-resolved shop item with relic definition cached. */
export interface ResolvedShopItem {
  readonly item: ShopItem;
  readonly index: number;
  readonly relic: RelicDefinition | null;
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
      return {
        item,
        index,
        relic,
        rarityClass: relic ? (RARITY_CLASS[relic.rarity] ?? 'common') : 'common',
      };
    });
  }

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
