import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { EnemyType } from '../models/enemy.model';
import { WaveDefinition, WAVE_DEFINITIONS, getWaveEnemyCount } from '../models/wave.model';
import { EndlessWaveTemplate, EndlessWaveResult, generateEndlessWave } from '../models/endless-wave.model';
import { EnemyService } from './enemy.service';
import { RelicService } from '../../../run/services/relic.service';
import { SerializableWaveState } from '../models/encounter-checkpoint.model';

@Injectable()
export class WaveService {
  private waveDefinitions: WaveDefinition[] = WAVE_DEFINITIONS;
  /** Custom wave definitions set for a specific campaign level. Null means use WAVE_DEFINITIONS. */
  private customWaves: WaveDefinition[] | null = null;
  private active = false;
  private currentWaveIndex = -1;
  private endlessMode = false;
  private currentEndlessResult: EndlessWaveResult | null = null;
  /** Tracks which enemy types have been introduced to the player (for "NEW" badge notifications). */
  private seenEnemyTypes = new Set<EnemyType>();

  /**
   * Phase 4: per-turn spawn schedule for the active wave. Index = turns since
   * startWave(). Built from the wave's entries[] by distributing enemies one
   * per entry per turn until all counts are exhausted. Wave 1 (5 BASIC,
   * interval 1.5) becomes 5 turns of 1 BASIC each.
   */
  private turnSchedule: EnemyType[][] = [];
  /** Next turn index into turnSchedule. Resets to 0 on each startWave(). */
  private turnScheduleIndex = 0;

  constructor(
    private enemyService: EnemyService,
    private relicService: RelicService,
  ) {}

  /**
   * Overrides wave definitions with a custom set for the current session (e.g., campaign level).
   * Must be called before `startWave()` for the custom waves to take effect.
   * Does NOT affect the global WAVE_DEFINITIONS constant.
   */
  setCustomWaves(waves: WaveDefinition[]): void {
    this.customWaves = waves;
    this.waveDefinitions = waves;
  }

  /**
   * Reverts wave definitions to the default WAVE_DEFINITIONS set.
   * Call from `restartGame()` when returning to non-campaign play.
   */
  clearCustomWaves(): void {
    this.customWaves = null;
    this.waveDefinitions = WAVE_DEFINITIONS;
  }

  /** Returns true if custom wave definitions are currently active. */
  hasCustomWaves(): boolean {
    return this.customWaves !== null;
  }

  /** Returns the active wave definitions (custom if set, otherwise default). */
  getWaveDefinitions(): WaveDefinition[] {
    return this.waveDefinitions;
  }

  /** Enables or disables endless mode. Must be set before `startWave()` is called for waves beyond WAVE_DEFINITIONS length. */
  setEndlessMode(enabled: boolean): void {
    this.endlessMode = enabled;
  }

  isEndlessMode(): boolean {
    return this.endlessMode;
  }

  /**
   * Returns the template used by the currently active endless wave, or null if not in
   * an endless wave. Used by the HUD to display the wave type.
   */
  getCurrentEndlessTemplate(): EndlessWaveTemplate | null {
    return this.currentEndlessResult?.template ?? null;
  }

  /**
   * Returns the full result of the currently active endless wave generation, or null if
   * the current wave is a scripted wave.
   */
  getCurrentEndlessResult(): EndlessWaveResult | null {
    return this.currentEndlessResult;
  }

  /**
   * Converts an absolute wave number to the 1-based endless wave number.
   * e.g. wave 11 with 10 scripted waves → endless wave 1.
   */
  private toEndlessWaveNumber(absoluteWaveNumber: number): number {
    return absoluteWaveNumber - this.waveDefinitions.length;
  }

  /**
   * Loads and activates a wave's spawn queues. For waves beyond WAVE_DEFINITIONS, requires
   * endless mode to be enabled or the call is a no-op.
   * @param waveNumber 1-based wave index.
   * @param waveCountMultiplier Scales enemy counts per queue (e.g., DOUBLE_SPAWN modifier = 2). Clamped to minimum 1.
   */
  startWave(waveNumber: number, scene: THREE.Scene, waveCountMultiplier = 1): void {
    const index = waveNumber - 1;

    let waveDef: WaveDefinition | undefined;
    this.currentEndlessResult = null;

    if (index >= 0 && index < this.waveDefinitions.length) {
      // Normal wave from the static definitions
      this.currentWaveIndex = index;
      waveDef = this.waveDefinitions[this.currentWaveIndex];
    } else if (this.endlessMode && waveNumber > this.waveDefinitions.length) {
      // Endless wave — composition-based generation
      this.currentWaveIndex = index;
      const endlessWaveNumber = this.toEndlessWaveNumber(waveNumber);
      this.currentEndlessResult = generateEndlessWave(endlessWaveNumber);
      waveDef = {
        entries: this.currentEndlessResult.entries,
        reward: this.currentEndlessResult.reward,
      };
    } else {
      return;
    }

    const countMultiplier = Math.max(1, waveCountMultiplier);

    if (waveDef.spawnTurns !== undefined) {
      // Authored per-turn schedule — use directly after TEMPORAL_RIFT delay.
      this.turnSchedule = this.buildTurnScheduleFromSpawnTurns(waveDef.spawnTurns);
    } else if (waveDef.entries !== undefined) {
      // Legacy entries[] — convert to per-turn schedule via interleaving.
      // Phase 4: build the per-turn spawn schedule. Distributes enemies by
      // interleaving one-per-entry-per-turn until all entries are exhausted.
      // Preserves wave "shape" (e.g., FAST + BASIC interleave) across turns.
      this.turnSchedule = this.buildTurnSchedule(waveDef.entries, countMultiplier);
    } else {
      // Runtime invariant violation — wave has neither format.
      throw new Error(`WaveService.startWave: wave ${waveNumber} has neither entries[] nor spawnTurns[][]`);
    }

    this.turnScheduleIndex = 0;
    this.active = true;
  }

  /**
   * Phase 4: convert time-based WaveEntries into a per-turn spawn schedule.
   * One enemy from each entry spawns per turn until all counts hit zero.
   *
   * Example: [{ BASIC x5 }, { FAST x3 }] →
   *   turn 0: [BASIC, FAST]
   *   turn 1: [BASIC, FAST]
   *   turn 2: [BASIC, FAST]
   *   turn 3: [BASIC]
   *   turn 4: [BASIC]
   */
  private buildTurnSchedule(entries: NonNullable<WaveDefinition['entries']>, countMultiplier: number): EnemyType[][] {
    const schedule: EnemyType[][] = [];
    const remaining = entries.map(e => ({ type: e.type, left: Math.round(e.count * countMultiplier) }));
    while (remaining.some(r => r.left > 0)) {
      const turn: EnemyType[] = [];
      for (const r of remaining) {
        if (r.left > 0) {
          turn.push(r.type);
          r.left--;
        }
      }
      schedule.push(turn);
    }
    // TEMPORAL_RIFT relic: prepend empty prep turns so the first enemy spawns later.
    this.prependTemporalRiftDelay(schedule);
    return schedule;
  }

  /**
   * Build turnSchedule from an authored spawnTurns[][] field. Applies the
   * TEMPORAL_RIFT relic delay by prepending empty turns, the same way
   * buildTurnSchedule does for legacy entries. Returns a deep clone
   * (each inner array is a fresh array) so runtime turnScheduleIndex advance
   * can't corrupt the authored source.
   */
  private buildTurnScheduleFromSpawnTurns(spawnTurns: EnemyType[][]): EnemyType[][] {
    const schedule = spawnTurns.map(turn => [...turn]);
    this.prependTemporalRiftDelay(schedule);
    return schedule;
  }

  /**
   * Prepend empty "prep" turns to the schedule to model the TEMPORAL_RIFT
   * relic's "first enemy spawns 1 turn later" effect. Called by both the
   * legacy entries[]-based schedule builder and the authored spawnTurns
   * schedule builder.
   */
  private prependTemporalRiftDelay(schedule: EnemyType[][]): void {
    const delayTurns = this.relicService.getTurnDelayPerWave();
    for (let i = 0; i < delayTurns; i++) {
      schedule.unshift([]);
    }
  }

  /**
   * Phase 4: spawn whatever is scheduled for the current turn within the
   * active wave. Advances the internal turn counter and sets `active=false`
   * when the schedule is exhausted. Called once per resolution phase from
   * CombatLoopService.resolveTurn().
   *
   * @returns The number of enemies actually spawned this call (may be 0 for
   *          intentional empty prep turns, or when a spawn fails due to path
   *          invalidation — retried next turn).
   */
  spawnForTurn(scene: THREE.Scene): number {
    if (!this.active) return 0;
    if (this.turnScheduleIndex >= this.turnSchedule.length) {
      this.active = false;
      return 0;
    }

    const turnSpawns = this.turnSchedule[this.turnScheduleIndex];
    this.turnScheduleIndex++;

    if (turnSpawns.length === 0) {
      // Intentional empty prep turn (boss buildup etc.). Still consume the turn.
      if (this.turnScheduleIndex >= this.turnSchedule.length) this.active = false;
      return 0;
    }

    const waveHealthMult = this.currentEndlessResult?.healthMultiplier ?? 1;
    const waveSpeedMult = this.currentEndlessResult?.speedMultiplier ?? 1;

    let spawned = 0;
    for (const type of turnSpawns) {
      const enemy = this.enemyService.spawnEnemy(type, scene, waveHealthMult, waveSpeedMult);
      if (enemy) spawned++;
    }

    if (this.turnScheduleIndex >= this.turnSchedule.length) {
      this.active = false;
    }

    return spawned;
  }

  /** Phase 4: turn-based "remaining spawns" count computed from the turn schedule. */
  getRemainingInTurnSchedule(): number {
    let total = 0;
    for (let t = this.turnScheduleIndex; t < this.turnSchedule.length; t++) {
      total += this.turnSchedule[t].length;
    }
    return total;
  }

  /**
   * Phase 4: forward-looking spawn preview for the combat shell HUD. Returns
   * grouped spawn counts for the next N turns so the player can plan ahead.
   * User direction: "proper good indicators of how many are remaining to spawn
   * as a quick at a glance understandable thing."
   *
   * Entry for a turn with no spawns (boss prep window) returns an empty
   * `spawns` array but is still included so the UI can render a "—" placeholder.
   *
   * @param lookaheadTurns How many upcoming resolution turns to include.
   */
  getUpcomingSpawnsPreview(lookaheadTurns: number): Array<{
    turnOffset: number;
    spawns: { type: EnemyType; count: number }[];
  }> {
    const out: Array<{ turnOffset: number; spawns: { type: EnemyType; count: number }[] }> = [];
    for (let offset = 0; offset < lookaheadTurns; offset++) {
      const scheduleIndex = this.turnScheduleIndex + offset;
      if (scheduleIndex >= this.turnSchedule.length) {
        out.push({ turnOffset: offset + 1, spawns: [] });
        continue;
      }
      const turnSpawns = this.turnSchedule[scheduleIndex];
      const grouped = new Map<EnemyType, number>();
      for (const type of turnSpawns) {
        grouped.set(type, (grouped.get(type) ?? 0) + 1);
      }
      out.push({
        turnOffset: offset + 1,
        spawns: Array.from(grouped.entries()).map(([type, count]) => ({ type, count })),
      });
    }
    return out;
  }

  // M2 S3: deltaTime-based update() DELETED. Replaced by spawnForTurn (turn-based).


  /** Returns true while enemies are still queued to spawn in the current wave. */
  isSpawning(): boolean {
    return this.active;
  }

  /** Returns number of enemies still queued to spawn in current wave. */
  getRemainingToSpawn(): number {
    return this.getRemainingInTurnSchedule();
  }

  /** Returns the total enemy count for a given wave (pre-`waveCountMultiplier`). Used for UI progress display. */
  getTotalEnemiesInWave(waveNumber: number): number {
    const index = waveNumber - 1;
    if (index < 0) return 0;
    if (index < this.waveDefinitions.length) {
      return getWaveEnemyCount(this.waveDefinitions[index]);
    }
    if (this.endlessMode) {
      // Use cached result when available for the requested wave to avoid regenerating on every UI query.
      if (this.currentEndlessResult && this.currentWaveIndex === index) {
        return this.currentEndlessResult.entries.reduce((sum, e) => sum + e.count, 0);
      }
      const endlessWaveNumber = this.toEndlessWaveNumber(waveNumber);
      return generateEndlessWave(endlessWaveNumber).entries.reduce((sum, e) => sum + e.count, 0);
    }
    return 0;
  }

  /** Returns the gold reward for completing a given wave. Generates endless wave data on the fly for waves beyond WAVE_DEFINITIONS. */
  getWaveReward(waveNumber: number): number {
    const index = waveNumber - 1;
    if (index < 0) return 0;
    if (index < this.waveDefinitions.length) {
      return this.waveDefinitions[index].reward;
    }
    if (this.endlessMode) {
      const endlessWaveNumber = this.toEndlessWaveNumber(waveNumber);
      return generateEndlessWave(endlessWaveNumber).reward;
    }
    return 0;
  }

  /** Returns the number of scripted waves (does not include endless-generated waves). */
  getMaxWaves(): number {
    return this.waveDefinitions.length;
  }

  /**
   * Returns true if this enemy type has NOT yet been shown to the player.
   * Used to determine whether to display the "NEW" badge in the wave preview.
   */
  isNewType(type: EnemyType): boolean {
    return !this.seenEnemyTypes.has(type);
  }

  /**
   * Mark an enemy type as seen (introduced to the player).
   * Call after showing the "NEW" notification so subsequent waves don't re-alert.
   */
  markSeen(type: EnemyType): void {
    this.seenEnemyTypes.add(type);
  }

  /** Serialize wave state for checkpoint save. */
  serializeState(): SerializableWaveState {
    return {
      currentWaveIndex: this.currentWaveIndex,
      turnSchedule: this.turnSchedule.map(turn => [...turn]),
      turnScheduleIndex: this.turnScheduleIndex,
      seenEnemyTypes: [...this.seenEnemyTypes],
      active: this.active,
      endlessMode: this.endlessMode,
      currentEndlessResult: this.currentEndlessResult ? { ...this.currentEndlessResult } : null,
    };
  }

  /**
   * Restore wave state from a checkpoint snapshot. Sets all fields directly
   * without calling startWave() (which would rebuild turnSchedule from scratch).
   */
  restoreState(snapshot: SerializableWaveState): void {
    this.currentWaveIndex = snapshot.currentWaveIndex;
    this.turnSchedule = snapshot.turnSchedule.map(turn => [...turn] as EnemyType[]);
    this.turnScheduleIndex = snapshot.turnScheduleIndex;
    this.seenEnemyTypes = new Set(snapshot.seenEnemyTypes as EnemyType[]);
    this.active = snapshot.active;
    this.endlessMode = snapshot.endlessMode;
    this.currentEndlessResult = snapshot.currentEndlessResult ? { ...snapshot.currentEndlessResult } : null;
  }

  /** Resets wave state. Call from `restartGame()` before a new game begins. Clears custom waves — re-apply via `setCustomWaves()` if restarting a campaign level. */
  reset(): void {
    this.active = false;
    this.currentWaveIndex = -1;
    this.endlessMode = false;
    this.currentEndlessResult = null;
    this.seenEnemyTypes.clear();
    this.turnSchedule = [];
    this.turnScheduleIndex = 0;
    this.clearCustomWaves();
  }
}
