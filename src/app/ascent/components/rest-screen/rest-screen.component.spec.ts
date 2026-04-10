import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RestScreenComponent } from './rest-screen.component';
import { CardInstance, CardId } from '../../models/card.model';

/** Minimal CardInstance factory for tests. */
function makeCard(instanceId: string, cardId: CardId, upgraded = false): CardInstance {
  return { instanceId, cardId, upgraded };
}

describe('RestScreenComponent', () => {
  let fixture: ComponentFixture<RestScreenComponent>;
  let component: RestScreenComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RestScreenComponent],
      imports: [CommonModule],
    });

    fixture = TestBed.createComponent(RestScreenComponent);
    component = fixture.componentInstance;
    component.currentLives = 4;
    component.maxLives = 7;
    component.healAmount = 2;
    component.deckCards = [];
    fixture.detectChanges();
  });

  it('renders current lives', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('4 / 7');
  });

  it('rest button emits restChosen', () => {
    let emitted = false;
    component.restChosen.subscribe(() => (emitted = true));

    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.rest-btn:first-of-type');
    btn?.click();

    expect(emitted).toBeTrue();
  });

  it('skip button emits skipChosen', () => {
    let emitted = false;
    component.skipChosen.subscribe(() => (emitted = true));

    const btns = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.rest-btn');
    btns[btns.length - 1].click();

    expect(emitted).toBeTrue();
  });

  it('livesAfterHeal caps at maxLives', () => {
    component.currentLives = 6;
    component.maxLives = 7;
    component.healAmount = 3;

    expect(component.livesAfterHeal).toBe(7);
  });

  it('actualHeal reflects capped heal amount', () => {
    component.currentLives = 6;
    component.maxLives = 7;
    component.healAmount = 3;

    expect(component.actualHeal).toBe(1);
  });

  it('rest button is disabled when already at full health', () => {
    component.currentLives = 7;
    component.maxLives = 7;
    component.healAmount = 2;
    fixture.detectChanges();

    const restBtn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.rest-btn:first-of-type');
    expect(restBtn?.disabled).toBeTrue();
  });

  it('atFullHealth is true when currentLives equals maxLives', () => {
    component.currentLives = 7;
    component.maxLives = 7;

    expect(component.atFullHealth).toBeTrue();
  });

  it('atFullHealth is false when currentLives is below maxLives', () => {
    component.currentLives = 5;
    component.maxLives = 7;

    expect(component.atFullHealth).toBeFalse();
  });

  // ── Card upgrade ────────────────────────────────────────────────────────────

  describe('card upgrade option', () => {
    it('upgradableCards is empty when no deck cards provided', () => {
      component.deckCards = [];
      expect(component.upgradableCards).toEqual([]);
    });

    it('upgradableCards filters out already-upgraded cards', () => {
      component.deckCards = [
        makeCard('c0', CardId.GOLD_RUSH, true),
        makeCard('c1', CardId.GOLD_RUSH, false),
      ];
      // Only the non-upgraded one with an upgradedEffect should be included
      expect(component.upgradableCards.length).toBe(1);
      expect(component.upgradableCards[0].instanceId).toBe('c1');
    });

    it('upgradableCards filters out cards with no upgradedEffect', () => {
      // TOWER_BASIC has no upgradedEffect, GOLD_RUSH does
      component.deckCards = [
        makeCard('c0', CardId.TOWER_BASIC, false),
        makeCard('c1', CardId.GOLD_RUSH, false),
      ];
      const upgradable = component.upgradableCards;
      expect(upgradable.map(c => c.instanceId)).not.toContain('c0');
      expect(upgradable.map(c => c.instanceId)).toContain('c1');
    });

    it('showUpgradePanel() switches activeAction to "upgrade"', () => {
      component.showUpgradePanel();
      expect(component.activeAction).toBe('upgrade');
    });

    it('cancelUpgrade() resets activeAction to "none"', () => {
      component.showUpgradePanel();
      component.cancelUpgrade();
      expect(component.activeAction).toBe('none');
    });

    it('selectCardToUpgrade() emits the instanceId', () => {
      const emitted: string[] = [];
      component.cardUpgraded.subscribe((id: string) => emitted.push(id));

      const card = makeCard('c42', CardId.GOLD_RUSH, false);
      component.selectCardToUpgrade(card);

      expect(emitted).toEqual(['c42']);
    });

    it('selectCardToUpgrade() resets activeAction to "none"', () => {
      component.showUpgradePanel();
      component.selectCardToUpgrade(makeCard('c0', CardId.GOLD_RUSH, false));
      expect(component.activeAction).toBe('none');
    });

    it('getUniqueUpgradableCards() deduplicates by CardId', () => {
      component.deckCards = [
        makeCard('c0', CardId.GOLD_RUSH, false),
        makeCard('c1', CardId.GOLD_RUSH, false),
        makeCard('c2', CardId.DAMAGE_BOOST, false),
      ];
      const unique = component.getUniqueUpgradableCards();
      expect(unique.length).toBe(2);
      expect(new Set(unique.map(c => c.cardId)).size).toBe(2);
    });

    it('"Upgrade a Card" button is disabled when no upgradable cards', () => {
      component.deckCards = [];
      fixture.detectChanges();

      const btns = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.rest-btn');
      // Second button (index 1) is the Upgrade button
      const upgradeBtn = Array.from(btns).find(b => b.textContent?.includes('Upgrade'));
      expect(upgradeBtn?.disabled).toBeTrue();
    });
  });
});
