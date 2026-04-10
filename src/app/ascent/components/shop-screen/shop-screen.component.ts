import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ShopItem } from '../../models/encounter.model';
import { RelicDefinition, RelicRarity, RELIC_DEFINITIONS } from '../../models/relic.model';
import { SHOP_CONFIG } from '../../constants/ascent.constants';

/** CSS class suffix returned per rarity. */
const RARITY_CLASS: Record<RelicRarity, string> = {
  [RelicRarity.COMMON]: 'common',
  [RelicRarity.UNCOMMON]: 'uncommon',
  [RelicRarity.RARE]: 'rare',
};

@Component({
  selector: 'app-shop-screen',
  templateUrl: './shop-screen.component.html',
  styleUrls: ['./shop-screen.component.scss'],
})
export class ShopScreenComponent {
  @Input() shopItems: ShopItem[] = [];
  @Input() currentGold: number = 0;
  @Input() currentLives: number = 0;
  @Input() maxLives: number = 0;
  /** Emits item index, or -1 for heal purchase. */
  @Output() itemBought = new EventEmitter<number>();
  @Output() shopLeft = new EventEmitter<void>();

  readonly healCost = SHOP_CONFIG.healCostPerLife;
  readonly maxHealPerVisit = SHOP_CONFIG.maxHealPerVisit;
  healCount = 0;

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

  getRelicDef(item: ShopItem): RelicDefinition | null {
    if (item.item.type === 'relic') {
      return RELIC_DEFINITIONS[item.item.relicId] ?? null;
    }
    return null;
  }

  getRarityClass(item: ShopItem): string {
    const relic = this.getRelicDef(item);
    if (!relic) return 'common';
    return RARITY_CLASS[relic.rarity] ?? 'common';
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
