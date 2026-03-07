import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DifficultyLevel, DIFFICULTY_PRESETS, GamePhase, GameSpeed, GameState, INITIAL_GAME_STATE, INTEREST_CONFIG, VALID_GAME_SPEEDS } from '../models/game-state.model';
import { GameModifier, ModifierEffects, mergeModifierEffects, calculateModifierScoreMultiplier } from '../models/game-modifier.model';

@Injectable()
export class GameStateService {
  private state: GameState = { ...INITIAL_GAME_STATE, activeModifiers: new Set<GameModifier>() };
  private state$ = new BehaviorSubject<GameState>(this.state);
  private modifierEffects: ModifierEffects = {};

  getState$(): Observable<GameState> {
    return this.state$.asObservable();
  }

  getState(): GameState {
    return this.state;
  }

  setPhase(phase: GamePhase): void {
    this.state.phase = phase;
    this.emit();
  }

  startWave(): void {
    if (this.state.phase === GamePhase.VICTORY || this.state.phase === GamePhase.DEFEAT) return;
    if (this.state.phase === GamePhase.COMBAT) return;
    const hasMoreWaves =
      this.state.wave < this.state.maxWaves || this.state.isEndless;
    if (!hasMoreWaves) return;
    this.state.wave++;
    this.state.phase = GamePhase.COMBAT;
    this.emit();
  }

  completeWave(reward: number): void {
    if (this.state.phase !== GamePhase.COMBAT) return;
    this.state.gold += reward;
    this.state.score += reward;

    if (this.state.isEndless) {
      // In endless mode, track highest wave reached and never trigger VICTORY
      if (this.state.wave > this.state.highestWave) {
        this.state.highestWave = this.state.wave;
      }
      this.state.phase = GamePhase.INTERMISSION;
    } else if (this.state.wave >= this.state.maxWaves) {
      this.state.phase = GamePhase.VICTORY;
    } else {
      this.state.phase = GamePhase.INTERMISSION;
    }
    this.emit();
  }

  setEndlessMode(enabled: boolean): void {
    this.state.isEndless = enabled;
    this.emit();
  }

  loseLife(amount: number = 1): void {
    if (this.state.phase === GamePhase.VICTORY || this.state.phase === GamePhase.DEFEAT) return;
    this.state.lives = Math.max(0, this.state.lives - amount);
    if (this.state.lives <= 0) {
      this.state.phase = GamePhase.DEFEAT;
    }
    this.emit();
  }

  addGold(amount: number): void {
    this.state.gold += amount;
    this.state.score += amount;
    this.emit();
  }

  /**
   * Calculate and award interest on unspent gold.
   * Called during INTERMISSION phase transition.
   * Returns the interest amount awarded.
   */
  awardInterest(): number {
    if (this.state.phase !== GamePhase.INTERMISSION) return 0;
    if (this.modifierEffects.disableInterest) return 0;
    const interest = Math.min(
      Math.floor(this.state.gold * INTEREST_CONFIG.rate),
      INTEREST_CONFIG.maxPayout
    );
    if (interest > 0) {
      this.state.gold += interest;
      this.state.score += interest;
      this.emit();
    }
    return interest;
  }

  spendGold(amount: number): boolean {
    if (amount <= 0 || this.state.gold < amount) {
      return false;
    }
    this.state.gold -= amount;
    this.emit();
    return true;
  }

  canAfford(amount: number): boolean {
    return this.state.gold >= amount;
  }

  addScore(points: number): void {
    this.state.score += points;
    this.emit();
  }

  togglePause(): void {
    if (this.state.phase !== GamePhase.COMBAT) return;
    this.state.isPaused = !this.state.isPaused;
    this.emit();
  }

  setSpeed(speed: GameSpeed): void {
    if (!VALID_GAME_SPEEDS.includes(speed)) return;
    this.state.gameSpeed = speed;
    this.emit();
  }

  /**
   * Set active game modifiers. Only allowed during SETUP phase before wave 1.
   */
  setModifiers(modifiers: Set<GameModifier>): void {
    if (this.state.phase !== GamePhase.SETUP || this.state.wave !== 0) return;
    this.state.activeModifiers = new Set(modifiers);
    this.modifierEffects = mergeModifierEffects(this.state.activeModifiers);
    // Re-apply starting gold with modifier
    const preset = DIFFICULTY_PRESETS[this.state.difficulty];
    const goldMultiplier = this.modifierEffects.startingGoldMultiplier ?? 1;
    this.state.gold = Math.floor(preset.gold * goldMultiplier);
    this.emit();
  }

  /** Returns the merged modifier effects from all active modifiers. */
  getModifierEffects(): ModifierEffects {
    return this.modifierEffects;
  }

  /** Returns the score multiplier from active modifiers (1.0 = no change). */
  getModifierScoreMultiplier(): number {
    return calculateModifierScoreMultiplier(this.state.activeModifiers);
  }

  setDifficulty(difficulty: DifficultyLevel): void {
    if (this.state.phase !== GamePhase.SETUP || this.state.wave !== 0) return;
    const preset = DIFFICULTY_PRESETS[difficulty];
    this.state.difficulty = difficulty;
    this.state.lives = preset.lives;
    const goldMultiplier = this.modifierEffects.startingGoldMultiplier ?? 1;
    this.state.gold = Math.floor(preset.gold * goldMultiplier);
    this.emit();
  }

  addElapsedTime(seconds: number): void {
    if (this.state.phase !== GamePhase.COMBAT) return;
    this.state.elapsedTime += seconds;
    this.emit();
  }

  reset(): void {
    this.state = { ...INITIAL_GAME_STATE, activeModifiers: new Set<GameModifier>() };
    this.modifierEffects = {};
    this.emit();
  }

  private emit(): void {
    this.state$.next({ ...this.state, activeModifiers: new Set(this.state.activeModifiers) });
  }
}
