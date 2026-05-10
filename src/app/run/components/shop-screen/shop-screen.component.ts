import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
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
  /** Emits the instanceId of the card the player chose to upgrade. */
  @Output() cardUpgraded = new EventEmitter<string>();

  readonly healCost = SHOP_CONFIG.healCostPerLife;
  readonly maxHealPerVisit = SHOP_CONFIG.maxHealPerVisit;
  /**
   * Live ascension-scaled card-remove cost. Falls back to the base config
   * value when no parent passes the input (e.g. older test beds).
   * Explicit `number` type — SHOP_CONFIG is `as const` so the default would
   * otherwise narrow to its literal value and break parent assignments.
   */
  @Input() cardRemoveCost: number = SHOP_CONFIG.cardRemoveCost;
  /**
   * Live ascension-scaled card-upgrade cost. Falls back to the base config
   * value when no parent passes the input (e.g. older test beds).
   */
  @Input() cardUpgradeCost: number = SHOP_CONFIG.cardUpgradeCost;
  healCount = 0;
  /** True after the player has used the one card-remove slot for this shop visit. */
  cardRemoveUsed = false;
  /** True after the player has used the one card-upgrade slot for this shop visit. */
  cardUpgradeUsed = false;
  /** Toggle between the default shop view and the card-removal or upgrade picker. */
  activeAction: 'none' | 'remove' | 'upgrade' = 'none';
  /**
   * Name of the card that was just removed, captured for the success banner.
   * Cleared on shop revisit (reset in ngOnChanges) so the banner doesn't
   * persist across encounters.
   */
  lastRemovedCardName: string | null = null;
  /**
   * Name of the card that was just upgraded, captured for the success banner.
   * Cleared on shop revisit (reset in ngOnChanges) so the banner doesn't
   * persist across encounters.
   */
  lastUpgradedCardName: string | null = null;

  /** Pre-computed relic definitions — avoids per-CD-cycle allocations in template. */
  resolvedItems: ResolvedShopItem[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    // Phase 1 Sprint 4 hardening (red-team Finding 2):
    // Per-visit state must reset ONLY when shopItems itself changes (new visit).
    // Other inputs — currentGold, currentLives, deckCards — change far more
    // often (deckCards in particular is a method-call binding that returns a
    // new array reference per CD tick), so resetting here on every fire would
    // refund the one-use card-removal slot mid-visit.
    if (changes['shopItems']) {
      this.healCount = 0;
      this.cardRemoveUsed = false;
      this.cardUpgradeUsed = false;
      this.activeAction = 'none';
      this.lastRemovedCardName = null;
      this.lastUpgradedCardName = null;
    }
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

  /** Player picked a card. Mark slot used, close picker, capture name for the success banner, emit upward. */
  selectCardToRemove(card: CardInstance): void {
    if (this.cardRemoveUsed) return;
    this.cardRemoveUsed = true;
    this.activeAction = 'none';
    this.lastRemovedCardName = this.getCardName(card);
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

  /** Returns the CardDefinition for an instance — used by app-library-card-tile. */
  getCardDefinitionForInstance(card: CardInstance): CardDefinition {
    return getCardDefinition(card.cardId);
  }

  // ── Card upgrade slot ─────────────────────────────────────────────────────

  /** True when the card-upgrade slot is still available AND the player can afford it. */
  canUpgradeCard(): boolean {
    return !this.cardUpgradeUsed
      && this.currentGold >= this.cardUpgradeCost
      && this.upgradableCards.length > 0;
  }

  /**
   * Cards eligible for upgrade — non-starter, not already upgraded, and with
   * at least one upgrade payload (upgradedEffect or upgradedEnergyCost).
   * Mirrors the rest-screen gate exactly.
   */
  get upgradableCards(): CardInstance[] {
    return this.deckCards.filter(c => {
      if (c.upgraded) return false;
      const def = getCardDefinition(c.cardId);
      if (def.rarity === CardRarity.STARTER) return false;
      return def.upgradedEffect !== undefined || def.upgradedEnergyCost !== undefined;
    });
  }

  /** Open the card-upgrade picker. No-op if slot used or unaffordable. */
  showUpgradePanel(): void {
    if (!this.canUpgradeCard()) return;
    this.activeAction = 'upgrade';
  }

  /** Cancel the upgrade picker, return to default shop view. */
  cancelUpgrade(): void {
    this.activeAction = 'none';
  }

  /** Player picked a card to upgrade. Mark slot used, close picker, capture name, emit upward. */
  selectCardToUpgrade(card: CardInstance): void {
    if (this.cardUpgradeUsed) return;
    this.cardUpgradeUsed = true;
    this.activeAction = 'none';
    this.lastUpgradedCardName = this.getCardName(card);
    this.cardUpgraded.emit(card.instanceId);
  }

  /** Preview of the description AFTER upgrading — mirrors rest-screen helper. */
  getCardUpgradedDescription(card: CardInstance): string {
    const def = getCardDefinition(card.cardId);
    return def.upgradedDescription ?? `+ ${def.description}`;
  }
}
