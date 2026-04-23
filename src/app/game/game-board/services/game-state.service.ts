import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { DifficultyLevel, DIFFICULTY_PRESETS, GamePhase, GameState, INITIAL_GAME_STATE, INTEREST_CONFIG, STREAK_BONUS_PER_WAVE } from '../models/game-state.model';
import { GameModifier, ModifierEffects, mergeModifierEffects, calculateModifierScoreMultiplier } from '../models/game-modifier.model';
import { SerializableGameState } from '../models/encounter-checkpoint.model';

@Injectable()
export class GameStateService {
  private state: GameState = { ...INITIAL_GAME_STATE, activeModifiers: new Set<GameModifier>() };
  private state$ = new BehaviorSubject<GameState>(this.state);
  private modifierEffects: ModifierEffects = {};
  /** Additional effects from Ascent Mode ascension levels, stacked on top of player modifiers. */
  private ascensionEffects: ModifierEffects = {};
  private phaseChange$ = new Subject<{ from: GamePhase; to: GamePhase }>();
  /** Cumulative gold spent during SETUP (tower placement before wave 1). Prevents difficulty/modifier toggle exploits. */
  private setupGoldSpent = 0;

  getState$(): Observable<GameState> {
    return this.state$.asObservable();
  }

  getState(): GameState {
    return this.state;
  }

  /**
   * Serialize the current game state to a plain JSON-safe object.
   * Converts `activeModifiers` from a Set to an array. `isPaused` is omitted
   * because encounters always resume unpaused.
   */
  serializeState(): SerializableGameState {
    return {
      phase: this.state.phase,
      wave: this.state.wave,
      maxWaves: this.state.maxWaves,
      lives: this.state.lives,
      maxLives: this.state.maxLives,
      initialLives: this.state.initialLives,
      gold: this.state.gold,
      initialGold: this.state.initialGold,
      score: this.state.score,
      difficulty: this.state.difficulty,
      isEndless: this.state.isEndless,
      highestWave: this.state.highestWave,
      elapsedTime: this.state.elapsedTime,
      activeModifiers: [...this.state.activeModifiers],
      consecutiveWavesWithoutLeak: this.state.consecutiveWavesWithoutLeak,
    };
  }

  /** Emits whenever the game phase changes. Each emission carries the previous and next phase. */
  getPhaseChanges(): Observable<{ from: GamePhase; to: GamePhase }> {
    return this.phaseChange$.asObservable();
  }

  /** Increments wave counter and transitions to COMBAT phase. Guards against double-calls (COMBAT phase) and terminal states (VICTORY/DEFEAT). No-op if no waves remain and endless mode is off. */
  startWave(): void {
    if (this.state.phase === GamePhase.VICTORY || this.state.phase === GamePhase.DEFEAT) return;
    if (this.state.phase === GamePhase.COMBAT) return;
    const hasMoreWaves =
      this.state.wave < this.state.maxWaves || this.state.isEndless;
    if (!hasMoreWaves) return;
    const from = this.state.phase;
    this.state.wave++;
    this.state.phase = GamePhase.COMBAT;
    this.phaseChange$.next({ from, to: GamePhase.COMBAT });
    this.emit();
  }

  /** Awards wave gold/score, transitions to INTERMISSION (or VICTORY on final wave). No-op if not in COMBAT phase. Endless mode never triggers VICTORY; updates `highestWave` instead. */
  completeWave(reward: number): void {
    if (this.state.phase !== GamePhase.COMBAT) return;
    const from = this.state.phase;
    this.addGoldAndScore(reward);

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
    this.phaseChange$.next({ from, to: this.state.phase });
    this.emit();
  }

  /** Toggles endless mode, which prevents VICTORY from triggering after the final scripted wave. */
  setEndlessMode(enabled: boolean): void {
    this.state.isEndless = enabled;
    this.emit();
  }

  /** Deducts lives by `amount` (default 1). Triggers DEFEAT when lives reach 0. Resets the leak streak. No-op during VICTORY or DEFEAT. */
  loseLife(amount = 1): void {
    if (this.state.phase === GamePhase.VICTORY || this.state.phase === GamePhase.DEFEAT) return;
    this.state.lives = Math.max(0, this.state.lives - amount);
    this.state.consecutiveWavesWithoutLeak = 0;
    if (this.state.lives <= 0) {
      const from = this.state.phase;
      this.state.phase = GamePhase.DEFEAT;
      this.phaseChange$.next({ from, to: GamePhase.DEFEAT });
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
    this.addGoldAndScore(bonus);
    return bonus;
  }

  /** Returns the current no-leak streak count. */
  getStreak(): number {
    return this.state.consecutiveWavesWithoutLeak;
  }

  /** Override initial lives, max lives, and initial-lives snapshot for Ascent Mode encounters. Only works during SETUP before wave 1. */
  setInitialLives(lives: number, maxLives: number): void {
    if (this.state.phase !== GamePhase.SETUP || this.state.wave !== 0) return;
    this.state.lives = lives;
    this.state.maxLives = maxLives;
    this.state.initialLives = lives;
    this.emit();
  }

  /** Snapshot current gold as the encounter starting gold. Call after all initial bonuses are applied. */
  snapshotInitialGold(): void {
    this.state.initialGold = this.state.gold;
    this.emit();
  }

  /** Adds gold only. Use for sell refunds (should not count toward score). */
  addGold(amount: number): void {
    this.state.gold += amount;
    // Sell refunds during SETUP reduce the spent counter (tower was returned)
    if (this.state.phase === GamePhase.SETUP) {
      this.setupGoldSpent = Math.max(0, this.setupGoldSpent - amount);
    }
    this.emit();
  }

  /** Adds to both gold and score. Use for kill rewards, wave rewards, and interest payouts. */
  addGoldAndScore(amount: number): void {
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
      this.addGoldAndScore(interest);
    }
    return interest;
  }

  /** Deducts gold using the confirm-before-spend pattern. Returns true and emits only if the player can afford it; returns false without mutating state otherwise. */
  spendGold(amount: number): boolean {
    if (amount <= 0 || this.state.gold < amount) {
      return false;
    }
    this.state.gold -= amount;
    // Track gold spent during SETUP to prevent difficulty/modifier toggle exploits
    if (this.state.phase === GamePhase.SETUP) {
      this.setupGoldSpent += amount;
    }
    this.emit();
    return true;
  }

  canAfford(amount: number): boolean {
    return this.state.gold >= amount;
  }

  /**
   * Restore lives from a card effect (e.g. Repair Walls spell).
   * Caps at the encounter's maxLives ceiling so healing cannot exceed the run's
   * max (which accounts for relic bonuses and ascension modifiers).
   * Amount must be positive; no-ops otherwise.
   */
  addLives(amount: number): void {
    if (amount <= 0) return;
    this.state.lives = Math.min(this.state.lives + amount, this.state.maxLives);
    this.emit();
  }

  /** Toggles pause state. No-op outside of COMBAT and INTERMISSION phases. */
  togglePause(): void {
    if (this.state.phase !== GamePhase.COMBAT && this.state.phase !== GamePhase.INTERMISSION) return;
    this.state.isPaused = !this.state.isPaused;
    this.emit();
  }

  /**
   * Set active game modifiers. Only allowed during SETUP phase before wave 1.
   */
  setModifiers(modifiers: Set<GameModifier>): void {
    if (this.state.phase !== GamePhase.SETUP || this.state.wave !== 0) return;
    this.state.activeModifiers = new Set(modifiers);
    this.modifierEffects = mergeModifierEffects(this.state.activeModifiers);
    // Re-apply starting gold with new modifier, minus cumulative gold spent on towers
    const preset = DIFFICULTY_PRESETS[this.state.difficulty];
    const goldMultiplier = this.modifierEffects.startingGoldMultiplier ?? 1;
    this.state.gold = Math.max(0, Math.floor(preset.gold * goldMultiplier) - this.setupGoldSpent);
    this.emit();
  }

  /**
   * Returns the merged modifier effects from all active modifiers combined with
   * any ascension effects set via setAscensionModifierEffects().
   */
  getModifierEffects(): ModifierEffects {
    const a = this.ascensionEffects;
    const m = this.modifierEffects;
    // Fast path: nothing from ascension
    if (Object.keys(a).length === 0) return m;
    // Merge: multiplicative stacking for numeric multipliers, OR for booleans
    return {
      enemyHealthMultiplier: (m.enemyHealthMultiplier ?? 1) * (a.enemyHealthMultiplier ?? 1),
      enemySpeedMultiplier: (m.enemySpeedMultiplier ?? 1) * (a.enemySpeedMultiplier ?? 1),
      towerCostMultiplier: (m.towerCostMultiplier ?? 1) * (a.towerCostMultiplier ?? 1),
      towerDamageMultiplier: m.towerDamageMultiplier !== undefined || a.towerDamageMultiplier !== undefined
        ? (m.towerDamageMultiplier ?? 1) * (a.towerDamageMultiplier ?? 1)
        : undefined,
      waveCountMultiplier: m.waveCountMultiplier !== undefined || a.waveCountMultiplier !== undefined
        ? (m.waveCountMultiplier ?? 1) * (a.waveCountMultiplier ?? 1)
        : undefined,
      startingGoldMultiplier: m.startingGoldMultiplier !== undefined || a.startingGoldMultiplier !== undefined
        ? (m.startingGoldMultiplier ?? 1) * (a.startingGoldMultiplier ?? 1)
        : undefined,
      disableInterest: (m.disableInterest || a.disableInterest) ? true : undefined,
    };
  }

  /**
   * Injects Ascent Mode ascension difficulty multipliers as additional modifier
   * effects that stack on top of any player-chosen GameModifiers.
   * Should be called during ngOnInit of GameBoardComponent when isInRun() is true.
   * No-op for empty effects objects.
   */
  setAscensionModifierEffects(effects: ModifierEffects): void {
    this.ascensionEffects = { ...effects };
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
    this.state.maxLives = preset.lives;
    this.state.initialLives = preset.lives;
    const goldMultiplier = this.modifierEffects.startingGoldMultiplier ?? 1;
    const startingGold = Math.floor(preset.gold * goldMultiplier);
    // Deduct cumulative gold already spent on towers to prevent toggle exploits
    this.state.gold = Math.max(0, startingGold - this.setupGoldSpent);
    this.state.initialGold = this.state.gold;
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

  /** Resets all game state to initial values and clears modifiers and ascension effects. Call from `restartGame()` / encounter teardown before a new game begins. */
  reset(): void {
    const from = this.state.phase;
    this.state = { ...INITIAL_GAME_STATE, activeModifiers: new Set<GameModifier>() };
    this.modifierEffects = {};
    this.ascensionEffects = {};
    this.setupGoldSpent = 0;
    this.phaseChange$.next({ from, to: GamePhase.SETUP });
    this.emit();
  }

  /**
   * Restore full game state from a checkpoint snapshot, bypassing phase
   * transition validation. Used by the encounter save/resume system.
   * Must call setAscensionModifierEffects() before this method.
   */
  restoreFromCheckpoint(snapshot: SerializableGameState): void {
    const from = this.state.phase;
    this.state = {
      phase: snapshot.phase,
      wave: snapshot.wave,
      maxWaves: snapshot.maxWaves,
      lives: snapshot.lives,
      maxLives: snapshot.maxLives,
      initialLives: snapshot.initialLives,
      gold: snapshot.gold,
      initialGold: snapshot.initialGold,
      score: snapshot.score,
      difficulty: snapshot.difficulty,
      isEndless: snapshot.isEndless,
      highestWave: snapshot.highestWave,
      isPaused: false,
      elapsedTime: snapshot.elapsedTime,
      activeModifiers: new Set(snapshot.activeModifiers),
      consecutiveWavesWithoutLeak: snapshot.consecutiveWavesWithoutLeak,
    };
    this.modifierEffects = mergeModifierEffects(this.state.activeModifiers);
    this.setupGoldSpent = 0; // Not relevant post-SETUP
    if (from !== snapshot.phase) {
      this.phaseChange$.next({ from, to: snapshot.phase });
    }
    this.emit();
  }

  private emit(): void {
    this.state$.next({ ...this.state, activeModifiers: new Set(this.state.activeModifiers) });
  }
}
