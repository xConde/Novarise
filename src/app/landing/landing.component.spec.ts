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
    ]);
    runPersistence.hasSavedRun.and.returnValue(false);
    runService = jasmine.createSpyObj('RunService', ['startNewRun']);

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
});
