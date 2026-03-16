import { TutorialService, TutorialStep, TutorialTip } from './tutorial.service';

const STORAGE_KEY = 'novarise-tutorial';

describe('TutorialService', () => {
  let service: TutorialService;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    service = new TutorialService();
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  // --- Construction ---

  it('should create without error', () => {
    expect(service).toBeTruthy();
  });

  it('isTutorialComplete() returns false initially', () => {
    expect(service.isTutorialComplete()).toBeFalse();
  });

  it('current step is null on construction', (done) => {
    service.getCurrentStep().subscribe(step => {
      expect(step).toBeNull();
      done();
    });
  });

  // --- startTutorial ---

  it('startTutorial() sets current step to WELCOME', (done) => {
    const steps: Array<TutorialStep | null> = [];
    const sub = service.getCurrentStep().subscribe(step => steps.push(step));
    service.startTutorial();
    sub.unsubscribe();
    expect(steps).toContain(TutorialStep.WELCOME);
    done();
  });

  // --- advanceStep ---

  it('advanceStep() progresses through all steps in order', () => {
    const emitted: Array<TutorialStep | null> = [];
    const sub = service.getCurrentStep().subscribe(s => emitted.push(s));

    service.startTutorial();
    service.advanceStep(); // WELCOME → SELECT_TOWER
    service.advanceStep(); // SELECT_TOWER → PLACE_TOWER
    service.advanceStep(); // PLACE_TOWER → START_WAVE
    service.advanceStep(); // START_WAVE → UPGRADE_TOWER
    service.advanceStep(); // UPGRADE_TOWER → COMPLETE

    sub.unsubscribe();

    expect(emitted).toContain(TutorialStep.SELECT_TOWER);
    expect(emitted).toContain(TutorialStep.PLACE_TOWER);
    expect(emitted).toContain(TutorialStep.START_WAVE);
    expect(emitted).toContain(TutorialStep.UPGRADE_TOWER);
    expect(emitted).toContain(TutorialStep.COMPLETE);
  });

  it('after advancing past COMPLETE, current step becomes null', () => {
    const emitted: Array<TutorialStep | null> = [];
    const sub = service.getCurrentStep().subscribe(s => emitted.push(s));

    service.startTutorial();
    // Advance through all steps: WELCOME → SELECT_TOWER → PLACE_TOWER → START_WAVE → UPGRADE_TOWER → COMPLETE → null
    service.advanceStep();
    service.advanceStep();
    service.advanceStep();
    service.advanceStep();
    service.advanceStep();
    // Now at COMPLETE; one more advance should null out
    service.advanceStep();

    sub.unsubscribe();

    expect(emitted[emitted.length - 1]).toBeNull();
  });

  it('after completing all steps, isTutorialComplete() returns true', () => {
    service.startTutorial();
    service.advanceStep();
    service.advanceStep();
    service.advanceStep();
    service.advanceStep();
    service.advanceStep(); // arrives at COMPLETE
    service.advanceStep(); // advances past COMPLETE → null + marks complete

    expect(service.isTutorialComplete()).toBeTrue();
  });

  it('advanceStep() is a no-op when current step is null', () => {
    const emitted: Array<TutorialStep | null> = [];
    const sub = service.getCurrentStep().subscribe(s => emitted.push(s));
    const initialLength = emitted.length;

    service.advanceStep();

    sub.unsubscribe();
    // Should not have emitted anything new
    expect(emitted.length).toBe(initialLength);
  });

  // --- skipTutorial ---

  it('skipTutorial() immediately marks tutorial as complete', () => {
    service.startTutorial();
    service.skipTutorial();
    expect(service.isTutorialComplete()).toBeTrue();
  });

  it('skipTutorial() sets current step to null', (done) => {
    service.startTutorial();
    service.skipTutorial();
    service.getCurrentStep().subscribe(step => {
      expect(step).toBeNull();
      done();
    });
  });

  // --- resetTutorial ---

  it('resetTutorial() clears completion state', () => {
    service.startTutorial();
    service.skipTutorial();
    expect(service.isTutorialComplete()).toBeTrue();

    service.resetTutorial();
    expect(service.isTutorialComplete()).toBeFalse();
  });

  it('after reset, isTutorialComplete() returns false', () => {
    service.skipTutorial();
    service.resetTutorial();
    expect(service.isTutorialComplete()).toBeFalse();
  });

  it('resetTutorial() sets current step to null', (done) => {
    service.startTutorial();
    service.resetTutorial();
    service.getCurrentStep().subscribe(step => {
      expect(step).toBeNull();
      done();
    });
  });

  it('resetTutorial() removes item from localStorage', () => {
    service.startTutorial();
    service.advanceStep();
    // save() would have been called — verify something is in storage
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();

    service.resetTutorial();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  // --- getTip ---

  it('getTip() returns correct tip for WELCOME step', () => {
    const tip: TutorialTip = service.getTip(TutorialStep.WELCOME);
    expect(tip.step).toBe(TutorialStep.WELCOME);
    expect(tip.title).toBeTruthy();
    expect(tip.message).toBeTruthy();
    expect(tip.position).toBeDefined();
  });

  it('getTip() returns correct tip for SELECT_TOWER step', () => {
    const tip: TutorialTip = service.getTip(TutorialStep.SELECT_TOWER);
    expect(tip.step).toBe(TutorialStep.SELECT_TOWER);
    expect(tip.title).toContain('Tower');
  });

  it('getTip() returns correct tip for PLACE_TOWER step', () => {
    const tip: TutorialTip = service.getTip(TutorialStep.PLACE_TOWER);
    expect(tip.step).toBe(TutorialStep.PLACE_TOWER);
  });

  it('getTip() returns correct tip for START_WAVE step', () => {
    const tip: TutorialTip = service.getTip(TutorialStep.START_WAVE);
    expect(tip.step).toBe(TutorialStep.START_WAVE);
  });

  it('getTip() returns correct tip for UPGRADE_TOWER step', () => {
    const tip: TutorialTip = service.getTip(TutorialStep.UPGRADE_TOWER);
    expect(tip.step).toBe(TutorialStep.UPGRADE_TOWER);
  });

  it('getTip() returns correct tip for COMPLETE step', () => {
    const tip: TutorialTip = service.getTip(TutorialStep.COMPLETE);
    expect(tip.step).toBe(TutorialStep.COMPLETE);
  });

  // --- localStorage persistence ---

  it('persists seen steps to localStorage on advanceStep()', () => {
    service.startTutorial();
    service.advanceStep(); // marks WELCOME as seen

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { seenSteps: string[] };
    expect(parsed.seenSteps).toContain(TutorialStep.WELCOME);
  });

  it('persists seen steps to localStorage on skipTutorial()', () => {
    service.startTutorial();
    service.skipTutorial();

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { seenSteps: string[] };
    expect(parsed.seenSteps).toContain(TutorialStep.COMPLETE);
  });

  it('loads persisted seen steps on construction', () => {
    const data = { seenSteps: [TutorialStep.COMPLETE] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    const fresh = new TutorialService();
    expect(fresh.isTutorialComplete()).toBeTrue();
  });

  // --- Corrupted localStorage ---

  it('handles corrupted localStorage gracefully — returns empty set', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json{{');
    const fresh = new TutorialService();
    expect(fresh.isTutorialComplete()).toBeFalse();
  });

  it('handles localStorage with wrong shape gracefully', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seenSteps: 'not-an-array' }));
    const fresh = new TutorialService();
    expect(fresh.isTutorialComplete()).toBeFalse();
  });

  // --- Observable ---

  it('getCurrentStep() observable emits step changes', () => {
    const emitted: Array<TutorialStep | null> = [];
    const sub = service.getCurrentStep().subscribe(s => emitted.push(s));

    service.startTutorial();
    service.advanceStep();

    sub.unsubscribe();

    expect(emitted).toContain(TutorialStep.WELCOME);
    expect(emitted).toContain(TutorialStep.SELECT_TOWER);
  });

  it('getCurrentStep() replays current value on new subscription', (done) => {
    service.startTutorial();

    service.getCurrentStep().subscribe(step => {
      expect(step).toBe(TutorialStep.WELCOME);
      done();
    });
  });
});
