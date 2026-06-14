import { TutorialService, TutorialStep, TutorialTip } from './tutorial.service';
import { StorageService } from './storage.service';

const STORAGE_KEY = 'novarise-tutorial';

describe('TutorialService', () => {
  let service: TutorialService;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    service = new TutorialService(new StorageService());
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
    service.advanceStep(); // WELCOME → SELECT_TOWER (Your Hand & Energy)
    service.advanceStep(); // SELECT_TOWER → PLACE_TOWER (Play a Tower Card)
    service.advanceStep(); // PLACE_TOWER → START_WAVE (Know What's Coming)
    service.advanceStep(); // START_WAVE → END_TURN (End Your Turn)
    service.advanceStep(); // END_TURN → COMPLETE

    sub.unsubscribe();

    expect(emitted).toContain(TutorialStep.SELECT_TOWER);
    expect(emitted).toContain(TutorialStep.PLACE_TOWER);
    expect(emitted).toContain(TutorialStep.START_WAVE);
    expect(emitted).toContain(TutorialStep.END_TURN);
    expect(emitted).toContain(TutorialStep.COMPLETE);
  });

  it('after advancing past COMPLETE, current step becomes null', () => {
    const emitted: Array<TutorialStep | null> = [];
    const sub = service.getCurrentStep().subscribe(s => emitted.push(s));

    service.startTutorial();
    // Advance through all steps:
    // WELCOME → SELECT_TOWER → PLACE_TOWER → START_WAVE → END_TURN → COMPLETE → null
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
    service.advanceStep(); // → SELECT_TOWER
    service.advanceStep(); // → PLACE_TOWER
    service.advanceStep(); // → START_WAVE
    service.advanceStep(); // → END_TURN
    service.advanceStep(); // → COMPLETE
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

  it('skipTutorial() during controls tutorial also marks tips complete', () => {
    service.startTutorial();
    service.skipTutorial();
    expect(service.isTipsComplete()).toBeTrue();
  });

  it('skipTutorial() sets current step to null', (done) => {
    service.startTutorial();
    service.skipTutorial();
    service.getCurrentStep().subscribe(step => {
      expect(step).toBeNull();
      done();
    });
  });

  it('startTips() is a no-op after skipping the controls tutorial', () => {
    service.startTutorial();
    service.skipTutorial();
    // Simulate having played enough encounters to pass the tips gate
    service.incrementGamesPlayed();

    service.startTips();

    service.getCurrentStep().subscribe(step => {
      expect(step).toBeNull();
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
    // Step covers hand + energy + gold dual-cost
    expect(tip.title).toContain('Hand');
  });

  it('SELECT_TOWER step mentions gold cost', () => {
    const tip: TutorialTip = service.getTip(TutorialStep.SELECT_TOWER);
    expect(tip.message.toLowerCase()).toContain('gold');
  });

  it('getTip() returns correct tip for PLACE_TOWER step', () => {
    const tip: TutorialTip = service.getTip(TutorialStep.PLACE_TOWER);
    expect(tip.step).toBe(TutorialStep.PLACE_TOWER);
  });

  it('getTip() returns correct tip for START_WAVE step', () => {
    const tip: TutorialTip = service.getTip(TutorialStep.START_WAVE);
    expect(tip.step).toBe(TutorialStep.START_WAVE);
  });

  it('getTip() returns correct tip for END_TURN step', () => {
    const tip: TutorialTip = service.getTip(TutorialStep.END_TURN);
    expect(tip.step).toBe(TutorialStep.END_TURN);
    expect(tip.title).toContain('End Your Turn');
    expect(tip.targetSelector).toBe('.end-turn-btn');
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

    const fresh = new TutorialService(new StorageService());
    expect(fresh.isTutorialComplete()).toBeTrue();
  });

  // --- Corrupted localStorage ---

  it('handles corrupted localStorage gracefully — returns empty set', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json{{');
    const fresh = new TutorialService(new StorageService());
    expect(fresh.isTutorialComplete()).toBeFalse();
  });

  it('handles localStorage with wrong shape gracefully', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seenSteps: 'not-an-array' }));
    const fresh = new TutorialService(new StorageService());
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

  // --- resetCurrentStep (S12) ---

  describe('resetCurrentStep', () => {
    it('sets current step to null without clearing completion state', (done) => {
      // Advance through all steps to complete the tutorial
      service.startTutorial();
      service.skipTutorial(); // marks complete
      expect(service.isTutorialComplete()).toBeTrue();

      // Now simulate a new game session: step should reset to null
      service.resetCurrentStep();

      service.getCurrentStep().subscribe(step => {
        expect(step).toBeNull();
        done();
      });
    });

    it('completion state is preserved after resetCurrentStep', () => {
      service.startTutorial();
      service.skipTutorial();
      expect(service.isTutorialComplete()).toBeTrue();

      service.resetCurrentStep();

      expect(service.isTutorialComplete()).toBeTrue();
    });

    it('resets an in-progress step to null', (done) => {
      service.startTutorial(); // step = WELCOME

      service.resetCurrentStep();

      service.getCurrentStep().subscribe(step => {
        expect(step).toBeNull();
        done();
      });
    });

    it('is a no-op when already null', (done) => {
      // currentStep starts null — calling resetCurrentStep should leave it null
      service.resetCurrentStep();

      service.getCurrentStep().subscribe(step => {
        expect(step).toBeNull();
        done();
      });
    });
  });

  // --- Strategy tips (S25) ---

  describe('strategy tips', () => {
    /** Helper: complete the controls tutorial. */
    function completeControlsTutorial(svc: TutorialService): void {
      svc.startTutorial();
      svc.advanceStep(); // WELCOME → SELECT_TOWER (Your Hand & Energy)
      svc.advanceStep(); // SELECT_TOWER → PLACE_TOWER (Play a Tower Card)
      svc.advanceStep(); // PLACE_TOWER → START_WAVE (Know What's Coming)
      svc.advanceStep(); // START_WAVE → END_TURN (End Your Turn)
      svc.advanceStep(); // END_TURN → COMPLETE
      svc.advanceStep(); // COMPLETE → null + tutorialComplete
    }

    // --- isTipsComplete ---

    it('isTipsComplete() returns false initially', () => {
      expect(service.isTipsComplete()).toBeFalse();
    });

    // --- tip step enum values exist ---

    it('TIP_PLACEMENT step has type "tip"', () => {
      const tip = service.getTip(TutorialStep.TIP_PLACEMENT);
      expect(tip.type).toBe('tip');
    });

    it('TIP_WAVE_PREVIEW step has type "tip"', () => {
      const tip = service.getTip(TutorialStep.TIP_WAVE_PREVIEW);
      expect(tip.type).toBe('tip');
    });

    it('TIP_UPGRADE step has type "tip"', () => {
      const tip = service.getTip(TutorialStep.TIP_UPGRADE);
      expect(tip.type).toBe('tip');
    });

    it('controls tutorial steps have type "tutorial"', () => {
      expect(service.getTip(TutorialStep.WELCOME).type).toBe('tutorial');
      expect(service.getTip(TutorialStep.COMPLETE).type).toBe('tutorial');
    });

    // --- tip messages are populated ---

    it('TIP_PLACEMENT has a non-empty message about bends or chokepoints', () => {
      const tip = service.getTip(TutorialStep.TIP_PLACEMENT);
      expect(tip.message).toBeTruthy();
      expect(tip.title).toBeTruthy();
    });

    it('TIP_WAVE_PREVIEW has a non-empty message about deck piles', () => {
      const tip = service.getTip(TutorialStep.TIP_WAVE_PREVIEW);
      expect(tip.message).toBeTruthy();
      expect(tip.title).toBeTruthy();
    });

    it('TIP_UPGRADE has a non-empty message about archetypes or upgrades', () => {
      const tip = service.getTip(TutorialStep.TIP_UPGRADE);
      expect(tip.message).toBeTruthy();
      expect(tip.title).toBeTruthy();
    });

    // --- startTips() gating ---

    it('startTips() is a no-op on first encounter (gamesPlayed = 0)', () => {
      completeControlsTutorial(service);
      // gamesPlayed = 0 — first encounter, tips must not appear yet

      service.startTips();

      service.getCurrentStep().subscribe(step => {
        expect(step).toBeNull();
      });
    });

    it('startTips() is a no-op when tutorial is not complete', () => {
      // gamesPlayed = 2 but tutorial not done
      service.incrementGamesPlayed();
      service.incrementGamesPlayed();

      service.startTips();

      service.getCurrentStep().subscribe(step => {
        expect(step).toBeNull();
      });
    });

    it('startTips() starts TIP_PLACEMENT on second encounter (gamesPlayed = 1)', (done) => {
      completeControlsTutorial(service);
      service.incrementGamesPlayed(); // gamesPlayed = 1 → second encounter

      service.startTips();

      service.getCurrentStep().subscribe(step => {
        expect(step).toBe(TutorialStep.TIP_PLACEMENT);
        done();
      });
    });

    it('startTips() is a no-op when tips are already complete', () => {
      completeControlsTutorial(service);
      service.incrementGamesPlayed();
      service.incrementGamesPlayed();
      service.startTips();
      service.skipTutorial(); // skips tips — marks tipsComplete

      expect(service.isTipsComplete()).toBeTrue();

      service.startTips(); // should not restart

      service.getCurrentStep().subscribe(step => {
        expect(step).toBeNull();
      });
    });

    // --- tip step progression ---

    it('advanceStep() progresses through tip steps in order', () => {
      completeControlsTutorial(service);
      service.incrementGamesPlayed();
      service.incrementGamesPlayed();
      service.startTips();

      const emitted: Array<TutorialStep | null> = [];
      const sub = service.getCurrentStep().subscribe(s => emitted.push(s));

      service.advanceStep(); // TIP_PLACEMENT → TIP_WAVE_PREVIEW
      service.advanceStep(); // TIP_WAVE_PREVIEW → TIP_UPGRADE
      sub.unsubscribe();

      expect(emitted).toContain(TutorialStep.TIP_WAVE_PREVIEW);
      expect(emitted).toContain(TutorialStep.TIP_UPGRADE);
    });

    it('advancing past TIP_UPGRADE emits null and marks tips complete', () => {
      completeControlsTutorial(service);
      service.incrementGamesPlayed();
      service.incrementGamesPlayed();
      service.startTips();

      service.advanceStep(); // TIP_PLACEMENT → TIP_WAVE_PREVIEW
      service.advanceStep(); // TIP_WAVE_PREVIEW → TIP_UPGRADE
      service.advanceStep(); // TIP_UPGRADE → null + tipsComplete

      expect(service.isTipsComplete()).toBeTrue();
    });

    it('advancing past TIP_UPGRADE emits null', () => {
      completeControlsTutorial(service);
      service.incrementGamesPlayed();
      service.incrementGamesPlayed();
      service.startTips();

      service.advanceStep();
      service.advanceStep();
      service.advanceStep();

      service.getCurrentStep().subscribe(step => {
        expect(step).toBeNull();
      });
    });

    // --- skipTutorial() during tips ---

    it('skipTutorial() during tips marks tips complete', () => {
      completeControlsTutorial(service);
      service.incrementGamesPlayed();
      service.incrementGamesPlayed();
      service.startTips();

      service.skipTutorial();

      expect(service.isTipsComplete()).toBeTrue();
    });

    it('skipTutorial() during tips does not change isTutorialComplete()', () => {
      completeControlsTutorial(service);
      service.incrementGamesPlayed();
      service.incrementGamesPlayed();
      service.startTips();
      expect(service.isTutorialComplete()).toBeTrue();

      service.skipTutorial();

      expect(service.isTutorialComplete()).toBeTrue();
    });

    it('skipTutorial() during tips sets current step to null', (done) => {
      completeControlsTutorial(service);
      service.incrementGamesPlayed();
      service.incrementGamesPlayed();
      service.startTips();

      service.skipTutorial();

      service.getCurrentStep().subscribe(step => {
        expect(step).toBeNull();
        done();
      });
    });

    // --- isTutorialComplete vs isTipsComplete independence ---

    it('completing controls tutorial does not mark tips complete', () => {
      completeControlsTutorial(service);
      expect(service.isTutorialComplete()).toBeTrue();
      expect(service.isTipsComplete()).toBeFalse();
    });

    // --- incrementGamesPlayed ---

    it('incrementGamesPlayed() persists gamesPlayed to localStorage', () => {
      service.incrementGamesPlayed();
      service.incrementGamesPlayed();

      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!) as { gamesPlayed: number };
      expect(parsed.gamesPlayed).toBe(2);
    });

    it('gamesPlayed is restored from localStorage on construction', () => {
      const data = {
        seenSteps: [TutorialStep.COMPLETE],
        tipsComplete: false,
        gamesPlayed: 3,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      const fresh = new TutorialService(new StorageService());
      // 3 games already played + tutorial complete → startTips() should work
      fresh.startTips();
      fresh.getCurrentStep().subscribe(step => {
        expect(step).toBe(TutorialStep.TIP_PLACEMENT);
      });
    });

    // --- tips complete persistence ---

    it('tipsComplete is persisted after completing tips', () => {
      completeControlsTutorial(service);
      service.incrementGamesPlayed();
      service.incrementGamesPlayed();
      service.startTips();
      service.advanceStep();
      service.advanceStep();
      service.advanceStep();

      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(raw!) as { tipsComplete: boolean };
      expect(parsed.tipsComplete).toBeTrue();
    });

    it('tipsComplete is loaded from localStorage on construction', () => {
      const data = {
        seenSteps: [TutorialStep.COMPLETE],
        tipsComplete: true,
        gamesPlayed: 5,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      const fresh = new TutorialService(new StorageService());
      expect(fresh.isTipsComplete()).toBeTrue();
    });

    // --- resetTutorial() clears tips state ---

    it('resetTutorial() resets isTipsComplete to false', () => {
      completeControlsTutorial(service);
      service.incrementGamesPlayed();
      service.incrementGamesPlayed();
      service.startTips();
      service.skipTutorial();
      expect(service.isTipsComplete()).toBeTrue();

      service.resetTutorial();

      expect(service.isTipsComplete()).toBeFalse();
    });

    // --- legacy storage without new fields ---

    it('handles legacy storage without gamesPlayed — defaults to 0', () => {
      const data = { seenSteps: [TutorialStep.COMPLETE] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      const fresh = new TutorialService(new StorageService());
      // gamesPlayed=0, so startTips() should be a no-op
      fresh.startTips();
      fresh.getCurrentStep().subscribe(step => {
        expect(step).toBeNull();
      });
    });

    it('handles legacy storage without tipsComplete — defaults to false', () => {
      const data = { seenSteps: [TutorialStep.COMPLETE], gamesPlayed: 5 };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      const fresh = new TutorialService(new StorageService());
      expect(fresh.isTipsComplete()).toBeFalse();
    });
  });

  // ── dismissOnPlayerAction (Phase 14) ───────────────────────────────────

  describe('dismissOnPlayerAction', () => {
    it('is a no-op when no step is active', () => {
      service.dismissOnPlayerAction();
      service.getCurrentStep().subscribe(step => {
        expect(step).toBeNull();
      });
    });

    it('advances past WELCOME when the player takes any action', () => {
      service.startTutorial();
      service.dismissOnPlayerAction();

      service.getCurrentStep().subscribe(step => {
        expect(step).toBe(TutorialStep.SELECT_TOWER);
      });
    });

    it('completes the tutorial when dismissed on the COMPLETE step', () => {
      service.startTutorial();
      service.advanceStep(); // WELCOME → SELECT_TOWER (Your Hand & Energy)
      service.advanceStep(); // SELECT_TOWER → PLACE_TOWER (Play a Tower Card)
      service.advanceStep(); // PLACE_TOWER → START_WAVE (Know What's Coming)
      service.advanceStep(); // START_WAVE → END_TURN (End Your Turn)
      service.advanceStep(); // END_TURN → COMPLETE

      service.dismissOnPlayerAction(); // COMPLETE → null + marks done

      service.getCurrentStep().subscribe(step => {
        expect(step).toBeNull();
      });
      expect(service.isTutorialComplete()).toBeTrue();
    });

    it('advances tip steps the same way as tutorial steps', () => {
      const data = {
        seenSteps: [TutorialStep.COMPLETE],
        tipsComplete: false,
        gamesPlayed: 3,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      const fresh = new TutorialService(new StorageService());
      fresh.startTips();

      fresh.dismissOnPlayerAction(); // TIP_PLACEMENT → TIP_WAVE_PREVIEW

      fresh.getCurrentStep().subscribe(step => {
        expect(step).toBe(TutorialStep.TIP_WAVE_PREVIEW);
      });
    });
  });

  describe('SELECT_TOWER tip content', () => {
    it('SELECT_TOWER message mentions that gold does not reset between encounters', () => {
      const tip = service.getTip(TutorialStep.SELECT_TOWER);
      // The message should explain run-persistent gold so new players understand
      // the unified gold model (gold carries forward into shops, rest sites, next fight).
      expect(tip.message).toContain('does NOT reset between encounters');
    });

    it('SELECT_TOWER tip targets the energy UI element', () => {
      const tip = service.getTip(TutorialStep.SELECT_TOWER);
      expect(tip.targetSelector).toBe('.card-hand__energy');
    });
  });
});
