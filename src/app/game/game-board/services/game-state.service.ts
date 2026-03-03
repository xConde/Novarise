import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DifficultyLevel, DIFFICULTY_PRESETS, GamePhase, GameState, INITIAL_GAME_STATE } from '../models/game-state.model';

@Injectable()
export class GameStateService {
  private state: GameState = { ...INITIAL_GAME_STATE };
  private state$ = new BehaviorSubject<GameState>(this.state);

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

  setDifficulty(difficulty: DifficultyLevel): void {
    const preset = DIFFICULTY_PRESETS[difficulty];
    this.state.difficulty = difficulty;
    this.state.lives = preset.lives;
    this.state.gold = preset.gold;
    this.emit();
  }

  reset(): void {
    this.state = { ...INITIAL_GAME_STATE };
    this.emit();
  }

  private emit(): void {
    this.state$.next({ ...this.state });
  }
}
