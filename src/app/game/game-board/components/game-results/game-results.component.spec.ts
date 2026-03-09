import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { GameResultsComponent } from './game-results.component';
import { GamePhase, INITIAL_GAME_STATE, GameState } from '../../models/game-state.model';
import { ScoreBreakdown } from '../../models/score.model';
import { Achievement } from '../../services/player-profile.service';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...INITIAL_GAME_STATE, activeModifiers: new Set(), ...overrides };
}

describe('GameResultsComponent', () => {
  let component: GameResultsComponent;
  let fixture: ComponentFixture<GameResultsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GameResultsComponent],
      imports: [CommonModule]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GameResultsComponent);
    component = fixture.componentInstance;
    component.gameState = makeState({ phase: GamePhase.VICTORY });
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('Shows "Victory" when phase is VICTORY', () => {
    component.gameState = makeState({ phase: GamePhase.VICTORY });
    fixture.detectChanges();
    const h2 = fixture.nativeElement.querySelector('h2');
    expect(h2.textContent.trim()).toBe('Victory');
  });

  it('Shows "Defeat" when phase is DEFEAT', () => {
    component.gameState = makeState({ phase: GamePhase.DEFEAT });
    fixture.detectChanges();
    const h2 = fixture.nativeElement.querySelector('h2');
    expect(h2.textContent.trim()).toBe('Defeat');
  });

  it('Displays star rating correctly (3 filled, 0 empty)', () => {
    component.gameState = makeState({ phase: GamePhase.VICTORY });
    component.starArray = ['filled', 'filled', 'filled'];
    fixture.detectChanges();
    const stars = fixture.nativeElement.querySelectorAll('.overlay-star.filled');
    expect(stars.length).toBe(3);
    const emptyStars = fixture.nativeElement.querySelectorAll('.overlay-star.empty');
    expect(emptyStars.length).toBe(0);
  });

  it('Displays star rating correctly (2 filled, 1 empty)', () => {
    component.gameState = makeState({ phase: GamePhase.VICTORY });
    component.starArray = ['filled', 'filled', 'empty'];
    fixture.detectChanges();
    const filled = fixture.nativeElement.querySelectorAll('.overlay-star.filled');
    const empty = fixture.nativeElement.querySelectorAll('.overlay-star.empty');
    expect(filled.length).toBe(2);
    expect(empty.length).toBe(1);
  });

  it('Displays score breakdown fields', () => {
    component.gameState = makeState({ phase: GamePhase.VICTORY, maxWaves: 10 });
    component.scoreBreakdown = {
      baseScore: 500,
      difficultyMultiplier: 1.0,
      modifierMultiplier: 1.0,
      wavesCompleted: 10,
      livesRemaining: 18,
      livesTotal: 20,
      livesPercent: 0.9,
      finalScore: 500,
      stars: 3,
      isVictory: true,
      difficulty: 'normal' as any
    };
    fixture.detectChanges();
    const scoreRows = fixture.nativeElement.querySelectorAll('.score-row');
    expect(scoreRows.length).toBeGreaterThanOrEqual(4);
    const finalValue = fixture.nativeElement.querySelector('.final-value');
    expect(finalValue.textContent.trim()).toBe('500');
  });

  it('Emits restart event on Play Again click', () => {
    fixture.detectChanges();
    spyOn(component.restart, 'emit');
    const btn = fixture.nativeElement.querySelector('.restart-btn');
    btn.click();
    expect(component.restart.emit).toHaveBeenCalled();
  });

  it('Emits goToEditor event on Edit Map click', () => {
    fixture.detectChanges();
    spyOn(component.goToEditor, 'emit');
    const btn = fixture.nativeElement.querySelector('.edit-map-btn');
    btn.click();
    expect(component.goToEditor.emit).toHaveBeenCalled();
  });

  it('Shows achievements when newlyUnlockedAchievements is non-empty', () => {
    component.gameState = makeState({ phase: GamePhase.VICTORY });
    component.newlyUnlockedAchievements = ['first_blood'];
    component.achievementDetails = [
      { id: 'first_blood', name: 'First Blood', description: 'Kill your first enemy', condition: () => true } as Achievement
    ];
    fixture.detectChanges();
    const achievementsSection = fixture.nativeElement.querySelector('.achievements-unlocked');
    expect(achievementsSection).toBeTruthy();
    const badge = fixture.nativeElement.querySelector('.achievement-badge');
    expect(badge).toBeTruthy();
  });

  it('Hides achievements section when empty', () => {
    component.gameState = makeState({ phase: GamePhase.VICTORY });
    component.newlyUnlockedAchievements = [];
    fixture.detectChanges();
    const achievementsSection = fixture.nativeElement.querySelector('.achievements-unlocked');
    expect(achievementsSection).toBeNull();
  });
});
