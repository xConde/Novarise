import { Injectable } from '@angular/core';
import * as THREE from 'three';

import { GameStateService } from './game-state.service';
import { WaveService } from './wave.service';
import { EnemyService } from './enemy.service';
import { GameStatsService } from './game-stats.service';
import { GameNotificationService } from './game-notification.service';
import { ChallengeTrackingService } from './challenge-tracking.service';
import { GameEndService } from './game-end.service';
import { StatusEffectService } from './status-effect.service';
import { MapBridgeService } from '@core/services/map-bridge.service';
import { TutorialService } from '@core/services/tutorial.service';
import { PlayerProfileService } from '@core/services/player-profile.service';
import { CAMPAIGN_WAVE_DEFINITIONS } from '@campaign/waves/campaign-waves';

/**
 * Orchestrates game-level lifecycle: service resets on restart and campaign wave wiring.
 * Component-scoped — provided in GameModule alongside the other game services.
 */
@Injectable()
export class GameSessionService {
  constructor(
    private gameStateService: GameStateService,
    private waveService: WaveService,
    private enemyService: EnemyService,
    private gameStatsService: GameStatsService,
    private gameNotificationService: GameNotificationService,
    private challengeTrackingService: ChallengeTrackingService,
    private gameEndService: GameEndService,
    private statusEffectService: StatusEffectService,
    private mapBridge: MapBridgeService,
    private tutorialService: TutorialService,
    private playerProfileService: PlayerProfileService,
  ) {}

  /**
   * Reset all game services to their initial state.
   * Called by restartGame() and playNextLevel().
   * scene parameter is needed for EnemyService which removes Three.js objects.
   */
  resetAllServices(scene: THREE.Scene): void {
    this.enemyService.reset(scene);
    this.waveService.reset();
    this.gameStateService.reset();
    this.gameStatsService.reset();
    this.gameEndService.reset();
    this.gameNotificationService.clear();
    this.challengeTrackingService.reset();
    this.statusEffectService.cleanup();
    this.tutorialService.resetCurrentStep();
    this.playerProfileService.resetSession();
  }

  /**
   * Load campaign wave definitions for the current map into WaveService and GameStateService.
   * No-op for non-campaign maps (standard 10-wave gameplay is unchanged).
   * Must be called after waveService.reset() — reset clears custom wave definitions.
   */
  applyCampaignWaves(): void {
    const mapId = this.mapBridge.getMapId();
    if (!mapId?.startsWith('campaign_')) return;

    const waves = CAMPAIGN_WAVE_DEFINITIONS[mapId];
    if (!waves) return;

    this.waveService.setCustomWaves(waves);
    this.gameStateService.setMaxWaves(waves.length);
  }
}
