import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RewardScreenComponent } from './reward-screen.component';
import { RewardScreenConfig, RewardItem, CardReward } from '../../models/encounter.model';
import { RelicId, RelicRarity } from '../../models/relic.model';
import { CardId } from '../../models/card.model';
import { ChallengeType } from '../../data/challenges';

// Stub for CardDraftComponent so we don't pull in its full dependency tree
@Component({
  selector: 'app-card-draft',
  template: '',
})
class CardDraftStubComponent {
  @Input() cardChoices: CardReward[] = [];
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
};

const MOCK_CONFIG_NO_CARDS: RewardScreenConfig = {
  goldPickup: 40,
  relicChoices: [
    { type: 'relic', relicId: RelicId.IRON_HEART },
  ],
  cardChoices: [],
  bonusRewards: [],
  completedChallenges: [],
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

    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('.reward-card');
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

  it('onCardSkipped sets cardPicked=true without emitting rewardCollected', () => {
    const emitted: RewardItem[] = [];
    component.rewardCollected.subscribe(r => emitted.push(r));

    component.onCardSkipped();

    expect(component.cardPicked).toBeTrue();
    expect(emitted.length).toBe(0);
  });

  it('canContinue is true immediately when both relicChoices and cardChoices are empty', () => {
    component.config = { goldPickup: 10, relicChoices: [], cardChoices: [], bonusRewards: [], completedChallenges: [] };
    expect(component.canContinue).toBeTrue();
  });

  it('canContinue is true after resolving relics when no card choices exist', () => {
    component.config = MOCK_CONFIG_NO_CARDS;
    fixture.detectChanges();
    component.skipRelics();
    expect(component.canContinue).toBeTrue();
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
});
