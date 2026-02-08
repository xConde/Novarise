import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { EnemyType } from '../models/enemy.model';
import { WaveDefinition, WAVE_DEFINITIONS } from '../models/wave.model';
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

  constructor(private enemyService: EnemyService) {}

  startWave(waveNumber: number, scene: THREE.Scene): void {
    const index = waveNumber - 1;
    if (index < 0 || index >= this.waveDefinitions.length) {
      return;
    }
    this.currentWaveIndex = index;

    const waveDef = this.waveDefinitions[this.currentWaveIndex];
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
