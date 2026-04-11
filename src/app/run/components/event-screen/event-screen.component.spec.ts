import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { EventScreenComponent } from './event-screen.component';
import { RunEvent, EventOutcome } from '../../models/encounter.model';
import { RelicId } from '../../models/relic.model';

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
});
