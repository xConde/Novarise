/**
 * Card branding cross-surface integration spec.
 *
 * Verifies that the archetype trim color, backdrop image, frame class,
 * keyword badges, and tower-only footprint all propagate correctly across
 * the two primary render surfaces — card-hand and library-card-tile — for
 * a representative 12-card sample covering all 4 archetypes and all 4 card
 * types. DOM / style-binding assertions only; no pixel inspection.
 *
 * Sample rationale:
 *   neutral    → tower/spell/modifier/utility (all 4 types)
 *   cartographer → spell (DETOUR) + modifier (CARTOGRAPHER_SEAL, rare)
 *   highground   → spell (RAISE_PLATFORM) + modifier (HIGH_PERCH)
 *   conduit      → modifier/link (HANDSHAKE) + utility/link (CONDUIT_BRIDGE)
 *                + modifier/rare (ARCHITECT)
 *
 * There are no cartographer-tower, cartographer-utility, highground-tower,
 * highground-utility, or conduit-spell cards in CARD_DEFINITIONS — those
 * combinations genuinely do not exist in the content set.
 */

import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';

import { CardHandComponent, HandCard } from './card-hand.component';
import { LibraryCardTileComponent } from '../../../../library/components/library-card-tile.component';
import { IconComponent } from '@shared/components/icon/icon.component';

import {
  CardDefinition,
  CardId,
  CardRarity,
  CardType,
  CardInstance,
  DeckState,
  EnergyState,
} from '../../../../run/models/card.model';
import { getCardDefinition } from '../../../../run/constants/card-definitions';
import { ARCHETYPE_DISPLAY } from '../../../../run/constants/archetype.constants';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInstance(cardId: CardId): CardInstance {
  return { instanceId: `inst_${cardId}`, cardId, upgraded: false };
}

function makeDeckState(hand: CardInstance[]): DeckState {
  return {
    drawPile: [makeInstance(CardId.TOWER_BASIC)],
    hand,
    discardPile: [],
    exhaustPile: [],
  };
}

function makeEnergy(current = 5, max = 5): EnergyState {
  return { current, max };
}

// ── Representative 12-card sample ─────────────────────────────────────────────
//
// Each entry describes the expected surface-level bindings for one card.
// archetype is the expected CSS var fragment; backdropFrag the expected
// backdrop var fragment; frameClass the expected card-hand frame class;
// tileFameClass the expected tile frame class; hasKeywords flags keyword
// badges; towerOnly flags footprint-only-on-tower.

interface SampleCard {
  cardId: CardId;
  label: string;              // human-readable for withContext
  archetype: string;           // e.g. 'neutral'
  trimFrag: string;            // expected substring in --archetype-trim-color value
  backdropFrag: string;        // expected substring in --card-backdrop-image value
  handFrameClass: string;      // e.g. 'card--frame-tower'
  tileFrameClass: string;      // e.g. 'tile--frame-tower'
  isTower: boolean;
  hasKeywords: boolean;        // at least one keyword badge should render
}

const SAMPLE: SampleCard[] = [
  {
    cardId: CardId.TOWER_BASIC,
    label: 'neutral tower (TOWER_BASIC, starter, innate)',
    archetype: 'neutral',
    trimFrag: 'card-trim-neutral',
    backdropFrag: 'card-backdrop-neutral',
    handFrameClass: 'card--frame-tower',
    tileFrameClass: 'tile--frame-tower',
    isTower: true,
    hasKeywords: true, // innate keyword
  },
  {
    cardId: CardId.GOLD_RUSH,
    label: 'neutral spell (GOLD_RUSH, common)',
    archetype: 'neutral',
    trimFrag: 'card-trim-neutral',
    backdropFrag: 'card-backdrop-neutral',
    handFrameClass: 'card--frame-spell',
    tileFrameClass: 'tile--frame-spell',
    isTower: false,
    hasKeywords: false,
  },
  {
    cardId: CardId.DAMAGE_BOOST,
    label: 'neutral modifier (DAMAGE_BOOST, common)',
    archetype: 'neutral',
    trimFrag: 'card-trim-neutral',
    backdropFrag: 'card-backdrop-neutral',
    handFrameClass: 'card--frame-modifier',
    tileFrameClass: 'tile--frame-modifier',
    isTower: false,
    hasKeywords: false,
  },
  {
    cardId: CardId.DRAW_TWO,
    label: 'neutral utility (DRAW_TWO, common)',
    archetype: 'neutral',
    trimFrag: 'card-trim-neutral',
    backdropFrag: 'card-backdrop-neutral',
    handFrameClass: 'card--frame-utility',
    tileFrameClass: 'tile--frame-utility',
    isTower: false,
    hasKeywords: false,
  },
  {
    cardId: CardId.DETOUR,
    label: 'cartographer spell (DETOUR, uncommon)',
    archetype: 'cartographer',
    trimFrag: 'card-trim-cartographer',
    backdropFrag: 'card-backdrop-cartographer',
    handFrameClass: 'card--frame-spell',
    tileFrameClass: 'tile--frame-spell',
    isTower: false,
    hasKeywords: false, // terraform: false on DETOUR
  },
  {
    cardId: CardId.CARTOGRAPHER_SEAL,
    label: 'cartographer modifier rare (CARTOGRAPHER_SEAL)',
    archetype: 'cartographer',
    trimFrag: 'card-trim-cartographer',
    backdropFrag: 'card-backdrop-cartographer',
    handFrameClass: 'card--frame-modifier',
    tileFrameClass: 'tile--frame-modifier',
    isTower: false,
    hasKeywords: false,
  },
  {
    cardId: CardId.RAISE_PLATFORM,
    label: 'highground spell (RAISE_PLATFORM, common, terraform)',
    archetype: 'highground',
    trimFrag: 'card-trim-highground',
    backdropFrag: 'card-backdrop-highground',
    handFrameClass: 'card--frame-spell',
    tileFrameClass: 'tile--frame-spell',
    isTower: false,
    hasKeywords: true, // terraform: true
  },
  {
    cardId: CardId.HIGH_PERCH,
    label: 'highground modifier (HIGH_PERCH, common)',
    archetype: 'highground',
    trimFrag: 'card-trim-highground',
    backdropFrag: 'card-backdrop-highground',
    handFrameClass: 'card--frame-modifier',
    tileFrameClass: 'tile--frame-modifier',
    isTower: false,
    hasKeywords: false,
  },
  {
    cardId: CardId.HANDSHAKE,
    label: 'conduit modifier/link (HANDSHAKE, common)',
    archetype: 'conduit',
    trimFrag: 'card-trim-conduit',
    backdropFrag: 'card-backdrop-conduit',
    handFrameClass: 'card--frame-modifier',
    tileFrameClass: 'tile--frame-modifier',
    isTower: false,
    hasKeywords: true, // link: true
  },
  {
    cardId: CardId.CONDUIT_BRIDGE,
    label: 'conduit utility/link (CONDUIT_BRIDGE, uncommon)',
    archetype: 'conduit',
    trimFrag: 'card-trim-conduit',
    backdropFrag: 'card-backdrop-conduit',
    handFrameClass: 'card--frame-utility',
    tileFrameClass: 'tile--frame-utility',
    isTower: false,
    hasKeywords: true, // link: true
  },
  {
    cardId: CardId.ARCHITECT,
    label: 'conduit modifier rare (ARCHITECT)',
    archetype: 'conduit',
    trimFrag: 'card-trim-conduit',
    backdropFrag: 'card-backdrop-conduit',
    handFrameClass: 'card--frame-modifier',
    tileFrameClass: 'tile--frame-modifier',
    isTower: false,
    hasKeywords: true, // link: true
  },
  {
    cardId: CardId.KING_OF_THE_HILL,
    label: 'highground modifier rare (KING_OF_THE_HILL)',
    archetype: 'highground',
    trimFrag: 'card-trim-highground',
    backdropFrag: 'card-backdrop-highground',
    handFrameClass: 'card--frame-modifier',
    tileFrameClass: 'tile--frame-modifier',
    isTower: false,
    hasKeywords: false,
  },
];

// ── card-hand surface ─────────────────────────────────────────────────────────

describe('Card branding — card-hand surface', () => {
  let handFixture: ComponentFixture<CardHandComponent>;
  let handComponent: CardHandComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CardHandComponent],
      imports: [CommonModule, IconComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    handFixture = TestBed.createComponent(CardHandComponent);
    handComponent = handFixture.componentInstance;
  });

  for (const sample of SAMPLE) {
    describe(`${sample.label}`, () => {
      let cardEl: HTMLElement;

      beforeEach(() => {
        handComponent.deckState = makeDeckState([makeInstance(sample.cardId)]);
        handComponent.energy = makeEnergy();
        handComponent.resolveHand();
        handFixture.detectChanges();
        cardEl = handFixture.nativeElement.querySelector('.card') as HTMLElement;
      });

      it('archetype trim color var is bound', () => {
        const trimColor = cardEl.style.getPropertyValue('--archetype-trim-color');
        expect(trimColor)
          .withContext(`${sample.label}: --archetype-trim-color should contain ${sample.trimFrag}`)
          .toContain(sample.trimFrag);
      });

      // Archetype backdrop var was removed from card-hand at S75 (kept on tiles).
      // Tile-surface backdrop assertion still runs in the library-card-tile block below.

      it(`frame class ${sample.handFrameClass} is applied`, () => {
        expect(cardEl.classList.contains(sample.handFrameClass))
          .withContext(`${sample.label}: expected class ${sample.handFrameClass}`)
          .toBe(true);
      });

      it('no more than one frame class is applied', () => {
        const frameCls = [
          'card--frame-tower', 'card--frame-spell',
          'card--frame-modifier', 'card--frame-utility',
        ];
        const count = frameCls.filter(c => cardEl.classList.contains(c)).length;
        expect(count)
          .withContext(`${sample.label}: expected exactly 1 frame class, got ${count}`)
          .toBe(1);
      });

      it('keyword badges render when expected', () => {
        const badges = handFixture.nativeElement.querySelectorAll('.card__keyword') as NodeListOf<HTMLElement>;
        if (sample.hasKeywords) {
          expect(badges.length)
            .withContext(`${sample.label}: expected at least one keyword badge`)
            .toBeGreaterThan(0);
        } else {
          expect(badges.length)
            .withContext(`${sample.label}: expected no keyword badges`)
            .toBe(0);
        }
      });

    });
  }
});

// ── library-card-tile surface ─────────────────────────────────────────────────

describe('Card branding — library-card-tile surface', () => {
  let tileFixture: ComponentFixture<LibraryCardTileComponent>;
  let tileComponent: LibraryCardTileComponent;

  const refresh = () => {
    tileFixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
    tileFixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LibraryCardTileComponent],
      imports: [IconComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    tileFixture = TestBed.createComponent(LibraryCardTileComponent);
    tileComponent = tileFixture.componentInstance;
  });

  for (const sample of SAMPLE) {
    describe(`${sample.label}`, () => {
      let tileBtn: HTMLElement;

      beforeEach(() => {
        tileComponent.definition = getCardDefinition(sample.cardId);
        refresh();
        tileBtn = tileFixture.nativeElement.querySelector('button.tile') as HTMLElement;
      });

      it('archetype trim color var is bound', () => {
        const trimColor = tileBtn.style.getPropertyValue('--archetype-trim-color');
        expect(trimColor)
          .withContext(`${sample.label}: --archetype-trim-color should contain ${sample.trimFrag}`)
          .toContain(sample.trimFrag);
      });

      it('archetype backdrop image var is bound', () => {
        const backdrop = tileBtn.style.getPropertyValue('--card-backdrop-image');
        expect(backdrop)
          .withContext(`${sample.label}: --card-backdrop-image should contain ${sample.backdropFrag}`)
          .toContain(sample.backdropFrag);
      });

      it(`frame class ${sample.tileFrameClass} is applied`, () => {
        expect(tileBtn.classList.contains(sample.tileFrameClass))
          .withContext(`${sample.label}: expected class ${sample.tileFrameClass}`)
          .toBe(true);
      });

      it('no more than one frame class is applied', () => {
        const frameCls = [
          'tile--frame-tower', 'tile--frame-spell',
          'tile--frame-modifier', 'tile--frame-utility',
        ];
        const count = frameCls.filter(c => tileBtn.classList.contains(c)).length;
        expect(count)
          .withContext(`${sample.label}: expected exactly 1 tile frame class, got ${count}`)
          .toBe(1);
      });

      it('footprint renders only for tower cards', () => {
        const fp = tileFixture.nativeElement.querySelector('.tile__footprint');
        if (sample.isTower) {
          expect(fp).withContext(`${sample.label}: tile footprint should exist for tower`).not.toBeNull();
        } else {
          expect(fp).withContext(`${sample.label}: tile footprint should NOT exist for non-tower`).toBeNull();
        }
      });
    });
  }

  // ── Gap-fill: cartographer and highground trim bindings at the tile ──────────
  // Existing tile spec only validates conduit archetype. These tests complete
  // the archetype × surface matrix.

  it('archetypeTrimColor returns cartographer var for LAY_TILE', () => {
    tileComponent.definition = getCardDefinition(CardId.LAY_TILE);
    expect(tileComponent.archetypeTrimColor)
      .toBe(`var(${ARCHETYPE_DISPLAY['cartographer'].trimVar})`);
  });

  it('archetypeTrimColor returns highground var for RAISE_PLATFORM', () => {
    tileComponent.definition = getCardDefinition(CardId.RAISE_PLATFORM);
    expect(tileComponent.archetypeTrimColor)
      .toBe(`var(${ARCHETYPE_DISPLAY['highground'].trimVar})`);
  });

  it('archetypeBackdropVar returns cartographer backdrop for LAY_TILE', () => {
    tileComponent.definition = getCardDefinition(CardId.LAY_TILE);
    expect(tileComponent.archetypeBackdropVar).toBe('var(--card-backdrop-cartographer)');
  });

  it('archetypeBackdropVar returns highground backdrop for RAISE_PLATFORM', () => {
    tileComponent.definition = getCardDefinition(CardId.RAISE_PLATFORM);
    expect(tileComponent.archetypeBackdropVar).toBe('var(--card-backdrop-highground)');
  });

  it('binds cartographer --archetype-trim-color on the tile button (DETOUR)', () => {
    tileComponent.definition = getCardDefinition(CardId.DETOUR);
    refresh();
    const btn = tileFixture.nativeElement.querySelector('button.tile') as HTMLElement;
    expect(btn.style.getPropertyValue('--archetype-trim-color'))
      .toContain('card-trim-cartographer');
  });

  it('binds highground --archetype-trim-color on the tile button (HIGH_PERCH)', () => {
    tileComponent.definition = getCardDefinition(CardId.HIGH_PERCH);
    refresh();
    const btn = tileFixture.nativeElement.querySelector('button.tile') as HTMLElement;
    expect(btn.style.getPropertyValue('--archetype-trim-color'))
      .toContain('card-trim-highground');
  });

  it('binds cartographer --card-backdrop-image on the tile button (DETOUR)', () => {
    tileComponent.definition = getCardDefinition(CardId.DETOUR);
    refresh();
    const btn = tileFixture.nativeElement.querySelector('button.tile') as HTMLElement;
    expect(btn.style.getPropertyValue('--card-backdrop-image'))
      .toContain('card-backdrop-cartographer');
  });

  it('binds highground --card-backdrop-image on the tile button (HIGH_PERCH)', () => {
    tileComponent.definition = getCardDefinition(CardId.HIGH_PERCH);
    refresh();
    const btn = tileFixture.nativeElement.querySelector('button.tile') as HTMLElement;
    expect(btn.style.getPropertyValue('--card-backdrop-image'))
      .toContain('card-backdrop-highground');
  });
});
