import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LibraryCardTileComponent } from './library-card-tile.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import {
  CardDefinition,
  CardId,
  CardRarity,
  CardType,
} from '../../run/models/card.model';
import { TowerType } from '../../game/game-board/models/tower.model';
import { MODIFIER_STAT } from '../../run/constants/modifier-stat.constants';

describe('LibraryCardTileComponent', () => {
  let fixture: ComponentFixture<LibraryCardTileComponent>;
  let component: LibraryCardTileComponent;

  /** OnPush re-check helper — must be called after direct property mutation. */
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
    description: 'Towers with at least one adjacent tower gain +15% damage this wave.',
    upgradedDescription: 'Towers with at least one adjacent tower gain +25% damage this wave.',
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
      declarations: [LibraryCardTileComponent],
      imports: [IconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LibraryCardTileComponent);
    component = fixture.componentInstance;
  });

  it('creates', () => {
    component.definition = towerDef;
    refresh();
    expect(component).toBeTruthy();
  });

  it('renders the card name', () => {
    component.definition = towerDef;
    refresh();
    const el = fixture.nativeElement.querySelector('.tile__name') as HTMLElement;
    expect(el.textContent?.trim()).toBe('Basic Tower');
  });

  it('renders the energy cost', () => {
    component.definition = towerDef;
    refresh();
    const el = fixture.nativeElement.querySelector('.tile__cost strong') as HTMLElement;
    expect(el.textContent?.trim()).toBe('1');
  });

  it('shows gold cost only on tower cards', () => {
    component.definition = towerDef;
    refresh();
    const gold = fixture.nativeElement.querySelector('.tile__gold') as HTMLElement | null;
    expect(gold).toBeTruthy();
    expect(gold?.textContent).toContain('g');

    component.definition = modifierDef;
    refresh();
    const goldHidden = fixture.nativeElement.querySelector('.tile__gold');
    expect(goldHidden).toBeFalsy();
  });

  it('shows archetype chip for non-neutral archetypes', () => {
    component.definition = modifierDef;
    refresh();
    const arch = fixture.nativeElement.querySelector('.tile__archetype') as HTMLElement;
    expect(arch.textContent?.trim()).toBe('conduit');
  });

  it('hides archetype chip for neutral / undefined archetype', () => {
    component.definition = towerDef; // no archetype → undefined
    refresh();
    expect(fixture.nativeElement.querySelector('.tile__archetype')).toBeFalsy();
  });

  it('shows Link keyword chip when link: true', () => {
    component.definition = modifierDef;
    refresh();
    const chips = fixture.nativeElement.querySelectorAll('.tile__keyword');
    const labels = Array.from(chips).map(c => (c as HTMLElement).textContent?.trim());
    expect(labels).toContain('Link');
  });

  it('emits selected on click', () => {
    component.definition = towerDef;
    refresh();
    const emissions: CardDefinition[] = [];
    component.selected.subscribe(card => emissions.push(card));
    (fixture.nativeElement.querySelector('button.tile') as HTMLButtonElement).click();
    expect(emissions.length).toBe(1);
    expect(emissions[0]).toBe(towerDef);
  });

  it('renders upgraded description when showUpgraded is true', () => {
    component.definition = modifierDef;
    component.showUpgraded = true;
    refresh();
    const desc = fixture.nativeElement.querySelector('.tile__description') as HTMLElement;
    expect(desc.textContent).toContain('+25%');
  });

  it('falls back to base description if upgradedDescription is missing', () => {
    component.definition = towerDef; // no upgradedDescription
    component.showUpgraded = true;
    refresh();
    const desc = fixture.nativeElement.querySelector('.tile__description') as HTMLElement;
    expect(desc.textContent).toContain('Place a basic tower');
  });

  it('applies tower accent CSS variable for tower cards', () => {
    component.definition = towerDef;
    refresh();
    const btn = fixture.nativeElement.querySelector('button.tile') as HTMLElement;
    expect(btn.style.getPropertyValue('--tile-tower-accent')).toContain('tower-color-basic');
  });

  it('does NOT apply tower accent for non-tower cards', () => {
    component.definition = modifierDef;
    refresh();
    const btn = fixture.nativeElement.querySelector('button.tile') as HTMLElement;
    expect(btn.style.getPropertyValue('--tile-tower-accent')).toBe('');
  });

  it('goldCost is null for non-tower cards', () => {
    component.definition = modifierDef;
    expect(component.goldCost).toBeNull();
  });

  it('adds tile--desaturated class when desaturated is true', () => {
    component.definition = towerDef;
    component.desaturated = true;
    refresh();
    const btn = fixture.nativeElement.querySelector('button.tile') as HTMLElement;
    expect(btn.classList.contains('tile--desaturated')).toBe(true);
  });
});
