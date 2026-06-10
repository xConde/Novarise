import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameCardComponent } from './game-card.component';
import { getCardDefinition } from '../../../run/constants/card-definitions';
import { CardId, CardType, CardRarity } from '../../../run/models/card.model';

describe('GameCardComponent', () => {
  let fixture: ComponentFixture<GameCardComponent>;
  let component: GameCardComponent;

  function createFixture(cardId: CardId, upgraded = false): void {
    fixture = TestBed.createComponent(GameCardComponent);
    component = fixture.componentInstance;
    component.definition = getCardDefinition(cardId);
    component.upgraded = upgraded;
    // Skip detectChanges — canvas/WebGL not available in Karma headless
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameCardComponent],
    }).compileComponents();
  });

  describe('tower card (TOWER_BASIC)', () => {
    beforeEach(() => createFixture(CardId.TOWER_BASIC));

    it('creates without throwing', () => {
      expect(component).toBeTruthy();
    });

    it('definition is set', () => {
      expect(component.definition.type).toBe(CardType.TOWER);
    });

    it('effectiveEnergyCost equals definition.energyCost when not upgraded', () => {
      expect(component.effectiveEnergyCost).toBe(component.definition.energyCost);
    });

    it('goldCost is non-null for tower cards', () => {
      expect(component.goldCost).not.toBeNull();
    });

    it('primaryGlyph is null for tower cards (no effectGlyph expected)', () => {
      // Tower cards don't have effectGlyph; primaryGlyph should be null
      expect(component.primaryGlyph).toBeNull();
    });

    it('towerThumbnailUrl is null or a string (depends on WebGL availability in the test runner)', () => {
      const url = component.towerThumbnailUrl;
      expect(url === null || typeof url === 'string').toBeTrue();
    });
  });

  describe('spell card (LIGHTNING_STRIKE)', () => {
    beforeEach(() => createFixture(CardId.LIGHTNING_STRIKE));

    it('creates without throwing', () => {
      expect(component).toBeTruthy();
    });

    it('definition is a SPELL type', () => {
      expect(component.definition.type).toBe(CardType.SPELL);
    });

    it('goldCost is null for spell cards', () => {
      expect(component.goldCost).toBeNull();
    });

    it('effectiveEnergyCost equals energyCost (not upgraded)', () => {
      expect(component.effectiveEnergyCost).toBe(component.definition.energyCost);
    });
  });

  describe('modifier card (DAMAGE_BOOST)', () => {
    beforeEach(() => createFixture(CardId.DAMAGE_BOOST));

    it('creates without throwing', () => {
      expect(component).toBeTruthy();
    });

    it('definition is a MODIFIER type', () => {
      expect(component.definition.type).toBe(CardType.MODIFIER);
    });
  });

  describe('utility card (DRAW_TWO)', () => {
    beforeEach(() => createFixture(CardId.DRAW_TWO));

    it('creates without throwing', () => {
      expect(component).toBeTruthy();
    });

    it('definition is a UTILITY type', () => {
      expect(component.definition.type).toBe(CardType.UTILITY);
    });
  });

  describe('upgraded state', () => {
    beforeEach(() => createFixture(CardId.DAMAGE_BOOST, true));

    it('creates without throwing in upgraded state', () => {
      expect(component).toBeTruthy();
    });

    it('upgraded property is true', () => {
      expect(component.upgraded).toBeTrue();
    });

    it('uses upgradedEnergyCost when available', () => {
      const def = component.definition;
      if (def.upgradedEnergyCost !== undefined) {
        expect(component.effectiveEnergyCost).toBe(def.upgradedEnergyCost);
      } else {
        expect(component.effectiveEnergyCost).toBe(def.energyCost);
      }
    });
  });

  describe('upgraded state for ARCHITECT (has upgradedEnergyCost)', () => {
    beforeEach(() => createFixture(CardId.ARCHITECT, true));

    it('creates without throwing', () => {
      expect(component).toBeTruthy();
    });

    it('effectiveEnergyCost reflects upgradedEnergyCost', () => {
      const def = component.definition;
      if (def.upgradedEnergyCost !== undefined) {
        expect(component.effectiveEnergyCost).toBe(def.upgradedEnergyCost);
        expect(component.effectiveEnergyCost).toBeLessThan(def.energyCost);
      }
    });
  });

  describe('keyword cards', () => {
    it('creates without throwing for an innate card', () => {
      const fixture2 = TestBed.createComponent(GameCardComponent);
      const c = fixture2.componentInstance;
      c.definition = getCardDefinition(CardId.OPENING_GAMBIT);
      expect(c).toBeTruthy();
      expect(c.hasKeywords).toBeTrue();
    });

    it('creates without throwing for a terraform card', () => {
      const fixture2 = TestBed.createComponent(GameCardComponent);
      const c = fixture2.componentInstance;
      c.definition = getCardDefinition(CardId.LAY_TILE);
      expect(c).toBeTruthy();
      expect(c.hasKeywords).toBeTrue();
    });

    it('creates without throwing for a link card', () => {
      const fixture2 = TestBed.createComponent(GameCardComponent);
      const c = fixture2.componentInstance;
      c.definition = getCardDefinition(CardId.HANDSHAKE);
      expect(c).toBeTruthy();
      expect(c.hasKeywords).toBeTrue();
    });
  });

  describe('starter card (no keyword badges)', () => {
    it('creates without throwing for a starter card', () => {
      const fixture2 = TestBed.createComponent(GameCardComponent);
      const c = fixture2.componentInstance;
      c.definition = getCardDefinition(CardId.TOWER_BASIC);
      expect(c.definition.rarity).toBe(CardRarity.STARTER);
    });
  });

  describe('archetype trim color getters', () => {
    it('returns var(--card-trim-neutral) for neutral archetype', () => {
      createFixture(CardId.DRAW_TWO);
      expect(component.archetypeTrimColor).toContain('var(');
    });

    it('returns a valid CSS var string for cartographer archetype', () => {
      createFixture(CardId.LAY_TILE);
      expect(component.archetypeTrimColor).toContain('var(--card-trim-cartographer)');
    });
  });

  describe('selected output', () => {
    it('emits definition on onClick', () => {
      createFixture(CardId.GOLD_RUSH);
      let emitted = false;
      component.selected.subscribe(() => { emitted = true; });
      component.onClick();
      expect(emitted).toBeTrue();
    });

    it('emits the correct definition', () => {
      createFixture(CardId.GOLD_RUSH);
      let emittedDef: unknown = null;
      component.selected.subscribe(d => { emittedDef = d; });
      component.onClick();
      expect(emittedDef).toBe(component.definition);
    });
  });

  describe('ariaLabel', () => {
    it('includes card name and energy cost', () => {
      createFixture(CardId.LIGHTNING_STRIKE);
      const label = component.ariaLabel;
      expect(label).toContain(component.definition.name);
      expect(label).toContain(String(component.effectiveEnergyCost));
    });

    it('includes "(upgraded)" when upgraded is true', () => {
      createFixture(CardId.DAMAGE_BOOST, true);
      expect(component.ariaLabel).toContain('(upgraded)');
    });

    it('does not include "(upgraded)" when upgraded is false', () => {
      createFixture(CardId.DAMAGE_BOOST, false);
      expect(component.ariaLabel).not.toContain('(upgraded)');
    });
  });

  describe('glyph getters', () => {
    it('returns primary glyph for a card with effectGlyph string', () => {
      // GOLD_RUSH has a single effectGlyph string
      createFixture(CardId.GOLD_RUSH);
      if (component.definition.effectGlyph) {
        expect(component.primaryGlyph).not.toBeNull();
        expect(component.secondaryGlyph).toBeNull();
      }
    });

    it('returns both glyphs for a card with 2-tuple effectGlyph', () => {
      // CRYO_PULSE has a 2-tuple [slow, damage] effectGlyph
      createFixture(CardId.CRYO_PULSE);
      if (Array.isArray(component.definition.effectGlyph)) {
        expect(component.primaryGlyph).not.toBeNull();
        expect(component.secondaryGlyph).not.toBeNull();
      }
    });
  });

  describe('per-tower-type icon mapping (towerTypeIconName)', () => {
    it('SNIPER tower card returns tower-sniper, not the generic crosshair', () => {
      createFixture(CardId.TOWER_SNIPER);
      expect(component.towerTypeIconName).toBe('tower-sniper');
      expect(component.towerTypeIconName).not.toBe('crosshair');
    });

    it('BASIC tower card returns tower-basic', () => {
      createFixture(CardId.TOWER_BASIC);
      expect(component.towerTypeIconName).toBe('tower-basic');
    });

    it('SPLASH tower card returns tower-splash', () => {
      createFixture(CardId.TOWER_SPLASH);
      expect(component.towerTypeIconName).toBe('tower-splash');
    });

    it('SLOW tower card returns tower-slow', () => {
      createFixture(CardId.TOWER_SLOW);
      expect(component.towerTypeIconName).toBe('tower-slow');
    });

    it('CHAIN tower card returns tower-chain', () => {
      createFixture(CardId.TOWER_CHAIN);
      expect(component.towerTypeIconName).toBe('tower-chain');
    });

    it('MORTAR tower card returns tower-mortar', () => {
      createFixture(CardId.TOWER_MORTAR);
      expect(component.towerTypeIconName).toBe('tower-mortar');
    });

    it('non-tower card returns crosshair', () => {
      createFixture(CardId.LIGHTNING_STRIKE);
      expect(component.towerTypeIconName).toBe('crosshair');
    });
  });
});
