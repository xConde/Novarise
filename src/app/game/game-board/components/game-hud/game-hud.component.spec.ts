import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { GameHUDComponent } from './game-hud.component';
import { GamePhase, INITIAL_GAME_STATE, GameState } from '../../models/game-state.model';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...INITIAL_GAME_STATE, activeModifiers: new Set(), ...overrides };
}

describe('GameHUDComponent', () => {
  let component: GameHUDComponent;
  let fixture: ComponentFixture<GameHUDComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GameHUDComponent],
      imports: [CommonModule]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GameHUDComponent);
    component = fixture.componentInstance;
    component.gameState = makeState();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('HUD hidden when wave is 0', () => {
    component.gameState = makeState({ wave: 0 });
    fixture.detectChanges();
    const hud = fixture.nativeElement.querySelector('.game-hud');
    expect(hud).toBeNull();
  });

  it('HUD shows when wave > 0', () => {
    component.gameState = makeState({ wave: 1 });
    fixture.detectChanges();
    const hud = fixture.nativeElement.querySelector('.game-hud');
    expect(hud).toBeTruthy();
  });

  it('Lives shows critical class when <= 5', () => {
    component.gameState = makeState({ wave: 1, lives: 3 });
    fixture.detectChanges();
    const livesEl = fixture.nativeElement.querySelector('.hud-value.lives');
    expect(livesEl.classList.contains('critical')).toBeTrue();
  });

  it('Lives does not show critical class when > 5', () => {
    component.gameState = makeState({ wave: 1, lives: 10 });
    fixture.detectChanges();
    const livesEl = fixture.nativeElement.querySelector('.hud-value.lives');
    expect(livesEl.classList.contains('critical')).toBeFalse();
  });

  it('Wave status shows during COMBAT phase', () => {
    component.gameState = makeState({ wave: 1, phase: GamePhase.COMBAT });
    fixture.detectChanges();
    const status = fixture.nativeElement.querySelector('.hud-wave-status');
    expect(status).toBeTruthy();
  });

  it('Wave status hidden during non-COMBAT phase', () => {
    component.gameState = makeState({ wave: 1, phase: GamePhase.INTERMISSION });
    fixture.detectChanges();
    const status = fixture.nativeElement.querySelector('.hud-wave-status');
    expect(status).toBeNull();
  });

  it('Path blocked warning shows when pathBlocked is true', () => {
    component.pathBlocked = true;
    fixture.detectChanges();
    const warning = fixture.nativeElement.querySelector('.path-blocked-warning');
    expect(warning).toBeTruthy();
  });

  it('Path blocked warning hides when pathBlocked is false', () => {
    component.pathBlocked = false;
    fixture.detectChanges();
    const warning = fixture.nativeElement.querySelector('.path-blocked-warning');
    expect(warning).toBeNull();
  });

  it('Displays correct formattedTime', () => {
    component.gameState = makeState({ wave: 1 });
    component.formattedTime = '05:23';
    fixture.detectChanges();
    const timeEl = fixture.nativeElement.querySelectorAll('.hud-value');
    const timeText = Array.from(timeEl as NodeListOf<HTMLElement>)
      .map(el => el.textContent?.trim())
      .find(t => t === '05:23');
    expect(timeText).toBe('05:23');
  });

  it('Displays enemy count (enemiesAlive + enemiesToSpawn)', () => {
    component.gameState = makeState({ wave: 1, phase: GamePhase.COMBAT });
    component.enemiesAlive = 5;
    component.enemiesToSpawn = 3;
    fixture.detectChanges();
    const countEl = fixture.nativeElement.querySelector('.wave-enemy-count');
    expect(countEl.textContent?.trim()).toBe('8');
  });
});
