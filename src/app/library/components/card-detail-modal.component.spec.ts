import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardDetailModalComponent } from './card-detail-modal.component';
import {
  CardDefinition,
  CardId,
  CardRarity,
  CardType,
} from '../../run/models/card.model';
import { TowerType } from '../../game/game-board/models/tower.model';
import { MODIFIER_STAT } from '../../run/constants/modifier-stat.constants';
import { DescriptionTextComponent } from '@shared/components/description-text/description-text.component';
import { IconComponent } from '@shared/components/icon/icon.component';

describe('CardDetailModalComponent', () => {
  let fixture: ComponentFixture<CardDetailModalComponent>;
  let component: CardDetailModalComponent;

  const refresh = () => {
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();
  };

  const towerDef: CardDefinition = {
    id: CardId.TOWER_BASIC,
    name: 'Basic Tower',
    description: 'Place a basic tower.',
    type: CardType.TOWER,
    rarity: CardRarity.STARTER,
    energyCost: 1,
    upgraded: false,
    archetype: 'neutral',
    effect: { type: 'tower', towerType: TowerType.BASIC },
  };

  const modifierDef: CardDefinition = {
    id: CardId.HANDSHAKE,
    name: 'Handshake',
    description: 'Base description.',
    upgradedDescription: 'Upgraded description.',
    type: CardType.MODIFIER,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: MODIFIER_STAT.HANDSHAKE_DAMAGE_BONUS,
      value: 0.15,
      duration: 1,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: MODIFIER_STAT.HANDSHAKE_DAMAGE_BONUS,
      value: 0.25,
      duration: 1,
    },
    archetype: 'conduit',
    link: true,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CardDetailModalComponent],
      imports: [DescriptionTextComponent, IconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CardDetailModalComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('creates', () => {
    component.definition = towerDef;
    refresh();
    expect(component).toBeTruthy();
  });

  it('renders card name in the title', () => {
    component.definition = towerDef;
    refresh();
    const title = fixture.nativeElement.querySelector('.modal__title') as HTMLElement;
    expect(title.textContent).toContain('Basic Tower');
  });

  it('renders both base and upgraded panels when upgradedEffect is defined', () => {
    component.definition = modifierDef;
    refresh();
    const panels = fixture.nativeElement.querySelectorAll('.panel');
    expect(panels.length).toBe(2);
    const labels = Array.from(panels).map(p => (p as HTMLElement).textContent);
    expect(labels.some(l => l?.includes('Base description'))).toBe(true);
    expect(labels.some(l => l?.includes('Upgraded description'))).toBe(true);
  });

  it('renders only one panel when upgradedEffect is absent', () => {
    component.definition = towerDef;
    refresh();
    const panels = fixture.nativeElement.querySelectorAll('.panel');
    expect(panels.length).toBe(1);
  });

  it('hides the upgraded column in the balance table when no upgrade', () => {
    component.definition = towerDef;
    refresh();
    const ths = fixture.nativeElement.querySelectorAll('thead th');
    expect(ths.length).toBe(2); // Stat / Base only
  });

  it('shows the upgraded column in the balance table when upgrade exists', () => {
    component.definition = modifierDef;
    refresh();
    const ths = fixture.nativeElement.querySelectorAll('thead th');
    expect(ths.length).toBe(3); // Stat / Base / Upgraded
  });

  it('emits closed on backdrop click', () => {
    component.definition = towerDef;
    refresh();
    let closed = false;
    component.closed.subscribe(() => (closed = true));

    const backdrop = fixture.nativeElement.querySelector('.backdrop') as HTMLElement;
    const event = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: backdrop, enumerable: true });
    Object.defineProperty(event, 'currentTarget', { value: backdrop, enumerable: true });
    component.onBackdropClick(event);

    expect(closed).toBe(true);
  });

  it('does NOT close when click target is inside the modal', () => {
    component.definition = towerDef;
    refresh();
    let closed = false;
    component.closed.subscribe(() => (closed = true));

    const backdrop = fixture.nativeElement.querySelector('.backdrop') as HTMLElement;
    const modal = fixture.nativeElement.querySelector('.modal') as HTMLElement;
    const event = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: modal, enumerable: true });
    Object.defineProperty(event, 'currentTarget', { value: backdrop, enumerable: true });
    component.onBackdropClick(event);

    expect(closed).toBe(false);
  });

  it('emits closed on Escape', () => {
    component.definition = towerDef;
    refresh();
    let closed = false;
    component.closed.subscribe(() => (closed = true));
    component.onEscape();
    expect(closed).toBe(true);
  });

  it('emits closed on explicit close button click', () => {
    component.definition = towerDef;
    refresh();
    let closed = false;
    component.closed.subscribe(() => (closed = true));
    (fixture.nativeElement.querySelector('.modal__close') as HTMLButtonElement).click();
    expect(closed).toBe(true);
  });

  it('balanceRows reflects modifier effect fields', () => {
    component.definition = modifierDef;
    refresh();
    const labels = component.balanceRows.map(r => r.label);
    expect(labels).toContain('Energy cost');
    expect(labels).toContain('Modifier stat');
    expect(labels).toContain('Value');
    expect(labels).toContain('Duration');
  });

  it('balanceRows compares base vs upgraded values', () => {
    component.definition = modifierDef;
    refresh();
    const valueRow = component.balanceRows.find(r => r.label === 'Value');
    expect(valueRow?.base).toBe('0.15');
    expect(valueRow?.upgraded).toBe('0.25');
  });

  it('rawJson contains both effect and upgradedEffect keys', () => {
    component.definition = modifierDef;
    refresh();
    const json = component.rawJson;
    expect(json).toContain('"effect"');
    expect(json).toContain('"upgradedEffect"');
  });

  it('rawJson carries null for upgradedEffect when undefined', () => {
    component.definition = towerDef;
    refresh();
    const json = component.rawJson;
    expect(json).toContain('"upgradedEffect": null');
  });

  it('renders Link keyword icon badge', () => {
    component.definition = modifierDef;
    refresh();
    // Keywords now render as icon badges with aria-label (not text content)
    const badges = Array.from(fixture.nativeElement.querySelectorAll('.modal__keyword'))
      .map(c => (c as HTMLElement).getAttribute('aria-label'));
    expect(badges).toContain('Link');
  });

  it('shows archetype chip for non-neutral archetypes', () => {
    component.definition = modifierDef;
    refresh();
    const arch = fixture.nativeElement.querySelector('.modal__archetype') as HTMLElement;
    expect(arch.textContent?.trim()).toBe('conduit');
  });

  it('hides archetype chip for neutral / undefined', () => {
    component.definition = towerDef; // no archetype → undefined
    refresh();
    expect(fixture.nativeElement.querySelector('.modal__archetype')).toBeFalsy();
  });

  describe('archetype branding', () => {
    it('renders the art strip', () => {
      component.definition = towerDef;
      refresh();
      expect(fixture.nativeElement.querySelector('.modal__art-strip')).not.toBeNull();
    });

    it('renders the archetype sub-icon glyph', () => {
      component.definition = towerDef;
      refresh();
      expect(fixture.nativeElement.querySelector('.modal__archetype-glyph')).not.toBeNull();
    });

    it('renders tower footprint on tower cards', () => {
      component.definition = towerDef;
      refresh();
      expect(fixture.nativeElement.querySelector('.modal__footprint')).not.toBeNull();
    });

    it('does not render footprint on non-tower cards', () => {
      component.definition = modifierDef;
      refresh();
      expect(fixture.nativeElement.querySelector('.modal__footprint')).toBeNull();
    });

    it('archetypeTrimColor returns neutral trim var for neutral archetype', () => {
      component.definition = towerDef;
      expect(component.archetypeTrimColor).toBe('var(--card-trim-neutral)');
    });

    it('archetypeTrimColor returns conduit trim var for conduit archetype', () => {
      component.definition = modifierDef;
      expect(component.archetypeTrimColor).toBe('var(--card-trim-conduit)');
    });

    it('archetypeIconName returns arch-conduit for conduit archetype', () => {
      component.definition = modifierDef;
      expect(component.archetypeIconName).toBe('arch-conduit');
    });

    it('archetypeIconName returns arch-neutral for neutral archetype', () => {
      component.definition = towerDef;
      expect(component.archetypeIconName).toBe('arch-neutral');
    });

    it('isTowerCard is true for tower cards', () => {
      component.definition = towerDef;
      expect(component.isTowerCard).toBeTrue();
    });

    it('isTowerCard is false for modifier cards', () => {
      component.definition = modifierDef;
      expect(component.isTowerCard).toBeFalse();
    });
  });

  describe('flavor text display', () => {
    it('renders .modal__flavor when flavorText is set', () => {
      component.definition = { ...towerDef, flavorText: 'Test flavor' };
      refresh();

      const flavor = fixture.nativeElement.querySelector('.modal__flavor') as HTMLElement;
      expect(flavor).not.toBeNull();
      expect(flavor.textContent).toContain('Test flavor');
    });

    it('does NOT render .modal__flavor when flavorText is undefined', () => {
      component.definition = towerDef;
      refresh();

      const flavor = fixture.nativeElement.querySelector('.modal__flavor');
      expect(flavor).toBeNull();
    });

    it('aria-label on flavor element prefixes with "Flavor: "', () => {
      component.definition = { ...towerDef, flavorText: 'Test flavor' };
      refresh();

      const flavor = fixture.nativeElement.querySelector('.modal__flavor') as HTMLElement;
      expect(flavor.getAttribute('aria-label')).toBe('Flavor: Test flavor');
    });
  });
});
