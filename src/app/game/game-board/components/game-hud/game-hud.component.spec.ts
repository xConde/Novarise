import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { SimpleChange } from '@angular/core';
import { GameHudComponent, ChallengeIndicator } from './game-hud.component';

describe('GameHudComponent', () => {
  let component: GameHudComponent;
  let fixture: ComponentFixture<GameHudComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GameHudComponent],
      imports: [CommonModule],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GameHudComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('stat rendering', () => {
    it('should display the lives value', () => {
      component.lives = 7;
      fixture.detectChanges();

      const livesEl = fixture.nativeElement.querySelector('.hud-value.lives');
      expect(livesEl.textContent.trim()).toBe('7');
    });

    it('should display the gold value', () => {
      component.gold = 150;
      fixture.detectChanges();

      const goldEl = fixture.nativeElement.querySelector('.hud-value.gold');
      expect(goldEl.textContent.trim()).toBe('150');
    });

    it('should display wave / maxWaves when not endless', () => {
      component.wave = 3;
      component.maxWaves = 10;
      component.isEndless = false;
      fixture.detectChanges();

      const waveEls = Array.from(fixture.nativeElement.querySelectorAll('.hud-stat:nth-child(3) .hud-value')) as HTMLElement[];
      const visible = waveEls.find(el => el.textContent?.trim());
      expect(visible?.textContent?.trim()).toBe('3 / 10');
    });

    it('should display wave number only when endless', () => {
      component.wave = 5;
      component.maxWaves = 10;
      component.isEndless = true;
      fixture.detectChanges();

      const waveEls = Array.from(fixture.nativeElement.querySelectorAll('.hud-stat:nth-child(3) .hud-value')) as HTMLElement[];
      const visible = waveEls.find(el => el.textContent?.trim());
      expect(visible?.textContent?.trim()).toBe('5');
    });

    it('should display formattedTime', () => {
      component.formattedTime = '02:34';
      fixture.detectChanges();

      const timeEl = fixture.nativeElement.querySelector('.hud-stat.secondary:nth-child(5) .hud-value');
      expect(timeEl.textContent.trim()).toBe('02:34');
    });
  });

  describe('critical lives class', () => {
    it('should apply critical class when lives <= 5', () => {
      component.lives = 5;
      fixture.detectChanges();

      const livesEl = fixture.nativeElement.querySelector('.hud-value.lives');
      expect(livesEl.classList.contains('critical')).toBeTrue();
    });

    it('should apply critical class when lives is 1', () => {
      component.lives = 1;
      fixture.detectChanges();

      const livesEl = fixture.nativeElement.querySelector('.hud-value.lives');
      expect(livesEl.classList.contains('critical')).toBeTrue();
    });

    it('should not apply critical class when lives > 5', () => {
      component.lives = 6;
      fixture.detectChanges();

      const livesEl = fixture.nativeElement.querySelector('.hud-value.lives');
      expect(livesEl.classList.contains('critical')).toBeFalse();
    });
  });

  describe('waveStartPulse', () => {
    it('should apply wave-start-pulse class to wave value when waveStartPulse is true (finite)', () => {
      component.waveStartPulse = true;
      component.isEndless = false;
      component.wave = 3;
      component.maxWaves = 10;
      fixture.detectChanges();

      const waveEl = fixture.nativeElement.querySelector('.hud-stat:nth-child(3) .hud-value');
      expect(waveEl.classList.contains('wave-start-pulse')).toBeTrue();
    });

    it('should apply wave-start-pulse class to wave value when waveStartPulse is true (endless)', () => {
      component.waveStartPulse = true;
      component.isEndless = true;
      component.wave = 5;
      fixture.detectChanges();

      const waveEl = fixture.nativeElement.querySelector('.hud-stat:nth-child(3) .hud-value');
      expect(waveEl.classList.contains('wave-start-pulse')).toBeTrue();
    });

    it('should not apply wave-start-pulse class when waveStartPulse is false', () => {
      component.waveStartPulse = false;
      component.isEndless = false;
      component.wave = 2;
      component.maxWaves = 10;
      fixture.detectChanges();

      const waveEl = fixture.nativeElement.querySelector('.hud-stat:nth-child(3) .hud-value');
      expect(waveEl.classList.contains('wave-start-pulse')).toBeFalse();
    });
  });

  describe('challenge indicators', () => {
    it('should not render .hud-challenge-strip when challengeIndicators is empty', () => {
      component.challengeIndicators = [];
      fixture.detectChanges();

      const el = fixture.nativeElement.querySelector('.hud-challenge-strip');
      expect(el).toBeNull();
    });

    it('should render .hud-challenge-strip when indicators are provided', () => {
      const indicators: ChallengeIndicator[] = [
        { label: 'No Slow', value: '✓', passing: true },
        { label: 'Towers', value: '2/4', passing: true },
      ];
      component.challengeIndicators = indicators;
      fixture.detectChanges();

      const el = fixture.nativeElement.querySelector('.hud-challenge-strip');
      expect(el).toBeTruthy();
    });

    it('should default to collapsed state (no .challenge-indicator elements visible)', () => {
      const indicators: ChallengeIndicator[] = [
        { label: 'No Slow', value: '✓', passing: true },
      ];
      component.challengeIndicators = indicators;
      fixture.detectChanges();

      const badges = fixture.nativeElement.querySelectorAll('.challenge-indicator');
      expect(badges.length).toBe(0);
    });

    it('should render toggle button when indicators are provided', () => {
      component.challengeIndicators = [{ label: 'No Slow', value: '✓', passing: true }];
      fixture.detectChanges();

      const toggle = fixture.nativeElement.querySelector('.hud-challenge-toggle');
      expect(toggle).toBeTruthy();
    });

    it('should expand indicators when toggle button is clicked', () => {
      const indicators: ChallengeIndicator[] = [
        { label: 'No Slow', value: '✓', passing: true },
        { label: 'Towers', value: '3/4', passing: false },
      ];
      component.challengeIndicators = indicators;
      fixture.detectChanges();

      component.toggleChallengeStrip();
      fixture.detectChanges();

      const badges = fixture.nativeElement.querySelectorAll('.challenge-indicator');
      expect(badges.length).toBe(2);
    });

    it('should render one badge per indicator when expanded', () => {
      const indicators: ChallengeIndicator[] = [
        { label: 'No Slow', value: '✓', passing: true },
        { label: 'Towers', value: '3/4', passing: false },
        { label: 'Spent', value: '400g/600g', passing: true },
      ];
      component.challengeIndicators = indicators;
      component.challengeStripExpanded = true;
      fixture.detectChanges();

      const badges = fixture.nativeElement.querySelectorAll('.challenge-indicator');
      expect(badges.length).toBe(3);
    });

    it('should apply passing class when indicator.passing is true (expanded)', () => {
      component.challengeIndicators = [{ label: 'No Slow', value: '✓', passing: true }];
      component.challengeStripExpanded = true;
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.challenge-indicator');
      expect(badge.classList.contains('passing')).toBeTrue();
      expect(badge.classList.contains('failing')).toBeFalse();
    });

    it('should apply failing class when indicator.passing is false (expanded)', () => {
      component.challengeIndicators = [{ label: 'No Slow', value: '✗', passing: false }];
      component.challengeStripExpanded = true;
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.challenge-indicator');
      expect(badge.classList.contains('failing')).toBeTrue();
      expect(badge.classList.contains('passing')).toBeFalse();
    });

    it('should display label and value in badge text (expanded)', () => {
      component.challengeIndicators = [{ label: 'Towers', value: '2/4', passing: true }];
      component.challengeStripExpanded = true;
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.challenge-indicator');
      expect(badge.textContent.trim()).toContain('Towers');
      expect(badge.textContent.trim()).toContain('2/4');
    });

    it('should set aria-label combining label and value on each badge (expanded)', () => {
      component.challengeIndicators = [{ label: 'Spent', value: '300g/600g', passing: true }];
      component.challengeStripExpanded = true;
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.challenge-indicator');
      expect(badge.getAttribute('aria-label')).toBe('Spent: 300g/600g');
    });

    it('should update rendered badges when input changes (expanded)', () => {
      component.challengeIndicators = [{ label: 'No Damage', value: '✓', passing: true }];
      component.challengeStripExpanded = true;
      fixture.detectChanges();

      component.challengeIndicators = [
        { label: 'No Damage', value: '✗', passing: false },
        { label: 'Towers', value: '5/4', passing: false },
      ];
      fixture.detectChanges();

      const badges = fixture.nativeElement.querySelectorAll('.challenge-indicator');
      expect(badges.length).toBe(2);
      expect(badges[0].classList.contains('failing')).toBeTrue();
    });

    it('should default challengeIndicators to empty array', () => {
      expect(component.challengeIndicators).toEqual([]);
    });

    it('should default challengeStripExpanded to false', () => {
      expect(component.challengeStripExpanded).toBeFalse();
    });

    it('should toggle challengeStripExpanded when toggleChallengeStrip() is called', () => {
      expect(component.challengeStripExpanded).toBeFalse();
      component.toggleChallengeStrip();
      expect(component.challengeStripExpanded).toBeTrue();
      component.toggleChallengeStrip();
      expect(component.challengeStripExpanded).toBeFalse();
    });

    it('should return correct passingCount', () => {
      component.challengeIndicators = [
        { label: 'A', value: '✓', passing: true },
        { label: 'B', value: '✗', passing: false },
        { label: 'C', value: '✓', passing: true },
      ];
      expect(component.passingCount).toBe(2);
    });

    it('should return correct failingCount', () => {
      component.challengeIndicators = [
        { label: 'A', value: '✓', passing: true },
        { label: 'B', value: '✗', passing: false },
        { label: 'C', value: '✗', passing: false },
      ];
      expect(component.failingCount).toBe(2);
    });
  });

  describe('gold and score pulse animations', () => {
    describe('goldPulse', () => {
      it('should not set goldPulse on firstChange', fakeAsync(() => {
        component.ngOnChanges({
          gold: new SimpleChange(undefined, 100, true),
        });
        expect(component.goldPulse).toBeFalse();
        tick(300);
      }));

      it('should set goldPulse to true when gold increases', fakeAsync(() => {
        component.ngOnChanges({
          gold: new SimpleChange(0, 150, false),
        });
        expect(component.goldPulse).toBeTrue();
        tick(300);
      }));

      it('should set goldPulse to true when gold decreases (tower purchase)', fakeAsync(() => {
        // Seed previousGold to 200
        component.ngOnChanges({
          gold: new SimpleChange(0, 200, false),
        });
        tick(300);
        component.ngOnChanges({
          gold: new SimpleChange(200, 50, false),
        });
        expect(component.goldPulse).toBeTrue();
        tick(300);
      }));

      it('should reset goldPulse to false after 300ms', fakeAsync(() => {
        component.ngOnChanges({
          gold: new SimpleChange(0, 150, false),
        });
        expect(component.goldPulse).toBeTrue();
        tick(300);
        expect(component.goldPulse).toBeFalse();
      }));

      it('should not set goldPulse when gold value is unchanged', fakeAsync(() => {
        // Seed previousGold to 100 via a non-firstChange call, then let timer expire
        component.ngOnChanges({
          gold: new SimpleChange(0, 100, false),
        });
        tick(300);
        // Now sending 100 again — delta is 0, no pulse
        component.ngOnChanges({
          gold: new SimpleChange(100, 100, false),
        });
        expect(component.goldPulse).toBeFalse();
        tick(300);
      }));

      it('should re-trigger goldPulse if gold changes again before timer expires', fakeAsync(() => {
        component.ngOnChanges({
          gold: new SimpleChange(0, 150, false),
        });
        tick(150);
        component.ngOnChanges({
          gold: new SimpleChange(150, 200, false),
        });
        expect(component.goldPulse).toBeTrue();
        tick(300);
        expect(component.goldPulse).toBeFalse();
      }));
    });

    describe('scorePulse', () => {
      it('should not set scorePulse on firstChange', fakeAsync(() => {
        component.ngOnChanges({
          score: new SimpleChange(undefined, 500, true),
        });
        expect(component.scorePulse).toBeFalse();
        tick(300);
      }));

      it('should set scorePulse to true when score changes', fakeAsync(() => {
        component.ngOnChanges({
          score: new SimpleChange(0, 750, false),
        });
        expect(component.scorePulse).toBeTrue();
        tick(300);
      }));

      it('should reset scorePulse to false after 300ms', fakeAsync(() => {
        component.ngOnChanges({
          score: new SimpleChange(0, 750, false),
        });
        tick(300);
        expect(component.scorePulse).toBeFalse();
      }));

      it('should not set scorePulse when score value is unchanged', fakeAsync(() => {
        // Seed previousScore to 500 via a non-firstChange call, then let timer expire
        component.ngOnChanges({
          score: new SimpleChange(0, 500, false),
        });
        tick(300);
        // Now sending 500 again — no change, no pulse
        component.ngOnChanges({
          score: new SimpleChange(500, 500, false),
        });
        expect(component.scorePulse).toBeFalse();
        tick(300);
      }));
    });

    describe('goldChange indicator', () => {
      it('should set goldChange to the delta when gold increases from 0', fakeAsync(() => {
        // previousGold starts at 0; first non-firstChange triggers delta = 150 - 0 = 150
        component.ngOnChanges({
          gold: new SimpleChange(0, 150, false),
        });
        expect(component.goldChange).toBe(150);
        tick(300);
      }));

      it('should set goldChange to the delta for a subsequent gold increase', fakeAsync(() => {
        // Seed previousGold via a non-firstChange call
        component.ngOnChanges({
          gold: new SimpleChange(0, 100, false),
        });
        tick(300);
        component.ngOnChanges({
          gold: new SimpleChange(100, 150, false),
        });
        expect(component.goldChange).toBe(50);
        tick(300);
      }));

      it('should not set goldChange when gold decreases', fakeAsync(() => {
        // Seed previousGold to 200
        component.ngOnChanges({
          gold: new SimpleChange(0, 200, false),
        });
        tick(300);
        component.ngOnChanges({
          gold: new SimpleChange(200, 100, false),
        });
        expect(component.goldChange).toBe(0);
        tick(300);
      }));

      it('should reset goldChange to 0 after 300ms', fakeAsync(() => {
        component.ngOnChanges({
          gold: new SimpleChange(0, 150, false),
        });
        expect(component.goldChange).toBe(150);
        tick(300);
        expect(component.goldChange).toBe(0);
      }));

      it('should update goldChange if gold increases again before timer expires', fakeAsync(() => {
        component.ngOnChanges({
          gold: new SimpleChange(0, 100, false),
        });
        tick(150);
        component.ngOnChanges({
          gold: new SimpleChange(100, 180, false),
        });
        expect(component.goldChange).toBe(80);
        tick(300);
        expect(component.goldChange).toBe(0);
      }));
    });

    describe('DOM binding', () => {
      it('should apply gold-pulse class to gold hud-value when goldPulse is true', () => {
        component.goldPulse = true;
        fixture.detectChanges();

        const goldEl = fixture.nativeElement.querySelector('.hud-value.gold');
        expect(goldEl.classList.contains('gold-pulse')).toBeTrue();
      });

      it('should not apply gold-pulse class when goldPulse is false', () => {
        component.goldPulse = false;
        fixture.detectChanges();

        const goldEl = fixture.nativeElement.querySelector('.hud-value.gold');
        expect(goldEl.classList.contains('gold-pulse')).toBeFalse();
      });

      it('should apply score-pulse class to score hud-value when scorePulse is true', () => {
        component.scorePulse = true;
        fixture.detectChanges();

        const scoreEl = fixture.nativeElement.querySelector('.hud-stat.secondary .hud-value');
        expect(scoreEl.classList.contains('score-pulse')).toBeTrue();
      });

      it('should not apply score-pulse class when scorePulse is false', () => {
        component.scorePulse = false;
        fixture.detectChanges();

        const scoreEl = fixture.nativeElement.querySelector('.hud-stat.secondary .hud-value');
        expect(scoreEl.classList.contains('score-pulse')).toBeFalse();
      });

      it('should render gold-change span when goldChange is positive', () => {
        component.goldChange = 50;
        fixture.detectChanges();

        const changeEl = fixture.nativeElement.querySelector('.gold-change');
        expect(changeEl).toBeTruthy();
        expect(changeEl.textContent.trim()).toBe('+50g');
      });

      it('should not render gold-change span when goldChange is 0', () => {
        component.goldChange = 0;
        fixture.detectChanges();

        const changeEl = fixture.nativeElement.querySelector('.gold-change');
        expect(changeEl).toBeNull();
      });
    });

    describe('ngOnDestroy cleanup', () => {
      it('should clear pending timers on destroy without throwing', fakeAsync(() => {
        component.ngOnChanges({
          gold: new SimpleChange(0, 150, false),
        });
        component.ngOnChanges({
          score: new SimpleChange(0, 750, false),
        });
        expect(() => component.ngOnDestroy()).not.toThrow();
        tick(300);
      }));
    });
  });
});
