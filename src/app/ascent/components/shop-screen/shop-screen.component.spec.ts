import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { ShopScreenComponent } from './shop-screen.component';
import { ShopItem } from '../../models/encounter.model';
import { RelicId, RelicRarity, RELIC_DEFINITIONS } from '../../models/relic.model';
import { SHOP_CONFIG } from '../../constants/ascent.constants';

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
      imports: [CommonModule],
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

  describe('getRelicDef()', () => {
    it('returns RelicDefinition for a relic item', () => {
      const def = component.getRelicDef(COMMON_ITEM);
      expect(def).toBeDefined();
      expect(def!.id).toBe(RelicId.IRON_HEART);
    });

    it('returns the correct rarity', () => {
      const def = component.getRelicDef(RARE_ITEM);
      expect(def!.rarity).toBe(RelicRarity.RARE);
    });

    it('returns null for a gold item', () => {
      const goldItem: ShopItem = { item: { type: 'gold', amount: 50 }, cost: 0 };
      expect(component.getRelicDef(goldItem)).toBeNull();
    });
  });

  describe('getRarityClass()', () => {
    it('returns common for a common relic', () => {
      expect(component.getRarityClass(COMMON_ITEM)).toBe('common');
    });

    it('returns uncommon for an uncommon relic', () => {
      expect(component.getRarityClass(UNCOMMON_ITEM)).toBe('uncommon');
    });

    it('returns rare for a rare relic', () => {
      expect(component.getRarityClass(RARE_ITEM)).toBe('rare');
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

  describe('SHOP_CONFIG integration', () => {
    it('healCost matches SHOP_CONFIG.healCostPerLife', () => {
      expect(component.healCost).toBe(SHOP_CONFIG.healCostPerLife);
    });

    it('maxHealPerVisit matches SHOP_CONFIG.maxHealPerVisit', () => {
      expect(component.maxHealPerVisit).toBe(SHOP_CONFIG.maxHealPerVisit);
    });
  });
});
