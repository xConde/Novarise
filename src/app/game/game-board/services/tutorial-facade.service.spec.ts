import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { TutorialFacadeService } from './tutorial-facade.service';
import { TutorialService, TutorialStep, TutorialTip } from '../../../core/services/tutorial.service';

describe('TutorialFacadeService', () => {
  let service: TutorialFacadeService;
  let tutorialService: jasmine.SpyObj<TutorialService>;
  let stepSubject: BehaviorSubject<TutorialStep | null>;

  beforeEach(() => {
    stepSubject = new BehaviorSubject<TutorialStep | null>(null);

    tutorialService = jasmine.createSpyObj('TutorialService', [
      'getCurrentStep',
      'getTip',
      'advanceStep',
      'skipTutorial',
    ]);
    tutorialService.getCurrentStep.and.returnValue(stepSubject.asObservable());
    tutorialService.getTip.and.returnValue(null as unknown as TutorialTip);

    TestBed.configureTestingModule({
      providers: [
        TutorialFacadeService,
        { provide: TutorialService, useValue: tutorialService },
      ],
    });
    service = TestBed.inject(TutorialFacadeService);
  });

  afterEach(() => {
    service.cleanup();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initial state', () => {
    it('currentTutorialStep is null before init', () => {
      expect(service.currentTutorialStep).toBeNull();
    });
  });

  describe('init()', () => {
    it('subscribes to tutorial step stream and updates currentTutorialStep', () => {
      service.init();
      stepSubject.next(TutorialStep.WELCOME);
      expect(service.currentTutorialStep).toBe(TutorialStep.WELCOME);
    });

    it('updates currentTutorialStep when step changes', () => {
      service.init();
      stepSubject.next(TutorialStep.PLACE_TOWER);
      expect(service.currentTutorialStep).toBe(TutorialStep.PLACE_TOWER);
      stepSubject.next(TutorialStep.START_WAVE);
      expect(service.currentTutorialStep).toBe(TutorialStep.START_WAVE);
    });
  });

  describe('cleanup()', () => {
    it('stops tracking step changes after cleanup', () => {
      service.init();
      stepSubject.next(TutorialStep.WELCOME);
      service.cleanup();
      stepSubject.next(TutorialStep.SELECT_TOWER);
      // Step should not have updated after cleanup
      expect(service.currentTutorialStep).toBe(TutorialStep.WELCOME);
    });

    it('is safe to call multiple times', () => {
      service.init();
      service.cleanup();
      expect(() => service.cleanup()).not.toThrow();
    });
  });

  describe('getTutorialTip()', () => {
    it('returns null when currentTutorialStep is null', () => {
      expect(service.getTutorialTip()).toBeNull();
    });

    it('delegates to tutorialService.getTip() when step is set', () => {
      const mockTip = { title: 'Test', message: 'Body' } as unknown as TutorialTip;
      tutorialService.getTip.and.returnValue(mockTip);
      service.init();
      stepSubject.next(TutorialStep.WELCOME);
      expect(service.getTutorialTip()).toBe(mockTip);
      expect(tutorialService.getTip).toHaveBeenCalledWith(TutorialStep.WELCOME);
    });
  });

  describe('getTutorialStepNumber()', () => {
    it('returns 0 when step is null', () => {
      expect(service.getTutorialStepNumber()).toBe(0);
    });

    it('returns correct index for a tutorial step', () => {
      service.init();
      // WELCOME is index 0 in tutorialDisplaySteps → returns max(1, 0+1) = 1
      stepSubject.next(TutorialStep.WELCOME);
      expect(service.getTutorialStepNumber()).toBe(1);
    });

    it('returns correct index for PLACE_TOWER (index 2 → step 3)', () => {
      service.init();
      stepSubject.next(TutorialStep.PLACE_TOWER);
      // tutorialDisplaySteps: [WELCOME(0), SELECT_TOWER(1), PLACE_TOWER(2), ...]
      expect(service.getTutorialStepNumber()).toBe(3);
    });

    it('returns tip index + 1 for tip steps', () => {
      service.init();
      // TIP_PLACEMENT is index 0 in tipsDisplaySteps → returns 0+1 = 1
      stepSubject.next(TutorialStep.TIP_PLACEMENT);
      expect(service.getTutorialStepNumber()).toBe(1);
    });
  });

  describe('getTutorialTotalSteps()', () => {
    it('returns 0 when step is null', () => {
      expect(service.getTutorialTotalSteps()).toBe(0);
    });

    it('returns tutorialDisplaySteps.length for tutorial steps', () => {
      service.init();
      stepSubject.next(TutorialStep.WELCOME);
      // tutorialDisplaySteps has 6 entries
      expect(service.getTutorialTotalSteps()).toBe(6);
    });

    it('returns tipsDisplaySteps.length for tip steps', () => {
      service.init();
      stepSubject.next(TutorialStep.TIP_PLACEMENT);
      // tipsDisplaySteps has 3 entries
      expect(service.getTutorialTotalSteps()).toBe(3);
    });
  });

  describe('advanceTutorial()', () => {
    it('delegates to tutorialService.advanceStep()', () => {
      service.advanceTutorial();
      expect(tutorialService.advanceStep).toHaveBeenCalled();
    });
  });

  describe('skipTutorial()', () => {
    it('delegates to tutorialService.skipTutorial()', () => {
      service.skipTutorial();
      expect(tutorialService.skipTutorial).toHaveBeenCalled();
    });
  });
});
