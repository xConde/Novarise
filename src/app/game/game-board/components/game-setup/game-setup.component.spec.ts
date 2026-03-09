import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { GameSetupComponent } from './game-setup.component';
import { DifficultyLevel, INITIAL_GAME_STATE, GameState } from '../../models/game-state.model';
import { GameModifier, GAME_MODIFIER_CONFIGS } from '../../models/game-modifier.model';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...INITIAL_GAME_STATE, activeModifiers: new Set(), ...overrides };
}

describe('GameSetupComponent', () => {
  let component: GameSetupComponent;
  let fixture: ComponentFixture<GameSetupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GameSetupComponent],
      imports: [CommonModule]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GameSetupComponent);
    component = fixture.componentInstance;
    component.gameState = makeState();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('displays difficulty buttons', () => {
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('.setup-diff-btn');
    expect(buttons.length).toBe(4);
  });

  it('emits selectDifficulty when difficulty button clicked', () => {
    fixture.detectChanges();
    spyOn(component.selectDifficulty, 'emit');

    const buttons = fixture.nativeElement.querySelectorAll('.setup-diff-btn');
    buttons[2].click(); // HARD is the 3rd button

    expect(component.selectDifficulty.emit).toHaveBeenCalledWith(DifficultyLevel.HARD);
  });

  it('emits toggleModifier when modifier button clicked', () => {
    fixture.detectChanges();
    spyOn(component.toggleModifier, 'emit');

    const modButtons = fixture.nativeElement.querySelectorAll('.setup-mod-btn');
    modButtons[0].click();

    expect(component.toggleModifier.emit).toHaveBeenCalledWith(component.allModifiers[0]);
  });

  it('emits toggleEndless when checkbox changed', () => {
    fixture.detectChanges();
    spyOn(component.toggleEndless, 'emit');

    const checkbox = fixture.nativeElement.querySelector('input[type="checkbox"]');
    checkbox.dispatchEvent(new Event('change'));

    expect(component.toggleEndless.emit).toHaveBeenCalled();
  });

  it('emits startGame when Start Game button clicked', () => {
    fixture.detectChanges();
    spyOn(component.startGame, 'emit');

    const startBtn = fixture.nativeElement.querySelector('.setup-start-btn');
    startBtn.click();

    expect(component.startGame.emit).toHaveBeenCalled();
  });

  it('shows score multiplier when modifiers are active', () => {
    component.activeModifiers = new Set([GameModifier.ARMORED_ENEMIES]);
    component.modifierScoreMultiplier = 1.3;
    fixture.detectChanges();

    const scoreEl = fixture.nativeElement.querySelector('.setup-score');
    expect(scoreEl).toBeTruthy();
    expect(scoreEl.textContent).toContain('1.3x');
  });

  it('hides score when no modifiers active', () => {
    component.activeModifiers = new Set();
    component.modifierScoreMultiplier = 1.0;
    fixture.detectChanges();

    const scoreEl = fixture.nativeElement.querySelector('.setup-score');
    expect(scoreEl).toBeNull();
  });
});
