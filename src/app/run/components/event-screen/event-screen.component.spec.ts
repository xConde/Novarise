import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { EventScreenComponent } from './event-screen.component';
import { RunEvent, EventOutcome } from '../../models/encounter.model';
import { RelicId } from '../../models/relic.model';
import { ItemType } from '../../models/item.model';

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeOutcome(overrides: Partial<EventOutcome> = {}): EventOutcome {
  return {
    goldDelta: 0,
    livesDelta: 0,
    description: 'Test outcome.',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<RunEvent> = {}): RunEvent {
  return {
    id: 'test_event',
    title: 'Test Event',
    description: 'Something happened.',
    choices: [
      { label: 'Choice A', description: 'Risk gold.', outcome: makeOutcome({ goldDelta: 40 }) },
      { label: 'Choice B', description: 'Risk lives.', outcome: makeOutcome({ livesDelta: -2 }) },
    ],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('EventScreenComponent', () => {
  let fixture: ComponentFixture<EventScreenComponent>;
  let component: EventScreenComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EventScreenComponent],
      imports: [CommonModule],
    }).compileComponents();

    fixture = TestBed.createComponent(EventScreenComponent);
    component = fixture.componentInstance;
    component.event = makeEvent();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('starts with no selection and outcome hidden', () => {
      expect(component.selectedChoice).toBeNull();
      expect(component.showOutcome).toBeFalse();
    });

    it('currentOutcome returns null when no choice selected', () => {
      expect(component.currentOutcome).toBeNull();
    });
  });

  describe('makeChoice()', () => {
    it('sets selectedChoice to the provided index', () => {
      component.makeChoice(0);
      expect(component.selectedChoice).toBe(0);
    });

    it('sets showOutcome to true', () => {
      component.makeChoice(1);
      expect(component.showOutcome).toBeTrue();
    });

    it('currentOutcome reflects the chosen outcome', () => {
      component.makeChoice(0);
      const outcome = component.currentOutcome;
      expect(outcome).not.toBeNull();
      expect(outcome!.goldDelta).toBe(40);
    });

    it('does NOT change selection when already resolved', () => {
      component.makeChoice(0);
      component.makeChoice(1); // second call should be ignored
      expect(component.selectedChoice).toBe(0);
    });

    it('does not emit previewGamble for non-gamble outcomes', () => {
      const spy = jasmine.createSpy('previewGamble');
      component.previewGamble.subscribe(spy);
      component.makeChoice(0);
      expect(spy).not.toHaveBeenCalled();
    });

    it('emits previewCardRemoval with the choice index for removeCard outcomes', () => {
      component.event = makeEvent({
        choices: [
          {
            label: 'Remove',
            description: 'Remove a card.',
            outcome: makeOutcome({ removeCard: true }),
          },
        ],
      });

      const spy = jasmine.createSpy('previewCardRemoval');
      component.previewCardRemoval.subscribe(spy);
      component.makeChoice(0);
      expect(spy).toHaveBeenCalledWith(0);
    });

    it('does not emit previewCardRemoval for non-removeCard outcomes', () => {
      const spy = jasmine.createSpy('previewCardRemoval');
      component.previewCardRemoval.subscribe(spy);
      component.makeChoice(0); // goldDelta choice — no removeCard
      expect(spy).not.toHaveBeenCalled();
    });

    it('emits previewGamble with the choice index for gamble outcomes', () => {
      component.event = makeEvent({
        choices: [
          {
            label: 'Gamble',
            description: 'Roll the dice.',
            outcome: makeOutcome({
              gamble: { winGoldDelta: 100, loseGoldDelta: -50, winChance: 0.5 },
            }),
          },
          { label: 'Skip', description: 'Nothing.', outcome: makeOutcome() },
        ],
      });

      const spy = jasmine.createSpy('previewGamble');
      component.previewGamble.subscribe(spy);
      component.makeChoice(0);
      expect(spy).toHaveBeenCalledWith(0);
    });
  });

  describe('confirmChoice()', () => {
    it('emits choiceMade with the selected index', () => {
      const spy = jasmine.createSpy('choiceMade');
      component.choiceMade.subscribe(spy);

      component.makeChoice(1);
      component.confirmChoice();

      expect(spy).toHaveBeenCalledWith(1);
    });

    it('does NOT emit when no choice has been made', () => {
      const spy = jasmine.createSpy('choiceMade');
      component.choiceMade.subscribe(spy);

      component.confirmChoice();

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('getOutcomeClass()', () => {
    it('returns "positive" when goldDelta > 0', () => {
      const outcome = makeOutcome({ goldDelta: 50 });
      expect(component.getOutcomeClass(outcome)).toBe('positive');
    });

    it('returns "positive" when livesDelta > 0', () => {
      const outcome = makeOutcome({ livesDelta: 2 });
      expect(component.getOutcomeClass(outcome)).toBe('positive');
    });

    it('returns "positive" when relicId is set', () => {
      const outcome = makeOutcome({ relicId: RelicId.IRON_HEART });
      expect(component.getOutcomeClass(outcome)).toBe('positive');
    });

    it('returns "positive" when itemReward is set', () => {
      const outcome = makeOutcome({ itemReward: ItemType.BOMB });
      expect(component.getOutcomeClass(outcome)).toBe('positive');
    });

    it('returns "negative" when goldDelta < 0', () => {
      const outcome = makeOutcome({ goldDelta: -30 });
      expect(component.getOutcomeClass(outcome)).toBe('negative');
    });

    it('returns "negative" when livesDelta < 0', () => {
      const outcome = makeOutcome({ livesDelta: -1 });
      expect(component.getOutcomeClass(outcome)).toBe('negative');
    });

    it('returns "negative" when removeRelicId is set', () => {
      const outcome = makeOutcome({ removeRelicId: RelicId.IRON_HEART });
      expect(component.getOutcomeClass(outcome)).toBe('negative');
    });

    it('returns "negative" when removeCard is true', () => {
      const outcome = makeOutcome({ removeCard: true });
      expect(component.getOutcomeClass(outcome)).toBe('negative');
    });

    it('returns "neutral" when all deltas are zero and no relic', () => {
      const outcome = makeOutcome();
      expect(component.getOutcomeClass(outcome)).toBe('neutral');
    });
  });

  describe('formatDelta()', () => {
    it('prefixes positive numbers with "+"', () => {
      expect(component.formatDelta(40)).toBe('+40');
      expect(component.formatDelta(1)).toBe('+1');
    });

    it('does not add prefix for zero', () => {
      expect(component.formatDelta(0)).toBe('+0');
    });

    it('keeps negative sign for negative numbers', () => {
      expect(component.formatDelta(-2)).toBe('-2');
      expect(component.formatDelta(-100)).toBe('-100');
    });
  });

  describe('event with relic outcome', () => {
    it('currentOutcome contains relicId when applicable', () => {
      component.event = makeEvent({
        choices: [
          {
            label: 'Take relic',
            description: 'Gain a relic.',
            outcome: makeOutcome({ relicId: RelicId.GOLD_MAGNET }),
          },
          {
            label: 'Skip',
            description: 'Nothing happens.',
            outcome: makeOutcome(),
          },
        ],
      });

      component.makeChoice(0);
      expect(component.currentOutcome!.relicId).toBe(RelicId.GOLD_MAGNET);
    });
  });

  describe('getRelicName()', () => {
    it('returns the human-readable name for a known relic id', () => {
      expect(component.getRelicName(RelicId.QUICK_DRAW)).toBe('Quick Draw');
    });

    it('returns the human-readable name for IRON_HEART', () => {
      expect(component.getRelicName(RelicId.IRON_HEART)).toBe('Iron Heart');
    });

    it('falls back to the raw id for an unknown relic id', () => {
      expect(component.getRelicName('UNKNOWN_RELIC')).toBe('UNKNOWN_RELIC');
    });
  });

  describe('getItemName()', () => {
    it('returns the human-readable name for a known item type', () => {
      expect(component.getItemName(ItemType.HEAL_POTION)).toBe('Heal Potion');
    });

    it('returns the human-readable name for BOMB', () => {
      expect(component.getItemName(ItemType.BOMB)).toBe('Bomb');
    });

    it('falls back to the raw id for an unknown item type', () => {
      expect(component.getItemName('UNKNOWN_ITEM')).toBe('UNKNOWN_ITEM');
    });
  });

  describe('removedCardName input', () => {
    it('defaults to null', () => {
      expect(component.removedCardName).toBeNull();
    });

    it('can be set to a card name string', () => {
      component.removedCardName = 'Pip · Basic';
      expect(component.removedCardName).toBe('Pip · Basic');
    });
  });

  describe('gamble outcome resolution', () => {
    function makeGambleEvent(winChance: number): RunEvent {
      return makeEvent({
        choices: [
          {
            label: 'Gamble',
            description: 'Roll the dice.',
            outcome: makeOutcome({
              goldDelta: 0,
              gamble: {
                winGoldDelta: 100,
                loseGoldDelta: -50,
                winChance,
              },
            }),
          },
          { label: 'Skip', description: 'Nothing.', outcome: makeOutcome() },
        ],
      });
    }

    it('displayedGoldDelta uses resolvedGamble.goldDelta when set (win)', () => {
      component.event = makeGambleEvent(1);
      component.resolvedGamble = { goldDelta: 100, livesDelta: 0 };
      component.makeChoice(0);
      expect(component.displayedGoldDelta).toBe(100);
    });

    it('displayedGoldDelta uses resolvedGamble.goldDelta when set (loss)', () => {
      component.event = makeGambleEvent(0);
      component.resolvedGamble = { goldDelta: -50, livesDelta: 0 };
      component.makeChoice(0);
      expect(component.displayedGoldDelta).toBe(-50);
    });

    it('displayedGoldDelta defaults to 0 when resolvedGamble is null (gamble outcome)', () => {
      component.event = makeGambleEvent(0.5);
      component.resolvedGamble = null;
      component.makeChoice(0);
      expect(component.displayedGoldDelta).toBe(0);
    });

    it('displayedGoldDelta uses static goldDelta when no gamble is present', () => {
      component.makeChoice(0); // goldDelta: 40 from makeEvent defaults
      expect(component.displayedGoldDelta).toBe(40);
    });

    it('displayedLivesDelta includes resolvedGamble.livesDelta for gamble outcomes', () => {
      component.event = makeEvent({
        choices: [
          {
            label: 'Wager lives',
            description: 'Risk it.',
            outcome: makeOutcome({
              livesDelta: 0,
              gamble: {
                winGoldDelta: 0,
                loseGoldDelta: 0,
                winChance: 0.5,
                winLivesDelta: 5,
                loseLivesDelta: -3,
              },
            }),
          },
          { label: 'Skip', description: 'Nothing.', outcome: makeOutcome() },
        ],
      });
      component.resolvedGamble = { goldDelta: 0, livesDelta: 5 };
      component.makeChoice(0);
      expect(component.displayedLivesDelta).toBe(5);
    });

    it('displayedLivesDelta uses loss lives delta from resolvedGamble', () => {
      component.event = makeEvent({
        choices: [
          {
            label: 'Wager lives',
            description: 'Risk it.',
            outcome: makeOutcome({
              livesDelta: 0,
              gamble: {
                winGoldDelta: 0,
                loseGoldDelta: 0,
                winChance: 0.5,
                winLivesDelta: 5,
                loseLivesDelta: -3,
              },
            }),
          },
          { label: 'Skip', description: 'Nothing.', outcome: makeOutcome() },
        ],
      });
      component.resolvedGamble = { goldDelta: 0, livesDelta: -3 };
      component.makeChoice(0);
      expect(component.displayedLivesDelta).toBe(-3);
    });

    it('displayedLivesDelta sums base livesDelta with resolvedGamble.livesDelta', () => {
      component.event = makeEvent({
        choices: [
          {
            label: 'Wager',
            description: 'Risk it.',
            outcome: makeOutcome({
              livesDelta: -1,
              gamble: {
                winGoldDelta: 0,
                loseGoldDelta: 0,
                winChance: 0.5,
                winLivesDelta: 3,
              },
            }),
          },
          { label: 'Skip', description: 'Nothing.', outcome: makeOutcome() },
        ],
      });
      component.resolvedGamble = { goldDelta: 0, livesDelta: 3 };
      component.makeChoice(0);
      // base -1 + win delta +3 = +2
      expect(component.displayedLivesDelta).toBe(2);
    });

    it('getOutcomeClass returns "positive" when resolvedGamble shows a win', () => {
      component.event = makeGambleEvent(1);
      component.resolvedGamble = { goldDelta: 100, livesDelta: 0 };
      component.makeChoice(0);
      expect(component.getOutcomeClass(component.currentOutcome!)).toBe('positive');
    });

    it('getOutcomeClass returns "negative" when resolvedGamble shows a loss', () => {
      component.event = makeGambleEvent(0);
      component.resolvedGamble = { goldDelta: -50, livesDelta: 0 };
      component.makeChoice(0);
      expect(component.getOutcomeClass(component.currentOutcome!)).toBe('negative');
    });
  });
});
