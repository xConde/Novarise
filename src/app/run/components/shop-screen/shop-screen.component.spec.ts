import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { ShopScreenComponent } from './shop-screen.component';
import { ShopItem } from '../../models/encounter.model';
import { RelicId, RelicRarity, RELIC_DEFINITIONS } from '../../models/relic.model';
import { SHOP_CONFIG } from '../../constants/run.constants';
import { CardId, CardInstance } from '../../models/card.model';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SimpleChange, SimpleChanges } from '@angular/core';

/** Phase 1 hardening helper — Angular's SimpleChange constructor signature
 *  is verbose; this wraps it for the common case where we just need to
 *  signal "shopItems changed" or "deckCards changed" to ngOnChanges. */
function shopItemsChanged(currentValue: unknown = [], previousValue: unknown = []): SimpleChanges {
  return { shopItems: new SimpleChange(previousValue, currentValue, false) };
}

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeRelicShopItem(relicId: RelicId, cost: number): ShopItem {
  return { item: { type: 'relic', relicId }, cost };
}

const COMMON_ITEM = makeRelicShopItem(RelicId.IRON_HEART, 50);
const UNCOMMON_ITEM = makeRelicShopItem(RelicId.CHAIN_REACTION, 100);
const RARE_ITEM = makeRelicShopItem(RelicId.TEMPORAL_RIFT, 200);

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ShopScreenComponent', () => {
  let fixture: ComponentFixture<ShopScreenComponent>;
  let component: ShopScreenComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ShopScreenComponent],
      imports: [CommonModule, IconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ShopScreenComponent);
    component = fixture.componentInstance;
    component.shopItems = [COMMON_ITEM, UNCOMMON_ITEM, RARE_ITEM];
    component.currentGold = 150;
    component.currentLives = 5;
    component.maxLives = 7;
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  describe('canAfford()', () => {
    it('returns true when gold >= cost', () => {
      expect(component.canAfford(150)).toBeTrue();
      expect(component.canAfford(100)).toBeTrue();
    });

    it('returns false when gold < cost', () => {
      expect(component.canAfford(151)).toBeFalse();
      expect(component.canAfford(200)).toBeFalse();
    });
  });

  describe('canHeal()', () => {
    it('returns true when lives < maxLives, heal count under limit, gold sufficient', () => {
      component.currentLives = 5;
      component.maxLives = 7;
      component.currentGold = 100;
      component.healCount = 0;
      expect(component.canHeal()).toBeTrue();
    });

    it('returns false when at full health', () => {
      component.currentLives = 7;
      component.maxLives = 7;
      component.currentGold = 100;
      expect(component.canHeal()).toBeFalse();
    });

    it('returns false when heal count reaches maxHealPerVisit', () => {
      component.currentLives = 5;
      component.maxLives = 7;
      component.currentGold = 100;
      component.healCount = SHOP_CONFIG.maxHealPerVisit;
      expect(component.canHeal()).toBeFalse();
    });

    it('returns false when gold < healCost', () => {
      component.currentLives = 5;
      component.maxLives = 7;
      component.currentGold = SHOP_CONFIG.healCostPerLife - 1;
      component.healCount = 0;
      expect(component.canHeal()).toBeFalse();
    });
  });

  describe('resolvedItems (pre-computed relic defs)', () => {
    beforeEach(() => {
      component.ngOnChanges(shopItemsChanged(component.shopItems));
    });

    it('resolves RelicDefinition for relic items', () => {
      expect(component.resolvedItems[0].relic).toBeDefined();
      expect(component.resolvedItems[0].relic!.id).toBe(RelicId.IRON_HEART);
    });

    it('resolves the correct rarity', () => {
      expect(component.resolvedItems[2].relic!.rarity).toBe(RelicRarity.RARE);
    });

    it('resolves null for a gold item', () => {
      const goldItem: ShopItem = { item: { type: 'gold', amount: 50 }, cost: 0 };
      component.shopItems = [goldItem];
      component.ngOnChanges(shopItemsChanged(component.shopItems));
      expect(component.resolvedItems[0].relic).toBeNull();
    });

    it('computes rarityClass common for a common relic', () => {
      expect(component.resolvedItems[0].rarityClass).toBe('common');
    });

    it('computes rarityClass uncommon for an uncommon relic', () => {
      expect(component.resolvedItems[1].rarityClass).toBe('uncommon');
    });

    it('computes rarityClass rare for a rare relic', () => {
      expect(component.resolvedItems[2].rarityClass).toBe('rare');
    });
  });

  describe('buyItem()', () => {
    it('emits itemBought with the item index when affordable', () => {
      const spy = jasmine.createSpy('itemBought');
      component.itemBought.subscribe(spy);
      component.currentGold = 200;

      component.buyItem(1);

      expect(spy).toHaveBeenCalledWith(1);
    });

    it('does NOT emit when item is unaffordable', () => {
      const spy = jasmine.createSpy('itemBought');
      component.itemBought.subscribe(spy);
      component.currentGold = 10;

      component.buyItem(0);

      expect(spy).not.toHaveBeenCalled();
    });

    it('does NOT emit for an out-of-range index', () => {
      const spy = jasmine.createSpy('itemBought');
      component.itemBought.subscribe(spy);

      component.buyItem(99);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('buyHeal()', () => {
    it('emits itemBought with -1 as heal signal', () => {
      const spy = jasmine.createSpy('itemBought');
      component.itemBought.subscribe(spy);
      component.currentLives = 5;
      component.maxLives = 7;
      component.currentGold = 100;
      component.healCount = 0;

      component.buyHeal();

      expect(spy).toHaveBeenCalledWith(-1);
    });

    it('increments healCount on successful heal', () => {
      component.currentLives = 5;
      component.maxLives = 7;
      component.currentGold = 100;
      component.healCount = 0;

      component.buyHeal();

      expect(component.healCount).toBe(1);
    });

    it('does NOT emit when canHeal is false (at full health)', () => {
      const spy = jasmine.createSpy('itemBought');
      component.itemBought.subscribe(spy);
      component.currentLives = 7;
      component.maxLives = 7;

      component.buyHeal();

      expect(spy).not.toHaveBeenCalled();
      expect(component.healCount).toBe(0);
    });

    it('enforces maxHealPerVisit across multiple calls', () => {
      component.currentLives = 2;
      component.maxLives = 7;
      component.currentGold = 1000;
      component.healCount = SHOP_CONFIG.maxHealPerVisit - 1;

      component.buyHeal(); // last allowed heal
      expect(component.healCount).toBe(SHOP_CONFIG.maxHealPerVisit);

      const spy = jasmine.createSpy('itemBought');
      component.itemBought.subscribe(spy);
      component.buyHeal(); // should be blocked
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('leave()', () => {
    it('emits shopLeft', () => {
      const spy = jasmine.createSpy('shopLeft');
      component.shopLeft.subscribe(spy);

      component.leave();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('healCount reset on new shop visit', () => {
    it('resets healCount to 0 when shopItems input changes (simulates new shop visit)', () => {
      component.shopItems = [COMMON_ITEM];
      component.currentLives = 3;
      component.maxLives = 7;
      component.currentGold = 1000;
      component.ngOnChanges(shopItemsChanged(component.shopItems));

      // Simulate three heals at shop A
      component.buyHeal();
      component.buyHeal();
      component.buyHeal();
      expect(component.healCount).toBe(3);

      // Simulate arriving at shop B — new shopItems binding triggers ngOnChanges
      component.shopItems = [UNCOMMON_ITEM, RARE_ITEM];
      component.ngOnChanges(shopItemsChanged(component.shopItems));

      expect(component.healCount).toBe(0);
    });
  });

  describe('SHOP_CONFIG integration', () => {
    it('healCost matches SHOP_CONFIG.healCostPerLife', () => {
      expect(component.healCost).toBe(SHOP_CONFIG.healCostPerLife);
    });

    it('maxHealPerVisit matches SHOP_CONFIG.maxHealPerVisit', () => {
      expect(component.maxHealPerVisit).toBe(SHOP_CONFIG.maxHealPerVisit);
    });

    it('cardRemoveCost matches SHOP_CONFIG.cardRemoveCost', () => {
      expect(component.cardRemoveCost).toBe(SHOP_CONFIG.cardRemoveCost);
    });
  });

  // ── Phase 1 Sprint 4 — Card removal slot ──────────────────────────────
  describe('card removal', () => {
    function makeInstance(cardId: CardId, instanceId = `inst_${cardId}`): CardInstance {
      return { instanceId, cardId, upgraded: false };
    }

    beforeEach(() => {
      component.deckCards = [
        makeInstance(CardId.TOWER_BASIC, 'starter1'), // STARTER rarity, not removable
        makeInstance(CardId.GOLD_RUSH, 'common1'),    // non-starter, removable
        makeInstance(CardId.DAMAGE_BOOST, 'common2'),
      ];
      component.currentGold = SHOP_CONFIG.cardRemoveCost + 50;
      component.cardRemoveUsed = false;
      component.activeAction = 'none';
    });

    it('removableCards filters out STARTER rarity cards', () => {
      const removable = component.removableCards;
      expect(removable.every(c => c.cardId !== CardId.TOWER_BASIC)).toBeTrue();
      expect(removable.length).toBe(2);
    });

    it('canRemoveCard true when slot fresh, gold sufficient, and removables exist', () => {
      expect(component.canRemoveCard()).toBeTrue();
    });

    it('canRemoveCard false after slot used', () => {
      component.cardRemoveUsed = true;
      expect(component.canRemoveCard()).toBeFalse();
    });

    it('canRemoveCard false when gold insufficient', () => {
      component.currentGold = SHOP_CONFIG.cardRemoveCost - 1;
      expect(component.canRemoveCard()).toBeFalse();
    });

    it('canRemoveCard false when no removable cards (only starters)', () => {
      component.deckCards = [makeInstance(CardId.TOWER_BASIC, 's1')];
      expect(component.canRemoveCard()).toBeFalse();
    });

    it('showRemovePanel switches activeAction when allowed', () => {
      component.showRemovePanel();
      expect(component.activeAction).toBe('remove');
    });

    it('showRemovePanel no-ops when not allowed', () => {
      component.cardRemoveUsed = true;
      component.showRemovePanel();
      expect(component.activeAction).toBe('none');
    });

    it('selectCardToRemove emits, marks slot used, and closes picker', () => {
      const spy = jasmine.createSpy('cardRemoved');
      component.cardRemoved.subscribe(spy);

      const card = component.removableCards[0];
      component.selectCardToRemove(card);

      expect(spy).toHaveBeenCalledWith(card.instanceId);
      expect(component.cardRemoveUsed).toBeTrue();
      expect(component.activeAction).toBe('none');
    });

    it('selectCardToRemove ignored when slot already used', () => {
      component.cardRemoveUsed = true;
      const spy = jasmine.createSpy('cardRemoved');
      component.cardRemoved.subscribe(spy);

      component.selectCardToRemove(component.deckCards[1]);
      expect(spy).not.toHaveBeenCalled();
    });

    it('cancelRemove closes picker without using slot', () => {
      component.showRemovePanel();
      component.cancelRemove();
      expect(component.activeAction).toBe('none');
      expect(component.cardRemoveUsed).toBeFalse();
    });

    it('ngOnChanges resets cardRemoveUsed and activeAction on new shop visit (shopItems changed)', () => {
      component.cardRemoveUsed = true;
      component.activeAction = 'remove';
      component.shopItems = [UNCOMMON_ITEM];
      component.ngOnChanges({
        shopItems: { currentValue: component.shopItems, previousValue: [], firstChange: false, isFirstChange: () => false },
      } as any);
      expect(component.cardRemoveUsed).toBeFalse();
      expect(component.activeAction).toBe('none');
    });

    // Phase 1 red-team Finding 2 — the slot must NOT reset when other inputs
    // change mid-visit (deckCards changes per CD tick under the old binding).
    it('ngOnChanges does NOT reset cardRemoveUsed when only deckCards changes', () => {
      component.cardRemoveUsed = true;
      component.activeAction = 'remove';
      component.deckCards = [makeInstance(CardId.GOLD_RUSH, 'newcard')];
      component.ngOnChanges({
        deckCards: { currentValue: component.deckCards, previousValue: [], firstChange: false, isFirstChange: () => false },
      } as any);
      expect(component.cardRemoveUsed).toBeTrue();
      expect(component.activeAction).toBe('remove');
    });

    it('ngOnChanges does NOT reset cardRemoveUsed when only currentGold changes', () => {
      component.cardRemoveUsed = true;
      component.currentGold = 999;
      component.ngOnChanges({
        currentGold: { currentValue: 999, previousValue: 100, firstChange: false, isFirstChange: () => false },
      } as any);
      expect(component.cardRemoveUsed).toBeTrue();
    });
  });
});
