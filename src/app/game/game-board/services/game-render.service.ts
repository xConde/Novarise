import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { AudioService } from './audio.service';
import { FpsCounterService } from './fps-counter.service';
import { GameInputService } from './game-input.service';
import { SceneService } from './scene.service';
import { GameStateService } from './game-state.service';
import { EnemyService } from './enemy.service';
import { TowerAnimationService } from './tower-animation.service';
import { TowerCombatService } from './tower-combat.service';
import { ParticleService } from './particle.service';
import { GoldPopupService } from './gold-popup.service';
import { DamagePopupService } from './damage-popup.service';
import { ScreenShakeService } from './screen-shake.service';
import { CombatVFXService } from './combat-vfx.service';
import { StatusEffectService } from './status-effect.service';
import { MinimapService, MinimapTerrainData, MinimapBoardSnapshot } from './minimap.service';
import { GameNotificationService, NotificationType } from './game-notification.service';
import { CardEffectService } from '../../../run/services/card-effect.service';
import { GameBoardService } from '../game-board.service';
import { GamePhase } from '../models/game-state.model';
import { PHYSICS_CONFIG } from '../constants/physics.constants';
import { SCREEN_SHAKE_CONFIG } from '../constants/effects.constants';
import { CombatFrameResult } from '../models/combat-frame.model';
import type { ChallengeDefinition } from '../../../run/data/challenges';

/**
 * Output events from processCombatResult that the component must apply
 * to template-bound state. Everything else (audio, particles, health bars)
 * is handled internally by the service.
 */
export interface CombatResultOutput {
  waveReward?: number;
  interestEarned?: number;
  waveCompleted?: { wave: number; perfect: boolean };
  newAchievements?: string[];
  completedChallenges?: readonly ChallengeDefinition[];
}

@Injectable()
export class GameRenderService {
  // Render-loop state (moved from component)
  private animationFrameId = 0;
  private lastTime = 0;
  private defeatSoundPlayed = false;
  private victorySoundPlayed = false;
  /** Cached minimap terrain data — static after board setup, rebuilt on board import. */
  private cachedMinimapTerrain: MinimapTerrainData | null = null;
  /** Reusable tower position list for updateMinimap() — avoids per-frame array allocation. */
  private readonly minimapTowerPositions: { row: number; col: number }[] = [];
  /** Reusable enemy position list for updateMinimap() — avoids per-frame array allocation. */
  private readonly minimapEnemyPositions: { row: number; col: number }[] = [];

  // References to component-owned mesh maps (set during init)
  private tileMeshes!: Map<string, THREE.Mesh>;
  private towerMeshes!: Map<string, THREE.Group>;

  constructor(
    private audioService: AudioService,
    private fpsCounterService: FpsCounterService,
    private gameInput: GameInputService,
    private sceneService: SceneService,
    private gameStateService: GameStateService,
    private enemyService: EnemyService,
    private towerAnimationService: TowerAnimationService,
    private towerCombatService: TowerCombatService,
    private particleService: ParticleService,
    private goldPopupService: GoldPopupService,
    private damagePopupService: DamagePopupService,
    private screenShakeService: ScreenShakeService,
    private combatVFXService: CombatVFXService,
    private statusEffectService: StatusEffectService,
    private minimapService: MinimapService,
    private notificationService: GameNotificationService,
    private cardEffectService: CardEffectService,
    private gameBoardService: GameBoardService,
  ) {}

  /**
   * Initialize with component-owned mesh maps. Call in ngAfterViewInit.
   * Maps are passed by reference — the service always sees the latest state.
   */
  init(tileMeshes: Map<string, THREE.Mesh>, towerMeshes: Map<string, THREE.Group>): void {
    this.tileMeshes = tileMeshes;
    this.towerMeshes = towerMeshes;
  }

  startLoop(): void { this.animate(); }

  stopLoop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  /** Returns true if the animation loop is currently running. */
  get isLoopRunning(): boolean { return this.animationFrameId !== 0; }

  resetState(): void {
    this.defeatSoundPlayed = false;
    this.victorySoundPlayed = false;
    this.cachedMinimapTerrain = null;
    this.lastTime = 0;
  }

  /** Rebuild static terrain cache after board setup or board import. */
  rebuildMinimapTerrainCache(): void {
    this.buildMinimapTerrainCache();
  }

  private animate = (time = 0): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const rawDelta = this.lastTime === 0 ? 0 : (time - this.lastTime) / 1000;
    const deltaTime = Math.min(rawDelta, PHYSICS_CONFIG.maxDeltaTime);
    this.lastTime = time;

    // Reset per-frame SFX counters so throttle limits apply per animation frame
    this.audioService.resetFrameCounters();

    // FPS tracking
    this.fpsCounterService.tick(time);

    // Camera pan (WASD / arrows) — skip when paused to block all input
    const isPaused = this.gameStateService.getState().isPaused;
    const camera = this.sceneService.getCamera();
    const controls = this.sceneService.getControls();
    if (camera && controls && !isPaused) {
      this.gameInput.updateCameraPan(camera, controls);
    }

    if (controls && !isPaused) {
      controls.update();
    }

    // Ambient visuals (particles, skybox)
    this.sceneService.tickAmbientVisuals(time);

    // Phase 4: Turn-based combat — the physics loop is gone. The simulation only
    // advances when the player clicks "End Turn" (see endTurn() below). animate()
    // runs cosmetic visuals continuously so health bars, status particles, and
    // minimap stay responsive between turns.
    if (deltaTime > 0) {
      const state = this.gameStateService.getState();
      if (state.phase === GamePhase.COMBAT) {
        this.runPausedVisuals(deltaTime, time);
      }
    }

    // Animate tower idle effects and tile pulses
    this.towerAnimationService.updateTowerAnimations(this.towerMeshes, time);
    this.towerAnimationService.updateTilePulse(this.tileMeshes, time);
    this.towerAnimationService.updateMuzzleFlashes(this.towerCombatService.getPlacedTowers(), deltaTime);

    // Dying/hit/shield animations must run in ALL phases (not just COMBAT)
    // so enemies that die at the end of a wave finish their death animation
    // during INTERMISSION instead of freezing on the board.
    // Phase 4: runPausedVisuals runs on ALL COMBAT frames now (turn-based), so
    // skip COMBAT here to avoid double-tick.
    const combatHandledByCosmetic = deltaTime > 0
      && this.gameStateService.getState().phase === GamePhase.COMBAT;
    if (deltaTime > 0 && !combatHandledByCosmetic && this.enemyService.getEnemies().size > 0) {
      this.enemyService.updateDyingAnimations(deltaTime, this.sceneService.getScene());
      this.enemyService.updateHitFlashes(deltaTime);
      this.enemyService.updateShieldBreakAnimations(deltaTime);
    }

    // Update visual effects (run every frame regardless of pause)
    if (deltaTime > 0) {
      this.particleService.addPendingToScene(this.sceneService.getScene());
      this.particleService.update(deltaTime, this.sceneService.getScene());
      this.goldPopupService.update(deltaTime);
      this.damagePopupService.update(deltaTime);
      this.screenShakeService.update(deltaTime, this.sceneService.getCamera());
      this.combatVFXService.updateVisuals(this.sceneService.getScene());
    }

    // Render
    this.sceneService.render();
  }

  processCombatResult(result: CombatFrameResult, deltaTime: number, time: number): CombatResultOutput {
    const output: CombatResultOutput = {};

    // Defeat sound (play once per defeat)
    if (result.defeatTriggered && !this.defeatSoundPlayed) {
      this.defeatSoundPlayed = true;
      this.audioService.playDefeat();
      // Restore minimap if it was hidden during INTERMISSION on mobile
      if (window.innerWidth <= 480) {
        this.minimapService.show();
      }
    }

    // Wave completion events
    if (result.waveCompletion) {
      const wc = result.waveCompletion;
      if (wc.streakBonus > 0) {
        this.audioService.playStreakSound();
        this.notificationService.show(
          NotificationType.STREAK,
          'Perfect Wave!',
          `+${wc.streakBonus}g streak bonus (${wc.streakCount} waves)`
        );
      }
      if (wc.resultPhase === GamePhase.VICTORY && !this.victorySoundPlayed) {
        this.victorySoundPlayed = true;
        this.audioService.playVictory();
        // Expire card modifiers from the final wave and reset for clean state.
        this.cardEffectService.tickWave();
        this.cardEffectService.reset();
        // Restore minimap if it was hidden during INTERMISSION on mobile
        if (window.innerWidth <= 480) {
          this.minimapService.show();
        }
      } else if (wc.resultPhase === GamePhase.INTERMISSION) {
        this.audioService.playWaveClear();
        output.waveReward = wc.reward;
        output.interestEarned = wc.interestEarned;
        output.waveCompleted = { wave: this.gameStateService.getState().wave, perfect: wc.streakBonus > 0 };
        // Tick card modifier wave-countdowns.
        this.cardEffectService.tickWave();
        // Hide minimap during intermission on mobile — frees space for Next Wave button
        if (window.innerWidth <= 480) {
          this.minimapService.hide();
        }
      }
    }

    // Game end (achievements, challenges)
    if (result.gameEnd) {
      output.newAchievements = result.gameEnd.newlyUnlockedAchievements;
      output.completedChallenges = result.gameEnd.completedChallenges;
    }

    // Post-physics audio dispatch (tower fire sounds, hit sounds, kill sounds)
    for (const towerType of result.firedTypes) {
      this.audioService.playTowerFire(towerType);
    }
    if (result.hitCount > 0) {
      this.audioService.playEnemyHit();
    }
    for (const kill of result.kills) {
      this.audioService.playGoldEarned();
      this.audioService.playEnemyDeath();
      this.particleService.spawnDeathBurst(kill.position, kill.color);
      this.goldPopupService.spawn(kill.value, kill.position, this.sceneService.getScene());
      this.damagePopupService.spawn(kill.damage, kill.position, this.sceneService.getScene());
    }

    // Drain deferred combat audio events (chain lightning, mortar, etc.)
    for (const event of result.combatAudioEvents) {
      switch (event.type) {
        case 'sfx': this.audioService.playSfx(event.sfxKey); break;
        case 'tower_fire': this.audioService.playTowerFire(event.towerType); break;
        case 'enemy_hit': this.audioService.playEnemyHit(); break;
        case 'enemy_death': this.audioService.playEnemyDeath(); break;
      }
    }

    // Screen shake on life loss
    if (result.exitCount > 0) {
      this.screenShakeService.trigger(SCREEN_SHAKE_CONFIG.lifeLossIntensity, SCREEN_SHAKE_CONFIG.lifeLossDuration);
    }

    // Per-frame visual updates (health bars, status effects, minimap)
    // NOTE: dying/hit/shield animations are NOT called here — they run in the
    // phase-independent block in animate() (line ~2178) to avoid double-ticking.
    this.enemyService.updateHealthBars(this.sceneService.getCamera().quaternion);
    const activeEffects = this.statusEffectService.getAllActiveEffects();
    this.enemyService.updateStatusVisuals(activeEffects);
    this.enemyService.updateStatusEffectParticles(deltaTime, this.sceneService.getScene(), activeEffects);
    this.enemyService.updateEnemyAnimations(deltaTime);
    this.updateMinimap(time);

    return output;
  }

  /**
   * Run cosmetic-only visual updates during pause.
   * Physics, spawning, and movement are NOT ticked — only animations that
   * were already in-progress (death, hit flash, shield break) continue to play
   * so the scene doesn't look frozen.
   */
  runPausedVisuals(deltaTime: number, time: number): void {
    this.enemyService.updateDyingAnimations(deltaTime, this.sceneService.getScene());
    this.enemyService.updateHitFlashes(deltaTime);
    this.enemyService.updateShieldBreakAnimations(deltaTime);
    this.enemyService.updateHealthBars(this.sceneService.getCamera().quaternion);
    const activeEffects = this.statusEffectService.getAllActiveEffects();
    this.enemyService.updateStatusVisuals(activeEffects);
    this.enemyService.updateStatusEffectParticles(deltaTime, this.sceneService.getScene(), activeEffects);
    this.enemyService.updateEnemyAnimations(deltaTime);
    this.updateMinimap(time);
  }

  private updateMinimap(timeMs: number): void {
    // Ensure terrain cache is ready (fall back to building if not yet cached)
    if (!this.cachedMinimapTerrain) {
      this.buildMinimapTerrainCache();
    }

    // Build reusable position arrays — no per-frame allocation
    this.minimapTowerPositions.length = 0;
    this.towerCombatService.getPlacedTowers().forEach(tower => {
      this.minimapTowerPositions.push({ row: tower.row, col: tower.col });
    });
    this.minimapEnemyPositions.length = 0;
    this.enemyService.getEnemies().forEach(enemy => {
      this.minimapEnemyPositions.push({ row: enemy.gridPosition.row, col: enemy.gridPosition.col });
    });

    this.minimapService.updateWithEntities(timeMs, this.minimapTowerPositions, this.minimapEnemyPositions);
  }

  /** Builds and caches the static minimap terrain data after board setup. */
  private buildMinimapTerrainCache(): void {
    const snapshot: MinimapBoardSnapshot = {
      boardWidth: this.gameBoardService.getBoardWidth(),
      boardHeight: this.gameBoardService.getBoardHeight(),
      spawnerTiles: this.gameBoardService.getSpawnerTiles(),
      exitTiles: this.gameBoardService.getExitTiles(),
      getTileType: (row: number, col: number) => {
        const board = this.gameBoardService.getGameBoard();
        return board?.[row]?.[col]?.type;
      },
    };
    this.cachedMinimapTerrain = this.minimapService.buildTerrainCache(snapshot);
  }
}
