import { GamePhase, DifficultyLevel } from './game-state.model';
import { GameModifier } from './game-modifier.model';
import { TowerType } from '@core/models/tower-type.model';
import { TargetingMode, TowerSpecialization } from './tower.model';
import { TowerStatOverrides, DeckState, EnergyState } from '../../../run/models/card.model';
import { EnemyType } from '@core/models/enemy-type.model';
import { StatusEffectType } from '@core/models/status-effect-type.model';
import { EndlessWaveResult } from './endless-wave.model';
import { ActiveModifier } from '../../../run/services/card-effect.service';
import { EncounterConfig } from '../../../run/models/encounter.model';

/** Schema version — bump when the shape changes to enable migrations. */
export const CHECKPOINT_VERSION = 2;

/** Plain-object snapshot of GameState (isPaused omitted — always false on restore). */
export interface SerializableGameState {
  readonly phase: GamePhase;
  readonly wave: number;
  readonly maxWaves: number;
  readonly lives: number;
  readonly maxLives: number;
  readonly initialLives: number;
  readonly gold: number;
  readonly initialGold: number;
  readonly score: number;
  readonly difficulty: DifficultyLevel;
  readonly isEndless: boolean;
  readonly highestWave: number;
  readonly elapsedTime: number;
  /** Serialized from Set<GameModifier> — restored as an array then re-wrapped. */
  readonly activeModifiers: GameModifier[];
  readonly consecutiveWavesWithoutLeak: number;
}

/** PlacedTower minus Three.js fields (mesh, muzzleFlashTimer, originalEmissiveIntensity). */
export interface SerializablePlacedTower {
  readonly id: string;
  readonly type: TowerType;
  readonly level: number;
  readonly row: number;
  readonly col: number;
  readonly kills: number;
  readonly totalInvested: number;
  readonly targetingMode: TargetingMode;
  readonly specialization?: TowerSpecialization;
  readonly placedAtTurn?: number;
  readonly cardStatOverrides?: TowerStatOverrides;
}

/** GridNode minus the circular `parent` reference. */
export interface SerializableGridNode {
  readonly x: number;
  readonly y: number;
  readonly f: number;
  readonly g: number;
  readonly h: number;
}

/**
 * Enemy minus Three.js fields (mesh, statusParticles, statusParticleEffectType).
 * `path` uses SerializableGridNode to avoid circular parent refs.
 */
export interface SerializableEnemy {
  readonly id: string;
  readonly type: EnemyType;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly gridPosition: { readonly row: number; readonly col: number };
  readonly health: number;
  readonly maxHealth: number;
  readonly speed: number;
  readonly value: number;
  readonly path: SerializableGridNode[];
  readonly pathIndex: number;
  readonly distanceTraveled: number;
  readonly leakDamage: number;
  readonly shield?: number;
  readonly maxShield?: number;
  readonly isMiniSwarm?: boolean;
  readonly isFlying?: boolean;
  readonly needsRepath?: boolean;
  readonly dying?: boolean;
  readonly dyingTimer?: number;
  readonly hitFlashTimer?: number;
  readonly shieldBreaking?: boolean;
  readonly shieldBreakTimer?: number;
}

/**
 * Flattened row from the nested Map<string, Map<StatusEffectType, ActiveEffect>>
 * in StatusEffectService. One row per (enemy, effect type) pair.
 */
export interface SerializableStatusEffect {
  readonly enemyId: string;
  readonly effectType: StatusEffectType;
  readonly expiresAt: number;
  readonly lastTickTime: number;
  readonly originalSpeed?: number;
}

/** TurnMortarZone — all fields are already serializable (no Three.js). */
export interface SerializableMortarZone {
  readonly centerX: number;
  readonly centerZ: number;
  readonly blastRadius: number;
  readonly dotDamage: number;
  readonly expiresOnTurn: number;
  readonly statusEffect?: StatusEffectType;
  /**
   * Level of the mortar tower at the time of placement. Frozen for attribution
   * so upgrades after placement don't retroactively relabel RECAP rows.
   * Optional for pre-v3 checkpoints; restore path defaults to level 1 when
   * the field is absent.
   */
  readonly placerLevel?: number;
}

/**
 * Wave service state snapshot.
 * EnemyType is a string enum so turnSchedule is string[][] in serialized form.
 */
export interface SerializableWaveState {
  readonly currentWaveIndex: number;
  /** Serialized EnemyType[][] — each inner array is one turn's spawn list. */
  readonly turnSchedule: string[][];
  readonly turnScheduleIndex: number;
  readonly active: boolean;
  readonly endlessMode: boolean;
  readonly currentEndlessResult: EndlessWaveResult | null;
}

/** Deck service state snapshot. CardInstance is already serializable. */
export interface SerializableDeckState {
  readonly deckState: DeckState;
  readonly energyState: EnergyState;
  readonly instanceCounter: number;
}

/** Relic per-wave / per-encounter flags. */
export interface SerializableRelicFlags {
  readonly firstLeakBlockedThisWave: boolean;
  readonly freeTowerUsedThisEncounter: boolean;
}

/** Game stats service snapshot. */
export interface SerializableGameStats {
  readonly totalGoldEarned: number;
  readonly totalDamageDealt: number;
  readonly shotsFired: number;
  readonly killsByTowerType: Record<string, number>;
  readonly enemiesLeaked: number;
  readonly towersPlaced: number;
  readonly towersSold: number;
}

/** Challenge tracking service snapshot. */
export interface SerializableChallengeState {
  readonly totalGoldSpent: number;
  readonly maxTowersPlaced: number;
  readonly towerTypesUsed: string[];
  readonly currentTowerCount: number;
  readonly livesLostThisGame: number;
}

/**
 * Complete serializable snapshot of an in-progress combat encounter.
 * Written to persistent storage when the player navigates away mid-run,
 * and read back to reconstruct the full encounter on resume.
 *
 * All Three.js runtime objects are stripped — only plain JSON-safe values survive.
 * Bump CHECKPOINT_VERSION and add a migration when the shape changes.
 */
export interface EncounterCheckpoint {
  /** Schema version for future migrations. */
  readonly version: number;
  /** Date.now() at save time. */
  readonly timestamp: number;
  /** Run node being played. */
  readonly nodeId: string;

  /** Encounter setup — needed to reconstruct the map and wave pool on restore. */
  readonly encounterConfig: EncounterConfig;

  /** Mulberry32 internal state integer — restores deterministic RNG sequences. */
  readonly rngState: number;

  // --- Game loop ---
  readonly gameState: SerializableGameState;
  /** CombatLoopService turn counter. */
  readonly turnNumber: number;
  /** CombatLoopService flag tracking whether an enemy leaked this wave. */
  readonly leakedThisWave: boolean;

  // --- Board entities ---
  readonly towers: SerializablePlacedTower[];
  readonly mortarZones: SerializableMortarZone[];
  readonly enemies: SerializableEnemy[];
  /** EnemyService ID counter — ensures restored enemies get unique IDs. */
  readonly enemyCounter: number;
  readonly statusEffects: SerializableStatusEffect[];

  // --- Wave scheduling ---
  readonly waveState: SerializableWaveState;

  // --- Deck & cards ---
  readonly deckState: SerializableDeckState;
  /** CardEffectService active modifiers at save time. */
  readonly cardModifiers: ActiveModifier[];

  // --- Auxiliary ---
  readonly relicFlags: SerializableRelicFlags;
  readonly gameStats: SerializableGameStats;
  readonly challengeState: SerializableChallengeState;
  /**
   * One-shot scout bonuses granted by SCOUT_AHEAD / SCOUT_ELITE spells during
   * the encounter. Permanent SCOUTING_LENS bonus is NOT serialized — it derives
   * from the active-relics list which round-trips through the run state itself.
   */
  readonly wavePreview: SerializableWavePreviewState;
}

/** Serializable WavePreviewService state. */
export interface SerializableWavePreviewState {
  readonly oneShotBonus: number;
}
