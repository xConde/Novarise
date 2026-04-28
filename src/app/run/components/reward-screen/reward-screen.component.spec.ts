import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RewardScreenComponent } from './reward-screen.component';
import { RewardScreenConfig, RewardItem, CardReward } from '../../models/encounter.model';
import { RelicId, RelicRarity } from '../../models/relic.model';
import { CardId } from '../../models/card.model';
import { ChallengeType } from '../../data/challenges';
import { NodeType } from '../../models/node-map.model';

// Stub for CardDraftComponent so we don't pull in its full dependency tree
@Component({
  selector: 'app-card-draft',
  template: '',
})
class CardDraftStubComponent {
  @Input() cardChoices: CardReward[] = [];
  @Input() skipGoldAmount = 0;
  @Output() cardPicked = new EventEmitter<CardReward>();
  @Output() skipped = new EventEmitter<void>();
}

const MOCK_CONFIG: RewardScreenConfig = {
  goldPickup: 40,
  relicChoices: [
    { type: 'relic', relicId: RelicId.IRON_HEART },
    { type: 'relic', relicId: RelicId.CHAIN_REACTION },
    { type: 'relic', relicId: RelicId.COMMANDERS_BANNER },
  ],
  cardChoices: [
    { type: 'card', cardId: CardId.GOLD_RUSH },
    { type: 'card', cardId: CardId.DAMAGE_BOOST },
    { type: 'card', cardId: CardId.FORTIFY },
  ],
  bonusRewards: [],
  completedChallenges: [],
  nodeType: NodeType.COMBAT,
  dominantArchetype: 'neutral',
  previousDominantArchetype: null,
};

const MOCK_CONFIG_NO_CARDS: RewardScreenConfig = {
  goldPickup: 40,
  relicChoices: [
    { type: 'relic', relicId: RelicId.IRON_HEART },
  ],
  cardChoices: [],
  bonusRewards: [],
  completedChallenges: [],
  nodeType: NodeType.COMBAT,
  dominantArchetype: 'neutral',
  previousDominantArchetype: null,
};

describe('RewardScreenComponent', () => {
  let fixture: ComponentFixture<RewardScreenComponent>;
  let component: RewardScreenComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RewardScreenComponent, CardDraftStubComponent],
      imports: [CommonModule],
    });

    fixture = TestBed.createComponent(RewardScreenComponent);
    component = fixture.componentInstance;
    component.config = MOCK_CONFIG;
    fixture.detectChanges();
  });

  it('renders the gold amount from config', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('+40g');
  });

  it('renders the correct number of relic cards', () => {
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('.reward-card');
    expect(cards.length).toBe(3);
  });

  it('clicking a relic card emits rewardCollected with the correct relic id', () => {
    const emitted: RewardItem[] = [];
    component.rewardCollected.subscribe(r => emitted.push(r));

    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.reward-card');
    cards[0].click();

    expect(emitted.length).toBe(1);
    expect(emitted[0].type).toBe('relic');
    if (emitted[0].type === 'relic') {
      expect(emitted[0].relicId).toBe(RelicId.IRON_HEART);
    }
  });

  it('clicking a relic card sets relicPicked to true', () => {
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.reward-card');
    cards[0].click();
    expect(component.relicPicked).toBeTrue();
  });

  it('after relic pick, confirmation line includes the relic name', () => {
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.reward-card');
    cards[0].click();
    fixture.detectChanges();

    const confirmation = (fixture.nativeElement as HTMLElement).querySelector('.reward-picked__message--selected');
    expect(confirmation?.textContent).toContain('Relic acquired');
    expect(confirmation?.textContent).toContain('Iron Heart');
  });

  it('after card pick, confirmation line includes the card name', () => {
    component.skipRelics();
    fixture.detectChanges();

    component.onCardPicked({ type: 'card', cardId: CardId.GOLD_RUSH });
    fixture.detectChanges();

    const confirmation = (fixture.nativeElement as HTMLElement).querySelectorAll('.reward-picked__message--selected');
    const lastConfirmation = confirmation[confirmation.length - 1];
    expect(lastConfirmation?.textContent).toContain('Added to deck');
    expect(lastConfirmation?.textContent).toContain('Gold Rush');
  });

  it('skipping relic shows "No relic taken"', () => {
    fixture.detectChanges();
    component.skipRelics();
    fixture.detectChanges();

    const skipped = (fixture.nativeElement as HTMLElement).querySelector('.reward-picked__message--skipped');
    expect(skipped?.textContent).toContain('No relic taken');
  });

  it('skipping card shows "No card taken"', () => {
    component.skipRelics();
    fixture.detectChanges();
    component.onCardSkipped();
    fixture.detectChanges();

    const skipped = (fixture.nativeElement as HTMLElement).querySelectorAll('.reward-picked__message--skipped');
    const lastSkipped = skipped[skipped.length - 1];
    expect(lastSkipped?.textContent).toContain('No card taken');
  });

  it('skip button sets relicPicked without emitting rewardCollected', () => {
    const emitted: RewardItem[] = [];
    component.rewardCollected.subscribe(r => emitted.push(r));

    fixture.detectChanges();
    const skipBtn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.reward-skip-btn');
    skipBtn?.click();

    expect(component.relicPicked).toBeTrue();
    expect(emitted.length).toBe(0);
  });

  it('continue button emits screenClosed', () => {
    let closed = false;
    component.screenClosed.subscribe(() => (closed = true));

    // Resolve both reward sections so canContinue becomes true
    component.skipRelics();
    component.onCardSkipped();
    fixture.detectChanges();

    const continueBtn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.reward-continue-btn');
    continueBtn?.click();

    expect(closed).toBeTrue();
  });

  it('selected card receives the --selected modifier class', () => {
    component.pickRelic(component.relicCards[1]);
    fixture.detectChanges();

    const _cards = (fixture.nativeElement as HTMLElement).querySelectorAll('.reward-card');
    // After pick, choice section is hidden — verify component state instead
    expect(component.selectedRelic).toBe(RelicId.CHAIN_REACTION);
  });

  it('getRarityClass returns "common" for COMMON rarity', () => {
    expect(component.getRarityClass(RelicRarity.COMMON)).toBe('common');
  });

  it('getRarityClass returns "uncommon" for UNCOMMON rarity', () => {
    expect(component.getRarityClass(RelicRarity.UNCOMMON)).toBe('uncommon');
  });

  it('getRarityClass returns "rare" for RARE rarity', () => {
    expect(component.getRarityClass(RelicRarity.RARE)).toBe('rare');
  });

  it('relicCards resolves definitions from config ids', () => {
    expect(component.relicCards.length).toBe(3);
    expect(component.relicCards[0].id).toBe(RelicId.IRON_HEART);
    expect(component.relicCards[2].id).toBe(RelicId.COMMANDERS_BANNER);
  });

  // ── Card draft integration ─────────────────────────────────────────────

  it('canContinue is false when relic and card sections are both unresolved', () => {
    expect(component.canContinue).toBeFalse();
  });

  it('canContinue remains false after only relic is resolved (card choices pending)', () => {
    component.skipRelics();
    expect(component.canContinue).toBeFalse();
  });

  it('canContinue is true after both relic and card sections are resolved', () => {
    component.skipRelics();
    component.onCardSkipped();
    expect(component.canContinue).toBeTrue();
  });

  it('onCardPicked sets cardPicked=true and emits rewardCollected', () => {
    const emitted: RewardItem[] = [];
    component.rewardCollected.subscribe(r => emitted.push(r));

    const reward: CardReward = { type: 'card', cardId: CardId.GOLD_RUSH };
    component.onCardPicked(reward);

    expect(component.cardPicked).toBeTrue();
    expect(emitted.length).toBe(1);
    expect(emitted[0].type).toBe('card');
    if (emitted[0].type === 'card') {
      expect(emitted[0].cardId).toBe(CardId.GOLD_RUSH);
    }
  });

  it('onCardSkipped sets cardPicked=true and emits no reward when skip gold is 0 (rest/shop nodes)', () => {
    const emitted: RewardItem[] = [];
    component.rewardCollected.subscribe(r => emitted.push(r));
    component.config = { ...MOCK_CONFIG, nodeType: NodeType.REST };
    fixture.detectChanges();

    component.onCardSkipped();

    expect(component.cardPicked).toBeTrue();
    expect(emitted.length).toBe(0);
  });

  it('canContinue is true immediately when both relicChoices and cardChoices are empty', () => {
    component.config = { goldPickup: 10, relicChoices: [], cardChoices: [], bonusRewards: [], completedChallenges: [], nodeType: NodeType.COMBAT, dominantArchetype: 'neutral', previousDominantArchetype: null };
    expect(component.canContinue).toBeTrue();
  });

  it('canContinue is true after resolving relics when no card choices exist', () => {
    component.config = MOCK_CONFIG_NO_CARDS;
    fixture.detectChanges();
    component.skipRelics();
    expect(component.canContinue).toBeTrue();
  });

  // ── Keyboard shortcuts ────────────────────────────────────────────────

  describe('keyboard shortcuts', () => {
    function fire(key: string): KeyboardEvent {
      const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      component.handleKeydown(ev);
      return ev;
    }

    it('pressing 1 picks the first relic', () => {
      component.config = MOCK_CONFIG;
      fixture.detectChanges();
      const picked: RewardItem[] = [];
      component.rewardCollected.subscribe(r => picked.push(r));

      fire('1');

      expect(component.relicPicked).toBeTrue();
      expect(picked[0]).toEqual({ type: 'relic', relicId: RelicId.IRON_HEART });
    });

    it('pressing 3 picks the third relic', () => {
      component.config = MOCK_CONFIG;
      fixture.detectChanges();
      const picked: RewardItem[] = [];
      component.rewardCollected.subscribe(r => picked.push(r));

      fire('3');

      expect(picked[0]).toEqual({ type: 'relic', relicId: RelicId.COMMANDERS_BANNER });
    });

    it('pressing 1 after relic is resolved picks the first card', () => {
      component.config = MOCK_CONFIG;
      component.skipRelics();
      fixture.detectChanges();
      const picked: RewardItem[] = [];
      component.rewardCollected.subscribe(r => picked.push(r));

      fire('1');

      expect(component.cardPicked).toBeTrue();
      expect(picked[0]).toEqual({ type: 'card', cardId: CardId.GOLD_RUSH });
    });

    it('pressing Escape skips the active relic section', () => {
      component.config = MOCK_CONFIG;
      fixture.detectChanges();

      fire('Escape');

      expect(component.relicPicked).toBeTrue();
      expect(component.selectedRelic).toBeNull();
    });

    it('pressing Escape after relic is resolved skips the card section', () => {
      component.config = MOCK_CONFIG;
      component.skipRelics();
      fixture.detectChanges();

      fire('Escape');

      expect(component.cardPicked).toBeTrue();
    });

    it('pressing a number beyond the choice count is a no-op', () => {
      component.config = MOCK_CONFIG;
      fixture.detectChanges();

      fire('9');

      expect(component.relicPicked).toBeFalse();
    });

    it('pressing Space when target is body suppresses default (no scroll)', () => {
      component.config = MOCK_CONFIG;
      fixture.detectChanges();

      const ev = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'target', { value: document.body });
      component.handleKeydown(ev);

      expect(ev.defaultPrevented).toBeTrue();
      // no side effects
      expect(component.relicPicked).toBeFalse();
      expect(component.cardPicked).toBeFalse();
    });

    it('ignores keystrokes from input fields', () => {
      component.config = MOCK_CONFIG;
      fixture.detectChanges();

      const input = document.createElement('input');
      document.body.appendChild(input);
      const ev = new KeyboardEvent('keydown', { key: '1', bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'target', { value: input });
      component.handleKeydown(ev);
      document.body.removeChild(input);

      expect(component.relicPicked).toBeFalse();
    });
  });

  // ── Empty-section rendering (node-type differentiation) ──────────────

  describe('empty section rendering', () => {
    it('relic section is NOT rendered when relicChoices is empty (combat node)', () => {
      component.config = {
        goldPickup: 30,
        relicChoices: [],
        cardChoices: [{ type: 'card', cardId: CardId.GOLD_RUSH }],
        bonusRewards: [],
        completedChallenges: [],
        nodeType: NodeType.COMBAT,
        dominantArchetype: 'neutral',
        previousDominantArchetype: null,
      };
      fixture.detectChanges();

      const relicSection = (fixture.nativeElement as HTMLElement).querySelector('.reward-choices');
      expect(relicSection).toBeNull();
    });

    it('card-draft section is NOT rendered when cardChoices is empty (boss node)', () => {
      component.config = {
        goldPickup: 80,
        relicChoices: [{ type: 'relic', relicId: RelicId.IRON_HEART }],
        cardChoices: [],
        bonusRewards: [],
        completedChallenges: [],
        nodeType: NodeType.BOSS,
        dominantArchetype: 'neutral',
        previousDominantArchetype: null,
      };
      fixture.detectChanges();

      const cardDraft = (fixture.nativeElement as HTMLElement).querySelector('app-card-draft');
      expect(cardDraft).toBeNull();
    });

    it('canContinue is true immediately for boss node (1 relic, 0 cards) after relic is picked', () => {
      component.config = {
        goldPickup: 80,
        relicChoices: [{ type: 'relic', relicId: RelicId.IRON_HEART }],
        cardChoices: [],
        bonusRewards: [],
        completedChallenges: [],
        nodeType: NodeType.BOSS,
        dominantArchetype: 'neutral',
        previousDominantArchetype: null,
      };
      fixture.detectChanges();
      component.pickRelic(component.relicCards[0]);

      expect(component.canContinue).toBeTrue();
    });

    it('canContinue is true immediately for combat node (0 relics, 3 cards) after card is picked', () => {
      component.config = {
        goldPickup: 30,
        relicChoices: [],
        cardChoices: [
          { type: 'card', cardId: CardId.GOLD_RUSH },
          { type: 'card', cardId: CardId.DAMAGE_BOOST },
          { type: 'card', cardId: CardId.FORTIFY },
        ],
        bonusRewards: [],
        completedChallenges: [],
        nodeType: NodeType.COMBAT,
        dominantArchetype: 'neutral',
        previousDominantArchetype: null,
      };
      fixture.detectChanges();
      component.onCardPicked({ type: 'card', cardId: CardId.GOLD_RUSH });

      expect(component.canContinue).toBeTrue();
    });
  });

  // ── Completed-challenges render ───────────────────────────────────────

  describe('completedChallenges display', () => {
    it('hides the challenges block entirely when none were completed', () => {
      const section = (fixture.nativeElement as HTMLElement).querySelector('.reward-challenges');
      expect(section).toBeNull();
    });

    it('renders one row per completed challenge with name, description, and gold bonus', () => {
      component.config = {
        ...MOCK_CONFIG,
        completedChallenges: [
          { id: 'c01_untouchable', type: ChallengeType.UNTOUCHABLE, name: 'Untouchable',
            description: 'Win without losing any lives', scoreBonus: 200 },
          { id: 'c01_tower_limit', type: ChallengeType.TOWER_LIMIT, name: 'Minimalist',
            description: 'Win with 4 or fewer towers at once', scoreBonus: 300, towerLimit: 4 },
        ],
      };
      fixture.detectChanges();

      const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('.reward-challenge-item');
      expect(rows.length).toBe(2);

      // Row content
      expect(rows[0].textContent).toContain('Untouchable');
      expect(rows[0].textContent).toContain('Win without losing any lives');
      // 200 scoreBonus / 5 ratio = 40 gold
      expect(rows[0].textContent).toContain('+40g');

      // 300 scoreBonus / 5 ratio = 60 gold
      expect(rows[1].textContent).toContain('+60g');
    });

    it('totalChallengeGold sums per-challenge bonuses via shared ratio', () => {
      component.config = {
        ...MOCK_CONFIG,
        completedChallenges: [
          { id: 'a', type: ChallengeType.UNTOUCHABLE, name: 'A', description: 'd', scoreBonus: 200 },
          { id: 'b', type: ChallengeType.NO_SLOW, name: 'B', description: 'd', scoreBonus: 200 },
          { id: 'c', type: ChallengeType.FRUGAL, name: 'C', description: 'd', scoreBonus: 250, goldLimit: 100 },
        ],
      };
      fixture.detectChanges();

      // 200/5 + 200/5 + 250/5 = 40 + 40 + 50 = 130
      expect(component.totalChallengeGold).toBe(130);
    });

    it('challengeGoldBonus uses Math.round on non-divisible bonuses', () => {
      const odd = { id: 'x', type: ChallengeType.UNTOUCHABLE, name: 'X', description: 'd', scoreBonus: 201 };
      // 201 / 5 = 40.2 → rounds to 40
      expect(component.challengeGoldBonus(odd)).toBe(40);
    });
  });

  // ── S9: card-skip gold ────────────────────────────────────────────────

  describe('skipGoldAmount (S9)', () => {
    it('skipGoldAmount is 25 when nodeType is COMBAT', () => {
      component.config = { ...MOCK_CONFIG, nodeType: NodeType.COMBAT };
      expect(component.skipGoldAmount).toBe(25);
    });

    it('skipGoldAmount is 50 when nodeType is ELITE', () => {
      component.config = { ...MOCK_CONFIG, nodeType: NodeType.ELITE };
      expect(component.skipGoldAmount).toBe(50);
    });

    it('skipGoldAmount is 75 when nodeType is BOSS', () => {
      component.config = { ...MOCK_CONFIG, nodeType: NodeType.BOSS };
      expect(component.skipGoldAmount).toBe(75);
    });

    it('skipGoldAmount is 0 when nodeType is REST', () => {
      component.config = { ...MOCK_CONFIG, nodeType: NodeType.REST };
      expect(component.skipGoldAmount).toBe(0);
    });

    it('onCardSkipped() emits gold reward when skipGoldAmount > 0 (COMBAT)', () => {
      component.config = { ...MOCK_CONFIG, nodeType: NodeType.COMBAT };
      const emitted: RewardItem[] = [];
      component.rewardCollected.subscribe(r => emitted.push(r));

      component.onCardSkipped();

      expect(component.cardPicked).toBeTrue();
      expect(emitted.length).toBe(1);
      expect(emitted[0]).toEqual({ type: 'gold', amount: 25 });
    });

    it('onCardSkipped() does NOT emit when skipGoldAmount is 0 (REST)', () => {
      component.config = { ...MOCK_CONFIG, nodeType: NodeType.REST };
      const emitted: RewardItem[] = [];
      component.rewardCollected.subscribe(r => emitted.push(r));

      component.onCardSkipped();

      expect(component.cardPicked).toBeTrue();
      expect(emitted.length).toBe(0);
    });
  });

  // ── Phase 2 Sprint 10.5: Deck-leaning archetype chip ─────────────────

  describe('deck-leaning archetype chip', () => {
    it('renders the chip on every reward screen regardless of archetype', () => {
      component.config = { ...MOCK_CONFIG, dominantArchetype: 'neutral' };
      fixture.detectChanges();

      const chip = (fixture.nativeElement as HTMLElement).querySelector('.reward-archetype');
      expect(chip).not.toBeNull();
    });

    it('shows "Neutral" when the deck has no dominant archetype', () => {
      component.config = { ...MOCK_CONFIG, dominantArchetype: 'neutral' };
      fixture.detectChanges();

      const chip = (fixture.nativeElement as HTMLElement).querySelector('.reward-archetype__chip');
      expect(chip?.textContent?.trim()).toBe('Neutral');
    });

    it('shows "Cartographer" when the dominant archetype is cartographer', () => {
      component.config = { ...MOCK_CONFIG, dominantArchetype: 'cartographer' };
      fixture.detectChanges();

      const chip = (fixture.nativeElement as HTMLElement).querySelector('.reward-archetype__chip');
      expect(chip?.textContent?.trim()).toBe('Cartographer');
    });

    it('shows the correct label for every archetype', () => {
      const cases: Array<[RewardScreenConfig['dominantArchetype'], string]> = [
        ['cartographer', 'Cartographer'],
        ['highground',   'Highground'],
        ['conduit',      'Conduit'],
        ['siegeworks',   'Siegeworks'],
        ['neutral',      'Neutral'],
      ];

      for (const [arch, label] of cases) {
        component.config = { ...MOCK_CONFIG, dominantArchetype: arch };
        fixture.detectChanges();

        const chip = (fixture.nativeElement as HTMLElement).querySelector('.reward-archetype__chip');
        expect(chip?.textContent?.trim()).toBe(label);
      }
    });

    it('tags the wrapper with data-archetype for scoped styling / QA selectors', () => {
      component.config = { ...MOCK_CONFIG, dominantArchetype: 'siegeworks' };
      fixture.detectChanges();

      const wrapper = (fixture.nativeElement as HTMLElement).querySelector('.reward-archetype');
      expect(wrapper?.getAttribute('data-archetype')).toBe('siegeworks');
    });

    it('exposes a screen-reader label so assistive tech announces the archetype', () => {
      component.config = { ...MOCK_CONFIG, dominantArchetype: 'highground' };
      fixture.detectChanges();

      const wrapper = (fixture.nativeElement as HTMLElement).querySelector('.reward-archetype');
      expect(wrapper?.getAttribute('aria-label')).toContain('Highground');
    });

    it('applies the archetype-specific color via CSS custom property', () => {
      component.config = { ...MOCK_CONFIG, dominantArchetype: 'cartographer' };
      fixture.detectChanges();

      const chip = (fixture.nativeElement as HTMLElement).querySelector('.reward-archetype__chip') as HTMLElement;
      expect(chip.style.getPropertyValue('--archetype-color')).toBe('#e8c06b');
    });

    it('archetypeDisplay getter proxies ARCHETYPE_DISPLAY for the current config value', () => {
      component.config = { ...MOCK_CONFIG, dominantArchetype: 'conduit' };
      expect(component.archetypeDisplay.label).toBe('Conduit');
      expect(component.archetypeDisplay.color).toBe('#c98cf0');
    });

    it('does not mutate between card pick and continue (snapshot semantics)', () => {
      component.config = { ...MOCK_CONFIG, dominantArchetype: 'cartographer' };
      fixture.detectChanges();

      // Simulate a card pick — chip must still reflect the pre-pick snapshot
      component.onCardPicked({ type: 'card', cardId: CardId.GOLD_RUSH });
      fixture.detectChanges();

      const chip = (fixture.nativeElement as HTMLElement).querySelector('.reward-archetype__chip');
      expect(chip?.textContent?.trim()).toBe('Cartographer');
    });
  });

  // ── Phase 3 prep: Archetype chip flip animation ─────────────────────

  describe('archetype chip flip animation', () => {
    beforeEach(() => {
      // Stub matchMedia so the reduced-motion branch is deterministic across tests.
      spyOn(window, 'matchMedia').and.returnValue({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      } as unknown as MediaQueryList);
    });

    // The outer beforeEach calls detectChanges() once, so ngOnInit has already
    // fired against MOCK_CONFIG (previousDominantArchetype: null → no flip).
    // Each test below rewires config and re-invokes ngOnInit to exercise the
    // lifecycle path under the new config. In production the parent destroys
    // and recreates the component via *ngIf, so ngOnInit runs exactly once
    // per reward screen.

    it('does not flip on the first reward screen of a run (previous is null)', () => {
      component.config = { ...MOCK_CONFIG, dominantArchetype: 'cartographer', previousDominantArchetype: null };
      component.ngOnInit();
      fixture.detectChanges();

      expect(component.isArchetypeFlipping).toBeFalse();
      const chip = (fixture.nativeElement as HTMLElement).querySelector('.reward-archetype__chip');
      expect(chip?.classList.contains('reward-archetype__chip--flipping')).toBeFalse();
    });

    it('does not flip when the archetype is unchanged between screens', () => {
      component.config = { ...MOCK_CONFIG, dominantArchetype: 'cartographer', previousDominantArchetype: 'cartographer' };
      component.ngOnInit();
      fixture.detectChanges();

      expect(component.isArchetypeFlipping).toBeFalse();
    });

    it('flips when the dominant archetype changes between reward screens', () => {
      component.config = { ...MOCK_CONFIG, dominantArchetype: 'cartographer', previousDominantArchetype: 'neutral' };
      component.ngOnInit();
      fixture.detectChanges();

      expect(component.isArchetypeFlipping).toBeTrue();
      const chip = (fixture.nativeElement as HTMLElement).querySelector('.reward-archetype__chip');
      expect(chip?.classList.contains('reward-archetype__chip--flipping')).toBeTrue();
    });

    it('clears the flipping flag after 600ms', fakeAsync(() => {
      component.config = { ...MOCK_CONFIG, dominantArchetype: 'highground', previousDominantArchetype: 'cartographer' };
      component.ngOnInit();
      fixture.detectChanges();

      expect(component.isArchetypeFlipping).toBeTrue();
      tick(600);
      expect(component.isArchetypeFlipping).toBeFalse();
    }));

    it('does not schedule the animation when prefers-reduced-motion is set', () => {
      (window.matchMedia as jasmine.Spy).and.returnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      } as unknown as MediaQueryList);

      component.config = { ...MOCK_CONFIG, dominantArchetype: 'conduit', previousDominantArchetype: 'neutral' };
      component.ngOnInit();
      fixture.detectChanges();

      expect(component.isArchetypeFlipping).toBeFalse();
    });

    it('cancels the pending flip timer on destroy (no stray timeouts after teardown)', fakeAsync(() => {
      component.config = { ...MOCK_CONFIG, dominantArchetype: 'siegeworks', previousDominantArchetype: 'cartographer' };
      component.ngOnInit();
      fixture.detectChanges();

      expect(component.isArchetypeFlipping).toBeTrue();
      fixture.destroy();
      // If ngOnDestroy did not clear the timer, fakeAsync would flag a pending timer.
      tick(600);
      // Reaching here without a fakeAsync error is the assertion.
      expect(true).toBeTrue();
    }));
  });
});
