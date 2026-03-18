import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
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

  describe('speed run timer', () => {
    describe('default state (no speed run)', () => {
      it('should show "Time" label when speedRunTimeLimit is 0', () => {
        component.speedRunTimeLimit = 0;
        component.formattedTime = '01:23';
        fixture.detectChanges();

        const timeStatEl = fixture.nativeElement.querySelector('.hud-stat.secondary:nth-child(5)');
        const label = timeStatEl?.querySelector('.hud-label');
        expect(label?.textContent?.trim()).toBe('Time');
      });

      it('should show formattedTime when speedRunTimeLimit is 0', () => {
        component.speedRunTimeLimit = 0;
        component.formattedTime = '02:45';
        fixture.detectChanges();

        const timeStatEl = fixture.nativeElement.querySelector('.hud-stat.secondary:nth-child(5)');
        const value = timeStatEl?.querySelector('.hud-value');
        expect(value?.textContent?.trim()).toBe('02:45');
      });

      it('should not apply speed-run-active class when speedRunTimeLimit is 0', () => {
        component.speedRunTimeLimit = 0;
        fixture.detectChanges();

        const speedRunEl = fixture.nativeElement.querySelector('.hud-stat.speed-run-active');
        expect(speedRunEl).toBeNull();
      });
    });

    describe('active speed run', () => {
      beforeEach(() => {
        component.speedRunTimeLimit = 120;
        component.elapsedTime = 60;
        fixture.detectChanges();
      });

      it('should show "Speed Run" label when speedRunTimeLimit > 0', () => {
        const label = fixture.nativeElement.querySelector('.speed-run-label');
        expect(label?.textContent?.trim()).toBe('Speed Run');
      });

      it('should not show the "Time" label when speed run is active', () => {
        const labels = fixture.nativeElement.querySelectorAll('.hud-stat:nth-child(5) .hud-label');
        const timeLabel = Array.from(labels as NodeList).find(
          (el: Node) => (el as HTMLElement).textContent?.trim() === 'Time'
        );
        expect(timeLabel).toBeUndefined();
      });

      it('should apply speed-run-active class when speedRunTimeLimit > 0', () => {
        const el = fixture.nativeElement.querySelector('.hud-stat.speed-run-active');
        expect(el).toBeTruthy();
      });

      it('should show remaining time in MM:SS format', () => {
        component.speedRunTimeLimit = 120;
        component.elapsedTime = 60;
        fixture.detectChanges();

        const timerEl = fixture.nativeElement.querySelector('.speed-run-timer');
        expect(timerEl?.textContent?.trim()).toBe('01:00');
      });

      it('should format remaining time with leading zeros', () => {
        component.speedRunTimeLimit = 120;
        component.elapsedTime = 115;
        fixture.detectChanges();

        const timerEl = fixture.nativeElement.querySelector('.speed-run-timer');
        expect(timerEl?.textContent?.trim()).toBe('00:05');
      });

      it('should show 00:00 when elapsed time exceeds time limit', () => {
        component.speedRunTimeLimit = 60;
        component.elapsedTime = 90;
        fixture.detectChanges();

        const timerEl = fixture.nativeElement.querySelector('.speed-run-timer');
        expect(timerEl?.textContent?.trim()).toBe('00:00');
      });

      it('should not apply warning class when more than 30s remain', () => {
        component.speedRunTimeLimit = 120;
        component.elapsedTime = 89; // 31s remaining
        fixture.detectChanges();

        const timerEl = fixture.nativeElement.querySelector('.speed-run-timer');
        expect(timerEl?.classList.contains('warning')).toBeFalse();
      });

      it('should apply warning class when 30s or fewer remain', () => {
        component.speedRunTimeLimit = 120;
        component.elapsedTime = 90; // exactly 30s remaining
        fixture.detectChanges();

        const timerEl = fixture.nativeElement.querySelector('.speed-run-timer');
        expect(timerEl?.classList.contains('warning')).toBeTrue();
      });

      it('should apply warning class when fewer than 30s remain', () => {
        component.speedRunTimeLimit = 120;
        component.elapsedTime = 100; // 20s remaining
        fixture.detectChanges();

        const timerEl = fixture.nativeElement.querySelector('.speed-run-timer');
        expect(timerEl?.classList.contains('warning')).toBeTrue();
      });

      it('should not apply critical class when more than 10s remain', () => {
        component.speedRunTimeLimit = 120;
        component.elapsedTime = 109; // 11s remaining
        fixture.detectChanges();

        const timerEl = fixture.nativeElement.querySelector('.speed-run-timer');
        expect(timerEl?.classList.contains('critical')).toBeFalse();
      });

      it('should apply critical class when 10s or fewer remain', () => {
        component.speedRunTimeLimit = 120;
        component.elapsedTime = 110; // exactly 10s remaining
        fixture.detectChanges();

        const timerEl = fixture.nativeElement.querySelector('.speed-run-timer');
        expect(timerEl?.classList.contains('critical')).toBeTrue();
      });

      it('should apply critical class when fewer than 10s remain', () => {
        component.speedRunTimeLimit = 120;
        component.elapsedTime = 115; // 5s remaining
        fixture.detectChanges();

        const timerEl = fixture.nativeElement.querySelector('.speed-run-timer');
        expect(timerEl?.classList.contains('critical')).toBeTrue();
      });
    });

    describe('speedRunRemaining getter', () => {
      it('should return time limit minus elapsed time', () => {
        component.speedRunTimeLimit = 120;
        component.elapsedTime = 45;
        expect(component.speedRunRemaining).toBe(75);
      });

      it('should never return a negative value', () => {
        component.speedRunTimeLimit = 60;
        component.elapsedTime = 100;
        expect(component.speedRunRemaining).toBe(0);
      });

      it('should return time limit when elapsed is 0', () => {
        component.speedRunTimeLimit = 180;
        component.elapsedTime = 0;
        expect(component.speedRunRemaining).toBe(180);
      });
    });

    describe('formattedSpeedRunRemaining getter', () => {
      it('should format whole minutes correctly', () => {
        component.speedRunTimeLimit = 120;
        component.elapsedTime = 0;
        expect(component.formattedSpeedRunRemaining).toBe('02:00');
      });

      it('should ceil fractional seconds', () => {
        component.speedRunTimeLimit = 120;
        component.elapsedTime = 59.7; // 60.3s remaining → ceil → 61 → 01:01
        expect(component.formattedSpeedRunRemaining).toBe('01:01');
      });

      it('should return 00:00 when no time remains', () => {
        component.speedRunTimeLimit = 60;
        component.elapsedTime = 120;
        expect(component.formattedSpeedRunRemaining).toBe('00:00');
      });
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

  describe('level name', () => {
    it('should show level name when isCampaignGame is true and levelName is set', () => {
      component.isCampaignGame = true;
      component.levelName = 'The Gauntlet';
      fixture.detectChanges();

      const levelEl = fixture.nativeElement.querySelector('.hud-level-name');
      expect(levelEl).toBeTruthy();
      expect(levelEl.textContent.trim()).toBe('The Gauntlet');
    });

    it('should not show level name when isCampaignGame is false', () => {
      component.isCampaignGame = false;
      component.levelName = 'The Gauntlet';
      fixture.detectChanges();

      const levelEl = fixture.nativeElement.querySelector('.hud-level-name');
      expect(levelEl).toBeNull();
    });

    it('should not show level name when levelName is empty', () => {
      component.isCampaignGame = true;
      component.levelName = '';
      fixture.detectChanges();

      const levelEl = fixture.nativeElement.querySelector('.hud-level-name');
      expect(levelEl).toBeNull();
    });
  });

  describe('challenge indicators', () => {
    it('should not render .challenge-indicators when challengeIndicators is empty', () => {
      component.challengeIndicators = [];
      fixture.detectChanges();

      const el = fixture.nativeElement.querySelector('.challenge-indicators');
      expect(el).toBeNull();
    });

    it('should render .challenge-indicators when indicators are provided', () => {
      const indicators: ChallengeIndicator[] = [
        { label: 'No Slow', value: '✓', passing: true },
        { label: 'Towers', value: '2/4', passing: true },
      ];
      component.challengeIndicators = indicators;
      fixture.detectChanges();

      const el = fixture.nativeElement.querySelector('.challenge-indicators');
      expect(el).toBeTruthy();
    });

    it('should render one badge per indicator', () => {
      const indicators: ChallengeIndicator[] = [
        { label: 'No Slow', value: '✓', passing: true },
        { label: 'Towers', value: '3/4', passing: false },
        { label: 'Spent', value: '400g/600g', passing: true },
      ];
      component.challengeIndicators = indicators;
      fixture.detectChanges();

      const badges = fixture.nativeElement.querySelectorAll('.challenge-indicator');
      expect(badges.length).toBe(3);
    });

    it('should apply passing class when indicator.passing is true', () => {
      component.challengeIndicators = [{ label: 'No Slow', value: '✓', passing: true }];
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.challenge-indicator');
      expect(badge.classList.contains('passing')).toBeTrue();
      expect(badge.classList.contains('failing')).toBeFalse();
    });

    it('should apply failing class when indicator.passing is false', () => {
      component.challengeIndicators = [{ label: 'No Slow', value: '✗', passing: false }];
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.challenge-indicator');
      expect(badge.classList.contains('failing')).toBeTrue();
      expect(badge.classList.contains('passing')).toBeFalse();
    });

    it('should display label and value in badge text', () => {
      component.challengeIndicators = [{ label: 'Towers', value: '2/4', passing: true }];
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.challenge-indicator');
      expect(badge.textContent.trim()).toContain('Towers');
      expect(badge.textContent.trim()).toContain('2/4');
    });

    it('should set aria-label combining label and value on each badge', () => {
      component.challengeIndicators = [{ label: 'Spent', value: '300g/600g', passing: true }];
      fixture.detectChanges();

      const badge = fixture.nativeElement.querySelector('.challenge-indicator');
      expect(badge.getAttribute('aria-label')).toBe('Spent: 300g/600g');
    });

    it('should update rendered badges when input changes', () => {
      component.challengeIndicators = [{ label: 'No Damage', value: '✓', passing: true }];
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
  });
});
