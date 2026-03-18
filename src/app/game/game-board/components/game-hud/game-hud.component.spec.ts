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
