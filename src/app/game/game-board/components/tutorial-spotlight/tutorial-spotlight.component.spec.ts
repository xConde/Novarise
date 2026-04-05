import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { SimpleChange } from '@angular/core';
import { TutorialSpotlightComponent } from './tutorial-spotlight.component';
import { TutorialStep, TutorialTip } from '../../../../core/services/tutorial.service';

function makeTip(overrides: Partial<TutorialTip> = {}): TutorialTip {
  return {
    id: TutorialStep.WELCOME,
    step: TutorialStep.WELCOME,
    type: 'tutorial',
    title: 'Test Title',
    message: 'Test message.',
    position: 'center',
    ...overrides,
  };
}

function makeTipStep(overrides: Partial<TutorialTip> = {}): TutorialTip {
  return {
    id: TutorialStep.TIP_PLACEMENT,
    step: TutorialStep.TIP_PLACEMENT,
    type: 'tip',
    title: 'Strategy Tip Title',
    message: 'Strategy tip message.',
    position: 'center',
    ...overrides,
  };
}

describe('TutorialSpotlightComponent', () => {
  let component: TutorialSpotlightComponent;
  let fixture: ComponentFixture<TutorialSpotlightComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TutorialSpotlightComponent],
      imports: [CommonModule],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TutorialSpotlightComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    // Clean up any highlight classes left on the DOM
    document.querySelectorAll('.tutorial-target-highlight').forEach(el =>
      el.classList.remove('tutorial-target-highlight')
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('rendering', () => {
    it('should show the tutorial card when step is set', () => {
      component.step = TutorialStep.WELCOME;
      component.tip = makeTip();
      component.stepNumber = 1;
      component.totalSteps = 5;
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.tutorial-card');
      expect(card).toBeTruthy();
    });

    it('should not render when step is null', () => {
      component.step = null;
      fixture.detectChanges();

      const spotlight = fixture.nativeElement.querySelector('.tutorial-spotlight');
      expect(spotlight).toBeNull();
    });

    it('should apply step-specific CSS class to the card', () => {
      component.step = TutorialStep.SELECT_TOWER;
      component.tip = makeTip({ step: TutorialStep.SELECT_TOWER });
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.tutorial-card');
      expect(card.classList.contains('tutorial-card--select_tower')).toBeTrue();
    });

    it('should display tip title and message', () => {
      component.step = TutorialStep.WELCOME;
      component.tip = makeTip({ title: 'Hello World', message: 'Welcome!' });
      fixture.detectChanges();

      const title = fixture.nativeElement.querySelector('.tutorial-card__title');
      const message = fixture.nativeElement.querySelector('.tutorial-card__message');
      expect(title.textContent).toContain('Hello World');
      expect(message.textContent).toContain('Welcome!');
    });

    it('should display step indicator', () => {
      component.step = TutorialStep.PLACE_TOWER;
      component.tip = makeTip();
      component.stepNumber = 3;
      component.totalSteps = 5;
      fixture.detectChanges();

      const indicator = fixture.nativeElement.querySelector('.tutorial-card__step-indicator');
      expect(indicator.textContent.trim()).toBe('3/5');
    });

    it('should show "Done" on Next button when stepNumber equals totalSteps', () => {
      component.step = TutorialStep.COMPLETE;
      component.tip = makeTip({ step: TutorialStep.COMPLETE });
      component.stepNumber = 6;
      component.totalSteps = 6;
      fixture.detectChanges();

      const nextBtn = fixture.nativeElement.querySelector('.tutorial-card__btn--next');
      expect(nextBtn.textContent.trim()).toBe('Done');
    });

    it('should show "Next" on Next button when stepNumber is less than totalSteps', () => {
      component.step = TutorialStep.WELCOME;
      component.tip = makeTip();
      component.stepNumber = 1;
      component.totalSteps = 6;
      fixture.detectChanges();

      const nextBtn = fixture.nativeElement.querySelector('.tutorial-card__btn--next');
      expect(nextBtn.textContent.trim()).toBe('Next');
    });

    it('should show "Done" on last tip step when stepNumber equals totalSteps', () => {
      component.step = TutorialStep.TIP_UPGRADE;
      component.tip = makeTipStep({ step: TutorialStep.TIP_UPGRADE });
      component.stepNumber = 3;
      component.totalSteps = 3;
      fixture.detectChanges();

      const nextBtn = fixture.nativeElement.querySelector('.tutorial-card__btn--next');
      expect(nextBtn.textContent.trim()).toBe('Done');
    });

    it('should show type label "Tutorial" for tutorial steps', () => {
      component.step = TutorialStep.WELCOME;
      component.tip = makeTip();
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('.tutorial-card__type-label');
      expect(label.textContent.trim()).toBe('Tutorial');
    });

    it('should show type label "Strategy Tip" for tip steps', () => {
      component.step = TutorialStep.TIP_PLACEMENT;
      component.tip = makeTipStep();
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('.tutorial-card__type-label');
      expect(label.textContent.trim()).toBe('Strategy Tip');
    });

    it('should apply tutorial-card--is-tip class for tip steps', () => {
      component.step = TutorialStep.TIP_PLACEMENT;
      component.tip = makeTipStep();
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.tutorial-card');
      expect(card.classList.contains('tutorial-card--is-tip')).toBeTrue();
    });

    it('should not apply tutorial-card--is-tip class for tutorial steps', () => {
      component.step = TutorialStep.WELCOME;
      component.tip = makeTip();
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.tutorial-card');
      expect(card.classList.contains('tutorial-card--is-tip')).toBeFalse();
    });
  });

  describe('outputs', () => {
    beforeEach(() => {
      component.step = TutorialStep.WELCOME;
      component.tip = makeTip();
      fixture.detectChanges();
    });

    it('should emit advance when Next button is clicked', () => {
      let emitted = false;
      component.advance.subscribe(() => (emitted = true));

      const nextBtn = fixture.nativeElement.querySelector('.tutorial-card__btn--next');
      nextBtn.click();

      expect(emitted).toBeTrue();
    });

    it('should emit skip when Skip button is clicked', () => {
      let emitted = false;
      component.skip.subscribe(() => (emitted = true));

      const skipBtn = fixture.nativeElement.querySelector('.tutorial-card__btn--skip');
      skipBtn.click();

      expect(emitted).toBeTrue();
    });
  });

  describe('isLastStep', () => {
    it('returns true when stepNumber equals totalSteps', () => {
      component.stepNumber = 6;
      component.totalSteps = 6;
      expect(component.isLastStep).toBeTrue();
    });

    it('returns false when stepNumber is less than totalSteps', () => {
      component.stepNumber = 3;
      component.totalSteps = 6;
      expect(component.isLastStep).toBeFalse();
    });

    it('returns true for last tip step (3/3)', () => {
      component.stepNumber = 3;
      component.totalSteps = 3;
      expect(component.isLastStep).toBeTrue();
    });

    it('returns false for first tip step (1/3)', () => {
      component.stepNumber = 1;
      component.totalSteps = 3;
      expect(component.isLastStep).toBeFalse();
    });
  });

  describe('highlight management', () => {
    it('should apply tutorial-target-highlight class when tip has targetSelector', () => {
      const mockEl = document.createElement('div');
      mockEl.className = 'tower-selection';
      document.body.appendChild(mockEl);

      try {
        component.step = TutorialStep.SELECT_TOWER;
        component.tip = makeTip({ targetSelector: '.tower-selection' });
        component.ngOnChanges({
          tip: new SimpleChange(null, component.tip, true),
        });

        expect(mockEl.classList.contains('tutorial-target-highlight')).toBeTrue();
      } finally {
        document.body.removeChild(mockEl);
      }
    });

    it('should not throw when tip has no targetSelector', () => {
      component.tip = makeTip();
      expect(() =>
        component.ngOnChanges({ tip: new SimpleChange(null, component.tip, true) })
      ).not.toThrow();
    });

    it('should remove previous highlight before applying new one', () => {
      const prevEl = document.createElement('div');
      prevEl.classList.add('tutorial-target-highlight');
      document.body.appendChild(prevEl);

      try {
        component.tip = makeTip(); // no targetSelector
        component.ngOnChanges({
          tip: new SimpleChange(null, component.tip, false),
        });

        expect(prevEl.classList.contains('tutorial-target-highlight')).toBeFalse();
      } finally {
        if (prevEl.parentNode) {
          document.body.removeChild(prevEl);
        }
      }
    });

    it('should remove highlight from multiple elements when tip changes', () => {
      const el1 = document.createElement('div');
      el1.classList.add('tutorial-target-highlight');
      const el2 = document.createElement('div');
      el2.classList.add('tutorial-target-highlight');
      document.body.appendChild(el1);
      document.body.appendChild(el2);

      try {
        component.tip = makeTip(); // no targetSelector
        component.ngOnChanges({
          tip: new SimpleChange(null, component.tip, false),
        });

        expect(el1.classList.contains('tutorial-target-highlight')).toBeFalse();
        expect(el2.classList.contains('tutorial-target-highlight')).toBeFalse();
      } finally {
        if (el1.parentNode) document.body.removeChild(el1);
        if (el2.parentNode) document.body.removeChild(el2);
      }
    });

    it('should remove highlight on destroy', () => {
      const mockEl = document.createElement('div');
      mockEl.classList.add('tutorial-target-highlight');
      document.body.appendChild(mockEl);

      try {
        component.ngOnDestroy();
        expect(mockEl.classList.contains('tutorial-target-highlight')).toBeFalse();
      } finally {
        if (mockEl.parentNode) {
          document.body.removeChild(mockEl);
        }
      }
    });

    it('should not apply highlight when tip changes to null', () => {
      const mockEl = document.createElement('div');
      mockEl.classList.add('tutorial-target-highlight');
      document.body.appendChild(mockEl);

      try {
        component.tip = null;
        component.ngOnChanges({
          tip: new SimpleChange(makeTip(), null, false),
        });

        expect(mockEl.classList.contains('tutorial-target-highlight')).toBeFalse();
      } finally {
        if (mockEl.parentNode) {
          document.body.removeChild(mockEl);
        }
      }
    });
  });
});
