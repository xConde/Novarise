import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { EnemyType } from '../models/enemy.model';
import { WaveDefinition, WaveEntry, WAVE_DEFINITIONS, ENDLESS_CONFIG } from '../models/wave.model';
import { EnemyService } from './enemy.service';

interface SpawnQueue {
  type: EnemyType;
  spawnInterval: number;
  remaining: number;
  timeSinceLastSpawn: number;
}

// Enemy types that cycle in endless waves (excludes BOSS — added separately at intervals)
const ENDLESS_ENEMY_CYCLE: EnemyType[] = [
  EnemyType.BASIC,
  EnemyType.FAST,
  EnemyType.HEAVY,
  EnemyType.SWIFT,
  EnemyType.SHIELDED,
  EnemyType.SWARM
];

// Base values for endless wave generation — scaled by ENDLESS_CONFIG multipliers
const ENDLESS_BASE_COUNT = 10;
const ENDLESS_BASE_SPAWN_INTERVAL = 0.8;
const ENDLESS_BASE_REWARD = 200;
const ENDLESS_REWARD_SCALE_PER_WAVE = 50;
const ENDLESS_BOSS_COUNT = 1;
const ENDLESS_BOSS_SPAWN_INTERVAL = 0;

@Injectable()
export class WaveService {
  private waveDefinitions: WaveDefinition[] = WAVE_DEFINITIONS;
  private spawnQueues: SpawnQueue[] = [];
  private active = false;
  private currentWaveIndex = -1;
  private endlessMode = false;

  constructor(private enemyService: EnemyService) {}

  setEndlessMode(enabled: boolean): void {
    this.endlessMode = enabled;
  }

  isEndlessMode(): boolean {
    return this.endlessMode;
  }

  /**
   * Procedurally generates a WaveDefinition for endless waves (waveNumber > WAVE_DEFINITIONS.length).
   * waveNumber is the absolute wave number (e.g. 11, 12, ...).
   *
   * Scaling rules (all from ENDLESS_CONFIG — no magic numbers here):
   *   healthMultiplier  = baseHealthMultiplier + healthScalePerWave * (waveNumber - 1)
   *   speedMultiplier   = baseSpeedMultiplier  + speedScalePerWave  * (waveNumber - 1)
   *   countMultiplier   = baseCountMultiplier  + countScalePerWave  * (waveNumber - 1)
   * Boss wave: waveNumber % bossInterval === 0
   */
  generateEndlessWave(waveNumber: number): WaveDefinition {
    const healthMult =
      ENDLESS_CONFIG.baseHealthMultiplier +
      ENDLESS_CONFIG.healthScalePerWave * (waveNumber - 1);
    const speedMult =
      ENDLESS_CONFIG.baseSpeedMultiplier +
      ENDLESS_CONFIG.speedScalePerWave * (waveNumber - 1);
    const countMult =
      ENDLESS_CONFIG.baseCountMultiplier +
      ENDLESS_CONFIG.countScalePerWave * (waveNumber - 1);

    const isBossWave = waveNumber % ENDLESS_CONFIG.bossInterval === 0;

    // Cycle through enemy types so each endless wave has a different composition
    const cycleIndex = (waveNumber - 1) % ENDLESS_ENEMY_CYCLE.length;
    const primaryType = ENDLESS_ENEMY_CYCLE[cycleIndex];
    const secondaryType =
      ENDLESS_ENEMY_CYCLE[(cycleIndex + 1) % ENDLESS_ENEMY_CYCLE.length];

    const baseCount = Math.round(ENDLESS_BASE_COUNT * countMult);
    const primaryCount = Math.ceil(baseCount * 0.6);
    const secondaryCount = Math.floor(baseCount * 0.4);
    const spawnInterval = Math.max(
      0.3,
      ENDLESS_BASE_SPAWN_INTERVAL / speedMult
    );

    const entries: WaveEntry[] = [
      { type: primaryType, count: primaryCount, spawnInterval },
      { type: secondaryType, count: secondaryCount, spawnInterval: spawnInterval * 1.2 }
    ];

    if (isBossWave) {
      entries.unshift({
        type: EnemyType.BOSS,
        count: ENDLESS_BOSS_COUNT,
        spawnInterval: ENDLESS_BOSS_SPAWN_INTERVAL
      });
    }

    const reward =
      ENDLESS_BASE_REWARD + ENDLESS_REWARD_SCALE_PER_WAVE * (waveNumber - 1);

    return { entries, reward };
  }

  startWave(waveNumber: number, scene: THREE.Scene): void {
    const index = waveNumber - 1;

    let waveDef: WaveDefinition | undefined;

    if (index >= 0 && index < this.waveDefinitions.length) {
      // Normal wave from the static definitions
      this.currentWaveIndex = index;
      waveDef = this.waveDefinitions[this.currentWaveIndex];
    } else if (this.endlessMode && waveNumber > this.waveDefinitions.length) {
      // Endless wave — procedurally generated
      this.currentWaveIndex = index;
      waveDef = this.generateEndlessWave(waveNumber);
    } else {
      return;
    }

    this.spawnQueues = waveDef.entries.map(entry => ({
      type: entry.type,
      spawnInterval: entry.spawnInterval,
      remaining: entry.count,
      timeSinceLastSpawn: entry.spawnInterval // spawn first immediately
    }));

    this.active = true;
  }

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

  isSpawning(): boolean {
    return this.active;
  }

  getTotalEnemiesInWave(waveNumber: number): number {
    const index = waveNumber - 1;
    if (index < 0 || index >= this.waveDefinitions.length) return 0;
    return this.waveDefinitions[index].entries.reduce((sum, e) => sum + e.count, 0);
  }

  getWaveReward(waveNumber: number): number {
    const index = waveNumber - 1;
    if (index < 0 || index >= this.waveDefinitions.length) return 0;
    return this.waveDefinitions[index].reward;
  }

  getMaxWaves(): number {
    return this.waveDefinitions.length;
  }

  reset(): void {
    this.spawnQueues = [];
    this.active = false;
    this.currentWaveIndex = -1;
  }
}
