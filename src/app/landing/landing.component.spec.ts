import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LandingComponent } from './landing.component';
import { RunPersistenceService } from '../run/services/run-persistence.service';
import { RunService } from '../run/services/run.service';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;
  let router: jasmine.SpyObj<Router>;
  let runPersistence: jasmine.SpyObj<RunPersistenceService>;
  let runService: jasmine.SpyObj<RunService>;

  beforeEach(async () => {
    router = jasmine.createSpyObj('Router', ['navigate']);
    runPersistence = jasmine.createSpyObj('RunPersistenceService', [
      'hasSavedRun',
      'clearSavedRun',
      'getMaxAscension',
      'isAscensionMastered',
    ]);
    runPersistence.hasSavedRun.and.returnValue(false);
    runPersistence.getMaxAscension.and.returnValue(0);
    runPersistence.isAscensionMastered.and.returnValue(false);
    runService = jasmine.createSpyObj('RunService', ['startNewRun', 'resumeRun']);

    await TestBed.configureTestingModule({
      declarations: [LandingComponent],
      imports: [CommonModule],
      providers: [
        { provide: Router, useValue: router },
        { provide: RunPersistenceService, useValue: runPersistence },
        { provide: RunService, useValue: runService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the game title', () => {
    const title = fixture.nativeElement.querySelector('.landing-title');
    expect(title.textContent).toContain('NOVARISE');
  });

  it('should render the roguelite subtitle', () => {
    const subtitle = fixture.nativeElement.querySelector('.landing-subtitle');
    expect(subtitle.textContent).toContain('Roguelite');
  });

  describe('no saved run (fresh install)', () => {
    beforeEach(() => {
      runPersistence.hasSavedRun.and.returnValue(false);
      component.ngOnInit();
      fixture.detectChanges();
    });

    it('hasSavedRun is false', () => {
      expect(component.hasSavedRun).toBeFalse();
    });

    it('does not render Continue Run button', () => {
      const buttons = Array.from(fixture.nativeElement.querySelectorAll('.landing-btn')) as HTMLElement[];
      const continueBtn = buttons.find(b => b.textContent?.includes('Continue'));
      expect(continueBtn).toBeUndefined();
    });

    it('Start Run button is primary (no saved run to continue)', () => {
      const buttons = Array.from(fixture.nativeElement.querySelectorAll('.landing-btn')) as HTMLElement[];
      const startBtn = buttons.find(b => b.textContent?.includes('Start Run'));
      expect(startBtn).toBeDefined();
      expect(startBtn?.classList.contains('landing-btn--primary')).toBeTrue();
    });
  });

  describe('saved run exists', () => {
    beforeEach(() => {
      runPersistence.hasSavedRun.and.returnValue(true);
      component.ngOnInit();
      fixture.detectChanges();
    });

    it('hasSavedRun is true', () => {
      expect(component.hasSavedRun).toBeTrue();
    });

    it('renders Continue Run button as primary', () => {
      const buttons = Array.from(fixture.nativeElement.querySelectorAll('.landing-btn')) as HTMLElement[];
      const continueBtn = buttons.find(b => b.textContent?.includes('Continue'));
      expect(continueBtn).toBeDefined();
      expect(continueBtn?.classList.contains('landing-btn--primary')).toBeTrue();
    });

    it('Start Run button label switches to "Start New Run"', () => {
      const buttons = Array.from(fixture.nativeElement.querySelectorAll('.landing-btn')) as HTMLElement[];
      const startBtn = buttons.find(b => b.textContent?.includes('Start New Run'));
      expect(startBtn).toBeDefined();
    });
  });

  describe('actions', () => {
    it('startNewRun clears saved run, initializes run, and navigates to /run', () => {
      component.startNewRun();
      expect(runPersistence.clearSavedRun).toHaveBeenCalled();
      expect(runService.startNewRun).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/run']);
    });

    it('startNewRun passes selectedAscension to runService.startNewRun', () => {
      component.maxAscension = 5;
      component.selectedAscension = 3;
      component.startNewRun();
      expect(runService.startNewRun).toHaveBeenCalledWith(3);
    });

    it('continueRun navigates to /run when a saved run exists', () => {
      component.hasSavedRun = true;
      component.continueRun();
      expect(router.navigate).toHaveBeenCalledWith(['/run']);
    });

    it('continueRun is a no-op when no saved run exists', () => {
      component.hasSavedRun = false;
      component.continueRun();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('goToEditor navigates to /edit', () => {
      component.goToEditor();
      expect(router.navigate).toHaveBeenCalledWith(['/edit']);
    });
  });

  describe('ascension stepper', () => {
    beforeEach(() => {
      runPersistence.getMaxAscension.and.returnValue(10);
      component.ngOnInit();
    });

    it('defaults selectedAscension to maxAscension on init', () => {
      expect(component.selectedAscension).toBe(10);
    });

    it('stepAscension(1) increments when below maxAscension', () => {
      component.selectedAscension = 5;
      component.stepAscension(1);
      expect(component.selectedAscension).toBe(6);
    });

    it('stepAscension(1) clamps at maxAscension', () => {
      component.selectedAscension = 10;
      component.stepAscension(1);
      expect(component.selectedAscension).toBe(10);
    });

    it('stepAscension(-1) decrements when above 0', () => {
      component.selectedAscension = 5;
      component.stepAscension(-1);
      expect(component.selectedAscension).toBe(4);
    });

    it('stepAscension(-1) clamps at 0', () => {
      component.selectedAscension = 0;
      component.stepAscension(-1);
      expect(component.selectedAscension).toBe(0);
    });
  });

  describe('getAscensionPreview()', () => {
    it('returns null at A0', () => {
      component.selectedAscension = 0;
      expect(component.getAscensionPreview()).toBeNull();
    });

    it('returns a string containing A3 description at A3', () => {
      component.selectedAscension = 3;
      const preview = component.getAscensionPreview();
      expect(preview).toBe('A3: Start with 20 less gold');
    });

    it('returns a string containing A18 description at A18', () => {
      component.selectedAscension = 18;
      const preview = component.getAscensionPreview();
      expect(preview).toBe('A18: Elite enemies have 50% more health');
    });
  });

  describe('isAscensionMastered', () => {
    it('delegates to runPersistence.isAscensionMastered()', () => {
      runPersistence.isAscensionMastered.and.returnValue(true);
      expect(component.isAscensionMastered).toBeTrue();
    });

    it('returns false when not mastered', () => {
      runPersistence.isAscensionMastered.and.returnValue(false);
      expect(component.isAscensionMastered).toBeFalse();
    });
  });
});
