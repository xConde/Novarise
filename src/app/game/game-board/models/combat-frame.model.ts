import { TowerType } from './tower.model';
import { GamePhase } from './game-state.model';
import { ChallengeDefinition } from '../../../run/data/challenges';

/**
 * Info about a tower kill — includes the damage of the final hit and the
 * tower type that landed the killing blow. `towerType` is null for non-tower
 * kills (e.g. status-effect DoT ticks where no tower directly fired).
 */
export interface KillInfo {
  id: string;
  damage: number;
  towerType: TowerType | null;
}

/** Deferred audio event accumulated during physics steps, drained once per frame by the component. */
export type CombatAudioEvent =
  | { type: 'tower_fire'; towerType: TowerType }
  | { type: 'enemy_hit' }
  | { type: 'enemy_death' }
  | { type: 'sfx'; sfxKey: string };

/** Visual snapshot of a single enemy kill, captured before the enemy is removed from the scene. */
export interface FrameKillEvent {
  damage: number;
  position: { x: number; y: number; z: number };
  color: number;
  value: number;
}

/** Emitted when the current wave is cleared. */
export interface WaveCompletionEvent {
  reward: number;
  streakBonus: number;
  streakCount: number;
  interestEarned: number;
  /** Phase after completeWave() — either INTERMISSION or VICTORY. */
  resultPhase: GamePhase;
}

/** Emitted when the game session ends (VICTORY or DEFEAT). */
export interface GameEndEvent {
  isVictory: boolean;
  newlyUnlockedAchievements: string[];
  completedChallenges: readonly ChallengeDefinition[];
}

/**
 * All events produced during a single animation frame's physics steps.
 * Returned by CombatLoopService.tick() and consumed by the component.
 */
export interface CombatFrameResult {
  /** Kill events with visual data snapshots (position, color, value, damage). */
  kills: FrameKillEvent[];
  /** Tower types that fired at least once this frame. */
  firedTypes: Set<TowerType>;
  /** Total projectile hits across all physics steps. */
  hitCount: number;
  /** Number of enemies that reached the exit. */
  exitCount: number;
  /** Whether any enemy leaked during this frame. */
  leaked: boolean;
  /** Whether DEFEAT was triggered (from loseLife) during this frame. */
  defeatTriggered: boolean;
  /** Wave completion event if a wave was completed this frame (null if not). */
  waveCompletion: WaveCompletionEvent | null;
  /** Game end event if the game ended this frame (null if not). */
  gameEnd: GameEndEvent | null;
  /** Deferred combat audio events (chain lightning, mortar sounds, etc.). */
  combatAudioEvents: CombatAudioEvent[];
  /**
   * Total damage dealt this frame — tower fire + mortar-zone DoT ticks.
   * Status-effect DoT damage (BURN/POISON) is included via its own kill
   * reporting; non-lethal DoT ticks are NOT counted here to keep the number
   * tied to "offensive pressure the player's build is producing".
   */
  damageDealt: number;
  /**
   * Kill attribution by tower type (plus a `dot` bucket for status-effect
   * kills with no tower owner). Sum equals `kills.length`. Populated by
   * CombatLoopService.resolveTurn; consumed by the RECAP panel for
   * per-tower breakdowns.
   */
  killsByTower: Partial<Record<TowerType | 'dot', number>>;
}
