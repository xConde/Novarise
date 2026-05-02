import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { CardDetailComponent } from './card-detail.component';
import { HandCard } from '../card-hand/card-hand.component';
import { CardId } from '../../../../run/models/card.model';
import { getCardDefinition } from '../../../../run/constants/card-definitions';
import { DescriptionTextComponent } from '@shared/components/description-text/description-text.component';
import { IconComponent } from '@shared/components/icon/icon.component';

function makeHandCard(cardId: CardId, overrides: Partial<HandCard> = {}): HandCard {
  const definition = getCardDefinition(cardId);
  return {
    instance: { cardId, instanceId: 'inst-1', upgraded: false },
    definition,
    canPlay: true,
    effectiveEnergyCost: definition.energyCost,
    goldCost: null,
    ...overrides,
  };
}

describe('CardDetailComponent', () => {
  let fixture: ComponentFixture<CardDetailComponent>;
  let component: CardDetailComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CardDetailComponent],
      imports: [CommonModule, DescriptionTextComponent, IconComponent],
    });
    fixture = TestBed.createComponent(CardDetailComponent);
    component = fixture.componentInstance;
  });

  it('creates', () => {
    component.card = makeHandCard(CardId.TOWER_BASIC, { goldCost: 50 });
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('description rendering', () => {
    it('shows the base description when the card is not upgraded', () => {
      component.card = makeHandCard(CardId.GOLD_RUSH);
      fixture.detectChanges();

      const labels = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLElement>('.card-detail__desc-label');
      expect(labels[0].textContent?.toLowerCase()).toContain('current');

      const currentDesc = (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLElement>('.card-detail__desc:not(.card-detail__desc--upgraded)');
      expect(currentDesc?.textContent).toContain(getCardDefinition(CardId.GOLD_RUSH).description);
    });

    it('shows the upgrade preview block when the card has an upgradedEffect and is not yet upgraded', () => {
      component.card = makeHandCard(CardId.GOLD_RUSH);
      fixture.detectChanges();

      const upgradedBlock = (fixture.nativeElement as HTMLElement)
        .querySelector('.card-detail__desc-block--upgraded');
      expect(upgradedBlock).not.toBeNull();
    });

    it('hides the upgrade preview block once the card is already upgraded', () => {
      component.card = makeHandCard(CardId.GOLD_RUSH, {
        instance: { cardId: CardId.GOLD_RUSH, instanceId: 'i', upgraded: true },
      });
      fixture.detectChanges();

      const upgradedBlock = (fixture.nativeElement as HTMLElement)
        .querySelector('.card-detail__desc-block--upgraded');
      expect(upgradedBlock).toBeNull();

      // The single visible description is the upgraded text.
      const desc = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.card-detail__desc');
      // GOLD_RUSH upgraded description authored in Phase 10.
      const expected = getCardDefinition(CardId.GOLD_RUSH).upgradedDescription
        ?? `+ ${getCardDefinition(CardId.GOLD_RUSH).description}`;
      expect(desc?.textContent?.trim()).toBe(expected);
    });

    it('falls back to "+ base" when a card has upgradedEffect but no upgradedDescription', () => {
      const cardId = CardId.GOLD_RUSH;
      const def = getCardDefinition(cardId);
      component.card = {
        instance: { cardId, instanceId: 'i', upgraded: false },
        definition: { ...def, upgradedDescription: undefined },
        canPlay: true,
        effectiveEnergyCost: def.energyCost,
        goldCost: null,
      };
      fixture.detectChanges();

      expect(component.upgradedDescription).toBe(`+ ${def.description}`);
    });
  });

  describe('keyword chips', () => {
    it('does not render the keyword row when no keywords are set', () => {
      component.card = makeHandCard(CardId.GOLD_RUSH);
      fixture.detectChanges();
      expect(component.hasKeywords).toBeFalse();
      expect((fixture.nativeElement as HTMLElement).querySelector('.card-detail__keywords')).toBeNull();
    });

    it('renders one icon badge per active keyword', () => {
      const def = getCardDefinition(CardId.GOLD_RUSH);
      component.card = {
        instance: { cardId: CardId.GOLD_RUSH, instanceId: 'i', upgraded: false },
        definition: { ...def, innate: true, retain: true, ethereal: false, exhaust: true },
        canPlay: true,
        effectiveEnergyCost: def.energyCost,
        goldCost: null,
      };
      fixture.detectChanges();

      // Icon badges — count via class; aria-label carries the keyword name
      const badges = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLElement>('.card-detail__keyword');
      expect(badges.length).toBe(3);
      const ariaLabels = Array.from(badges).map(b => b.getAttribute('aria-label'));
      expect(ariaLabels).toEqual(['Innate', 'Retain', 'Exhaust']);
    });
  });

  describe('close behavior', () => {
    it('close() emits closed and restores previous focus', () => {
      const prevFocus = document.createElement('button');
      document.body.appendChild(prevFocus);
      prevFocus.focus();

      component.card = makeHandCard(CardId.GOLD_RUSH);
      fixture.detectChanges();
      const focusSpy = spyOn(prevFocus, 'focus');

      // Manually seed previousFocus since the spec's TestBed creation path
      // may not have the same activeElement as ngOnInit captured.
      (component as unknown as { previousFocus: HTMLElement }).previousFocus = prevFocus;

      let closedCount = 0;
      component.closed.subscribe(() => closedCount++);

      component.close();

      expect(closedCount).toBe(1);
      expect(focusSpy).toHaveBeenCalled();

      document.body.removeChild(prevFocus);
    });

    it('Escape key triggers close', () => {
      component.card = makeHandCard(CardId.GOLD_RUSH);
      fixture.detectChanges();
      let closedCount = 0;
      component.closed.subscribe(() => closedCount++);

      component.onEscape();
      expect(closedCount).toBe(1);
    });

    it('backdrop click closes when target === currentTarget', () => {
      component.card = makeHandCard(CardId.GOLD_RUSH);
      fixture.detectChanges();
      let closedCount = 0;
      component.closed.subscribe(() => closedCount++);

      const el = document.createElement('div');
      component.onBackdropClick({ target: el, currentTarget: el } as unknown as MouseEvent);
      expect(closedCount).toBe(1);
    });

    it('backdrop click does NOT close when clicking an inner element (target !== currentTarget)', () => {
      component.card = makeHandCard(CardId.GOLD_RUSH);
      fixture.detectChanges();
      let closedCount = 0;
      component.closed.subscribe(() => closedCount++);

      const backdrop = document.createElement('div');
      const inner = document.createElement('span');
      component.onBackdropClick({ target: inner, currentTarget: backdrop } as unknown as MouseEvent);
      expect(closedCount).toBe(0);
    });
  });

  describe('archetype branding', () => {
    it('renders the art zone strip', () => {
      component.card = makeHandCard(CardId.TOWER_BASIC, { goldCost: 50 });
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.card-detail__art-zone')).not.toBeNull();
    });

    it('renders the archetype sub-icon glyph', () => {
      component.card = makeHandCard(CardId.TOWER_BASIC, { goldCost: 50 });
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.card-detail__archetype-glyph')).not.toBeNull();
    });

    it('renders footprint on tower cards', () => {
      component.card = makeHandCard(CardId.TOWER_BASIC, { goldCost: 50 });
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.card-detail__footprint')).not.toBeNull();
    });

    it('does not render footprint on non-tower cards', () => {
      component.card = makeHandCard(CardId.GOLD_RUSH);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.card-detail__footprint')).toBeNull();
    });

    it('returns arch-cartographer icon for cartographer archetype', () => {
      const def = getCardDefinition(CardId.GOLD_RUSH);
      component.card = {
        instance: { cardId: CardId.GOLD_RUSH, instanceId: 'i', upgraded: false },
        definition: { ...def, archetype: 'cartographer' },
        canPlay: true,
        effectiveEnergyCost: def.energyCost,
        goldCost: null,
      };
      expect(component.archetypeIconName).toBe('arch-cartographer');
    });

    it('returns arch-neutral icon for neutral archetype', () => {
      component.card = makeHandCard(CardId.GOLD_RUSH);
      expect(component.archetypeIconName).toBe('arch-neutral');
    });

    it('isTowerCard is true for tower cards', () => {
      component.card = makeHandCard(CardId.TOWER_BASIC, { goldCost: 50 });
      expect(component.isTowerCard).toBeTrue();
    });

    it('isTowerCard is false for non-tower cards', () => {
      component.card = makeHandCard(CardId.GOLD_RUSH);
      expect(component.isTowerCard).toBeFalse();
    });

    it('binds --archetype-trim-color style via archetypeTrimColor', () => {
      const def = getCardDefinition(CardId.GOLD_RUSH);
      component.card = {
        instance: { cardId: CardId.GOLD_RUSH, instanceId: 'i', upgraded: false },
        definition: { ...def, archetype: 'conduit' },
        canPlay: true,
        effectiveEnergyCost: def.energyCost,
        goldCost: null,
      };
      expect(component.archetypeTrimColor).toBe('var(--card-trim-conduit)');
    });
  });

  describe('cost chip visibility', () => {
    it('shows the gold chip for tower cards (goldCost set)', () => {
      component.card = makeHandCard(CardId.TOWER_BASIC, { goldCost: 50 });
      fixture.detectChanges();
      const chips = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLElement>('.card-detail__cost-chip');
      expect(chips.length).toBe(2);
      expect(chips[1].textContent).toContain('50');
      expect(chips[1].textContent?.toLowerCase()).toContain('gold');
    });

    it('hides the gold chip for non-tower cards (goldCost null)', () => {
      component.card = makeHandCard(CardId.GOLD_RUSH);
      fixture.detectChanges();
      const chips = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLElement>('.card-detail__cost-chip');
      expect(chips.length).toBe(1);
      expect(chips[0].textContent?.toLowerCase()).toContain('energy');
    });
  });

  describe('flavor text display', () => {
    it('renders .card-detail__flavor when flavorText is set', () => {
      const def = getCardDefinition(CardId.GOLD_RUSH);
      component.card = makeHandCard(CardId.GOLD_RUSH, {
        definition: { ...def, flavorText: 'Test flavor' },
      });
      fixture.detectChanges();

      const flavor = (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLElement>('.card-detail__flavor');
      expect(flavor).not.toBeNull();
      expect(flavor?.textContent).toContain('Test flavor');
    });

    it('does NOT render .card-detail__flavor when flavorText is undefined', () => {
      const def = getCardDefinition(CardId.GOLD_RUSH);
      component.card = makeHandCard(CardId.GOLD_RUSH, {
        definition: { ...def, flavorText: undefined },
      });
      fixture.detectChanges();

      const flavor = (fixture.nativeElement as HTMLElement)
        .querySelector('.card-detail__flavor');
      expect(flavor).toBeNull();
    });

    it('aria-label on flavor element prefixes with "Flavor: "', () => {
      const def = getCardDefinition(CardId.GOLD_RUSH);
      component.card = makeHandCard(CardId.GOLD_RUSH, {
        definition: { ...def, flavorText: 'Test flavor' },
      });
      fixture.detectChanges();

      const flavor = (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLElement>('.card-detail__flavor');
      expect(flavor?.getAttribute('aria-label')).toBe('Flavor: Test flavor');
    });
  });
});
