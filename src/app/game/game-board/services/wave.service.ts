import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { EnemyType } from '../models/enemy.model';
import { WaveDefinition, WAVE_DEFINITIONS } from '../models/wave.model';
import { EndlessWaveTemplate, EndlessWaveResult, generateEndlessWave } from '../models/endless-wave.model';
import { EnemyService } from './enemy.service';

interface SpawnQueue {
  type: EnemyType;
  spawnInterval: number;
  remaining: number;
  timeSinceLastSpawn: number;
}


@Injectable()
export class WaveService {
  private waveDefinitions: WaveDefinition[] = WAVE_DEFINITIONS;
  private spawnQueues: SpawnQueue[] = [];
  private active = false;
  private currentWaveIndex = -1;
  private endlessMode = false;
  private currentEndlessResult: EndlessWaveResult | null = null;

  constructor(private enemyService: EnemyService) {}

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
  startWave(waveNumber: number, scene: THREE.Scene, waveCountMultiplier: number = 1): void {
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

    this.spawnQueues = waveDef.entries.map(entry => ({
      type: entry.type,
      spawnInterval: entry.spawnInterval,
      remaining: Math.round(entry.count * countMultiplier),
      timeSinceLastSpawn: entry.spawnInterval // spawn first immediately
    }));

    this.active = true;
  }

  /**
   * Per-physics-step spawn tick. Advances timers on each queue and spawns enemies when
   * their interval elapses. Sets `active = false` once all queues are exhausted.
   * @param deltaTime Elapsed time in seconds since last physics step.
   */
  update(deltaTime: number, scene: THREE.Scene): void {
    if (!this.active) return;

    let allDone = true;

    for (const queue of this.spawnQueues) {
      if (queue.remaining <= 0) continue;

      allDone = false;
      queue.timeSinceLastSpawn += deltaTime;

      if (queue.timeSinceLastSpawn >= queue.spawnInterval) {
        const spawned = this.enemyService.spawnEnemy(queue.type, scene);
        if (spawned) {
          queue.remaining--;
          queue.timeSinceLastSpawn = 0;
        }
        // If spawn failed (no valid path), keep in queue and retry next tick
      }
    }

    if (allDone) {
      this.active = false;
    }
  }

  /** Returns true while enemies are still queued to spawn in the current wave. */
  isSpawning(): boolean {
    return this.active;
  }

  /** Returns number of enemies still queued to spawn in current wave. */
  getRemainingToSpawn(): number {
    return this.spawnQueues.reduce((sum, q) => sum + Math.max(0, q.remaining), 0);
  }

  /** Returns the total enemy count for a given wave (pre-`waveCountMultiplier`). Used for UI progress display. */
  getTotalEnemiesInWave(waveNumber: number): number {
    const index = waveNumber - 1;
    if (index < 0) return 0;
    if (index < this.waveDefinitions.length) {
      return this.waveDefinitions[index].entries.reduce((sum, e) => sum + e.count, 0);
    }
    if (this.endlessMode) {
      const endlessWaveNumber = this.toEndlessWaveNumber(waveNumber);
      const result = generateEndlessWave(endlessWaveNumber);
      return result.entries.reduce((sum, e) => sum + e.count, 0);
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

  /** Clears all spawn queues and resets wave state. Call from `restartGame()` before a new game begins. */
  reset(): void {
    this.spawnQueues = [];
    this.active = false;
    this.currentWaveIndex = -1;
    this.endlessMode = false;
    this.currentEndlessResult = null;
  }
}
