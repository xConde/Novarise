import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { GameSetupPanelComponent } from './game-setup-panel.component';
import { DifficultyLevel, DIFFICULTY_PRESETS } from '../../models/game-state.model';
import { DIFFICULTY_SCORE_MULTIPLIER } from '../../models/score.model';
import { GameModifier, GAME_MODIFIER_CONFIGS } from '../../models/game-modifier.model';

describe('GameSetupPanelComponent', () => {
  let component: GameSetupPanelComponent;
  let fixture: ComponentFixture<GameSetupPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GameSetupPanelComponent],
      imports: [CommonModule],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GameSetupPanelComponent);
    component = fixture.componentInstance;
    component.difficultyLevels = Object.values(DifficultyLevel);
    component.difficultyPresets = DIFFICULTY_PRESETS;
    component.modifierConfigs = GAME_MODIFIER_CONFIGS;
    component.allModifiers = Object.values(GameModifier);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('difficulty buttons', () => {
    it('should render a button for each difficulty level', () => {
      const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.setup-diff-btn');
      expect(buttons.length).toBe(Object.values(DifficultyLevel).length);
    });

    it('should mark the active difficulty with the selected class', () => {
      component.difficulty = DifficultyLevel.HARD;
      fixture.detectChanges();

      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.setup-diff-btn')
      );
      const hardBtn = buttons.find(b => b.textContent?.trim() === DIFFICULTY_PRESETS[DifficultyLevel.HARD].label);
      expect(hardBtn?.classList.contains('selected')).toBeTrue();
    });

    it('should emit selectDifficulty with the clicked level', () => {
      const emitted: DifficultyLevel[] = [];
      component.selectDifficulty.subscribe((d: DifficultyLevel) => emitted.push(d));

      const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.setup-diff-btn');
      buttons[0].click();

      expect(emitted.length).toBe(1);
      expect(emitted[0]).toBe(DifficultyLevel.EASY);
    });
  });

  describe('start game button', () => {
    it('should emit startGame when clicked', () => {
      let emitted = false;
      component.startGame.subscribe(() => (emitted = true));

      const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.setup-start-btn');
      btn.click();

      expect(emitted).toBeTrue();
    });
  });

  describe('modifier buttons', () => {
    beforeEach(() => {
      component.modifiersExpanded = true;
      fixture.detectChanges();
    });

    it('should render a button for each modifier', () => {
      const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.setup-mod-btn');
      expect(buttons.length).toBe(Object.values(GameModifier).length);
    });

    it('should apply active class to enabled modifiers', () => {
      component.activeModifiers = new Set<GameModifier>([GameModifier.ARMORED_ENEMIES]);
      fixture.detectChanges();

      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.setup-mod-btn')
      );
      const armoredBtn = buttons.find(
        b => b.textContent?.trim() === GAME_MODIFIER_CONFIGS[GameModifier.ARMORED_ENEMIES].label
      );
      expect(armoredBtn?.classList.contains('active')).toBeTrue();
    });

    it('should not apply active class to inactive modifiers', () => {
      component.activeModifiers = new Set<GameModifier>();
      fixture.detectChanges();

      const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.setup-mod-btn');
      buttons.forEach(b => expect(b.classList.contains('active')).toBeFalse());
    });

    it('should emit toggleModifier with the clicked modifier', () => {
      const emitted: GameModifier[] = [];
      component.toggleModifier.subscribe((m: GameModifier) => emitted.push(m));

      const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.setup-mod-btn');
      buttons[0].click();

      expect(emitted.length).toBe(1);
      expect(emitted[0]).toBe(GameModifier.ARMORED_ENEMIES);
    });
  });

  describe('score multiplier display', () => {
    it('should show the score multiplier when activeModifiers is non-empty', () => {
      component.modifiersExpanded = true;
      component.activeModifiers = new Set<GameModifier>([GameModifier.DOUBLE_SPAWN]);
      component.modifierScoreMultiplier = 1.4;
      fixture.detectChanges();

      const scoreEl: HTMLElement = fixture.nativeElement.querySelector('.setup-score');
      expect(scoreEl).toBeTruthy();
      expect(scoreEl.textContent).toContain('1.4x');
    });

    it('should hide the score multiplier when no modifiers are active', () => {
      component.activeModifiers = new Set<GameModifier>();
      fixture.detectChanges();

      const scoreEl = fixture.nativeElement.querySelector('.setup-score');
      expect(scoreEl).toBeNull();
    });
  });

  describe('getDifficultyInfo', () => {
    it('should return formatted info for Easy difficulty', () => {
      const info = component.getDifficultyInfo(DifficultyLevel.EASY);
      const preset = DIFFICULTY_PRESETS[DifficultyLevel.EASY];
      const multiplier = DIFFICULTY_SCORE_MULTIPLIER[DifficultyLevel.EASY];
      expect(info).toBe(`${preset.lives} lives · ${preset.gold}g · ${multiplier.toFixed(1)}× score`);
    });

    it('should return formatted info for Normal difficulty', () => {
      const info = component.getDifficultyInfo(DifficultyLevel.NORMAL);
      const preset = DIFFICULTY_PRESETS[DifficultyLevel.NORMAL];
      const multiplier = DIFFICULTY_SCORE_MULTIPLIER[DifficultyLevel.NORMAL];
      expect(info).toBe(`${preset.lives} lives · ${preset.gold}g · ${multiplier.toFixed(1)}× score`);
    });

    it('should return formatted info for Hard difficulty', () => {
      const info = component.getDifficultyInfo(DifficultyLevel.HARD);
      expect(info).toBe('10 lives · 100g · 1.5× score');
    });

    it('should return formatted info for Nightmare difficulty', () => {
      const info = component.getDifficultyInfo(DifficultyLevel.NIGHTMARE);
      expect(info).toBe('7 lives · 75g · 2.0× score');
    });
  });

  describe('difficulty info display', () => {
    it('should render the difficulty info element', () => {
      const el: HTMLElement = fixture.nativeElement.querySelector('.setup-difficulty-info');
      expect(el).toBeTruthy();
    });

    it('should display info matching the selected difficulty', () => {
      component.difficulty = DifficultyLevel.HARD;
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement.querySelector('.setup-difficulty-info');
      expect(el.textContent).toContain('10 lives');
      expect(el.textContent).toContain('100g');
      expect(el.textContent).toContain('1.5× score');
    });

    it('should update info when difficulty changes', () => {
      component.difficulty = DifficultyLevel.EASY;
      fixture.detectChanges();
      const elEasy: HTMLElement = fixture.nativeElement.querySelector('.setup-difficulty-info');
      expect(elEasy.textContent).toContain('30 lives');

      component.difficulty = DifficultyLevel.NIGHTMARE;
      fixture.detectChanges();
      const elNightmare: HTMLElement = fixture.nativeElement.querySelector('.setup-difficulty-info');
      expect(elNightmare.textContent).toContain('7 lives');
    });

    it('should display Normal difficulty info by default', () => {
      const el: HTMLElement = fixture.nativeElement.querySelector('.setup-difficulty-info');
      expect(el.textContent).toContain('20 lives');
      expect(el.textContent).toContain('200g');
      expect(el.textContent).toContain('1.0× score');
    });
  });

  describe('endless mode toggle', () => {
    it('should emit toggleEndless when the checkbox changes', () => {
      fixture.detectChanges();

      let emitted = false;
      component.toggleEndless.subscribe(() => (emitted = true));

      const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('.setup-endless input');
      checkbox.dispatchEvent(new Event('change'));

      expect(emitted).toBeTrue();
    });

    it('should reflect the isEndless input on the checkbox', () => {
      component.isEndless = true;
      fixture.detectChanges();

      const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('.setup-endless input');
      expect(checkbox.checked).toBeTrue();
    });
  });
});
