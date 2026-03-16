import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DifficultyLevel, DIFFICULTY_PRESETS, GamePhase, GameSpeed, GameState, INITIAL_GAME_STATE, INTEREST_CONFIG, STREAK_BONUS_PER_WAVE, VALID_GAME_SPEEDS } from '../models/game-state.model';
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

  /** Force-sets the game phase and emits. Prefer `startWave()` / `completeWave()` for normal phase transitions — use this only for external overrides (e.g., editor quick-play teardown). */
  setPhase(phase: GamePhase): void {
    this.state.phase = phase;
    this.emit();
  }

  /** Increments wave counter and transitions to COMBAT phase. Guards against double-calls (COMBAT phase) and terminal states (VICTORY/DEFEAT). No-op if no waves remain and endless mode is off. */
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

  /** Awards wave gold/score, transitions to INTERMISSION (or VICTORY on final wave). No-op if not in COMBAT phase. Endless mode never triggers VICTORY; updates `highestWave` instead. */
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

  /** Toggles endless mode, which prevents VICTORY from triggering after the final scripted wave. */
  setEndlessMode(enabled: boolean): void {
    this.state.isEndless = enabled;
    this.emit();
  }

  /** Deducts lives by `amount` (default 1). Triggers DEFEAT when lives reach 0. Resets the leak streak. No-op during VICTORY or DEFEAT. */
  loseLife(amount: number = 1): void {
    if (this.state.phase === GamePhase.VICTORY || this.state.phase === GamePhase.DEFEAT) return;
    this.state.lives = Math.max(0, this.state.lives - amount);
    this.state.consecutiveWavesWithoutLeak = 0;
    if (this.state.lives <= 0) {
      this.state.phase = GamePhase.DEFEAT;
    }
    this.emit();
  }

  /**
   * Increments the no-leak streak counter and awards a streak bonus.
   * Call this when a wave completes with zero leaks.
   * Bonus gold = STREAK_BONUS_PER_WAVE * consecutiveWavesWithoutLeak (after increment).
   * Returns the gold bonus awarded (0 if not in COMBAT phase).
   */
  addStreakBonus(): number {
    if (this.state.phase !== GamePhase.COMBAT) return 0;
    this.state.consecutiveWavesWithoutLeak++;
    const bonus = STREAK_BONUS_PER_WAVE * this.state.consecutiveWavesWithoutLeak;
    this.state.gold += bonus;
    this.state.score += bonus;
    this.emit();
    return bonus;
  }

  /** Returns the current no-leak streak count. */
  getStreak(): number {
    return this.state.consecutiveWavesWithoutLeak;
  }

  /** Adds gold and score by the same amount. Use for kill rewards and interest payouts. */
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

  /** Deducts gold using the confirm-before-spend pattern. Returns true and emits only if the player can afford it; returns false without mutating state otherwise. */
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

  /** Adds to score without awarding gold. Use for score-only bonuses (e.g., modifier multiplier adjustments). */
  addScore(points: number): void {
    this.state.score += points;
    this.emit();
  }

  /** Toggles pause state. No-op outside of COMBAT phase. */
  togglePause(): void {
    if (this.state.phase !== GamePhase.COMBAT) return;
    this.state.isPaused = !this.state.isPaused;
    this.emit();
  }

  /** Sets game speed multiplier. No-op for values not in VALID_GAME_SPEEDS. */
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

  /** Sets difficulty and re-initializes lives and gold from the preset. Only applies during SETUP before wave 1. Respects any active `startingGoldMultiplier` modifier. */
  setDifficulty(difficulty: DifficultyLevel): void {
    if (this.state.phase !== GamePhase.SETUP || this.state.wave !== 0) return;
    const preset = DIFFICULTY_PRESETS[difficulty];
    this.state.difficulty = difficulty;
    this.state.lives = preset.lives;
    const goldMultiplier = this.modifierEffects.startingGoldMultiplier ?? 1;
    this.state.gold = Math.floor(preset.gold * goldMultiplier);
    this.emit();
  }

  /** Accumulates time-in-combat for the score breakdown. Only ticks during COMBAT phase. */
  addElapsedTime(seconds: number): void {
    if (this.state.phase !== GamePhase.COMBAT) return;
    this.state.elapsedTime += seconds;
    this.emit();
  }

  /**
   * Overrides the maximum wave count for the current session (e.g., a campaign level with fewer or more waves than the default 10).
   * Only applies during SETUP phase before wave 1 to prevent mid-game confusion.
   * Also updates WaveService via the consumer — call `waveService.setCustomWaves()` first so maxWaves stays in sync.
   */
  setMaxWaves(count: number): void {
    if (this.state.phase !== GamePhase.SETUP || this.state.wave !== 0) return;
    this.state.maxWaves = count;
    this.emit();
  }

  /** Resets all game state to initial values and clears modifiers. Call from `restartGame()` before a new game begins. */
  reset(): void {
    this.state = { ...INITIAL_GAME_STATE, activeModifiers: new Set<GameModifier>() };
    this.modifierEffects = {};
    this.emit();
  }

  private emit(): void {
    this.state$.next({ ...this.state, activeModifiers: new Set(this.state.activeModifiers) });
  }
}
