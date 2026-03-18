import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { GameHudComponent } from './game-hud.component';

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
});
