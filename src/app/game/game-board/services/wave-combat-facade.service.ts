import { Injectable } from '@angular/core';
import { GameStateService } from './game-state.service';
import { WaveService } from './wave.service';
import { CombatLoopService } from './combat-loop.service';
import { GameRenderService, CombatResultOutput } from './game-render.service';
import { CombatVFXService } from './combat-vfx.service';
import { ScreenShakeService } from './screen-shake.service';
import { AudioService } from './audio.service';
import { DeckService } from '../../../run/services/deck.service';
import { RelicService } from '../../../run/services/relic.service';
import { MinimapService } from './minimap.service';
import { GameNotificationService } from './game-notification.service';
import { SceneService } from './scene.service';
import { GamePhase } from '../models/game-state.model';
import { SCREEN_SHAKE_CONFIG } from '../constants/effects.constants';
import { EnemyService } from './enemy.service';
import { TowerCombatService } from './tower-combat.service';
import { StatusEffectService } from './status-effect.service';
import { GameStatsService } from './game-stats.service';
import { ChallengeTrackingService } from './challenge-tracking.service';
import { RunService } from '../../../run/services/run.service';
import { CardEffectService } from '../../../run/services/card-effect.service';
import { ItemService } from '../../../run/services/item.service';
import { RunStateFlagService } from '../../../run/services/run-state-flag.service';
import { EncounterCheckpointService } from '../../../run/services/encounter-checkpoint.service';
import { EncounterCheckpoint, CHECKPOINT_VERSION } from '../models/encounter-checkpoint.model';
import { WavePreviewService } from './wave-preview.service';
import { TurnHistoryService } from './turn-history.service';
import { TowerType } from '../models/tower.model';
import { PathMutationService } from './path-mutation.service';
import { ElevationService } from './elevation.service';
import { TowerGraphService } from './tower-graph.service';

/** Callbacks that WaveCombatFacadeService calls back into the component for concerns
 *  it cannot own (template-bound state, pending card state). */
export interface WaveCombatCallbacks {
  /** Called when a wave banner should be shown. */
  onWaveComplete: (wave: number, perfectWave: boolean) => void;
  /** Called when combat produces an output (achievements, challenges, reward). */
  onCombatResult: (output: CombatResultOutput) => void;
  /** Refresh challenge indicators and HUD highlights. */
  onRefreshUI: () => void;
  /** Returns true if a tower card is currently pending placement. */
  hasPendingCard: () => boolean;
  /** Cancel the pending card before resolving the turn. */
  cancelPendingCard: () => void;
  /** Cancel the whole placement mode (calls cancelPlacement in component). */
  cancelPlacement: () => void;
  /** True when the context has been lost or init failed (guard for endTurn). */
  isRenderingUnavailable: () => boolean;
}

/**
 * Facade that owns the wave-start and end-turn workflows extracted from
 * GameBoardComponent. Also holds the UI state for wave-clear banner and
 * wave-start pulse so templates can bind to it via the service reference.
 *
 * @Injectable() (not providedIn: 'root') — component-scoped.
 */
@Injectable()
export class WaveCombatFacadeService {
  // --- UI state (template-bound via service reference) ---

  /** Text shown in the "Wave X Clear!" banner. */
  waveClearMessage = '';
  /** Whether the wave-clear banner is visible. */
  showWaveClear = false;
  /** Briefly true when a new wave begins — drives the pulse animation on the wave counter. */
  waveStartPulse = false;
  /** Gold reward earned at the end of the most recent wave. */
  lastWaveReward = 0;
  /** Interest earned on banked gold at end of the most recent wave. */
  lastInterestEarned = 0;

  private waveClearTimerId: ReturnType<typeof setTimeout> | null = null;
  private waveStartPulseTimerId: ReturnType<typeof setTimeout> | null = null;

  private callbacks: WaveCombatCallbacks | null = null;

  constructor(
    private gameStateService: GameStateService,
    private waveService: WaveService,
    private combatLoopService: CombatLoopService,
    private gameRenderService: GameRenderService,
    private combatVFXService: CombatVFXService,
    private screenShakeService: ScreenShakeService,
    private audioService: AudioService,
    private deckService: DeckService,
    private relicService: RelicService,
    private minimapService: MinimapService,
    private notificationService: GameNotificationService,
    private sceneService: SceneService,
    private enemyService: EnemyService,
    private towerCombatService: TowerCombatService,
    private statusEffectService: StatusEffectService,
    private gameStatsService: GameStatsService,
    private challengeTrackingService: ChallengeTrackingService,
    private runService: RunService,
    private cardEffectService: CardEffectService,
    private itemService: ItemService,
    private runStateFlagService: RunStateFlagService,
    private encounterCheckpointService: EncounterCheckpointService,
    private wavePreviewService: WavePreviewService,
    private turnHistoryService: TurnHistoryService,
    private pathMutationService: PathMutationService,
    private elevationService: ElevationService,
    private towerGraphService: TowerGraphService,
  ) {}

  /** Register component callbacks. Call in ngOnInit before any wave interaction. */
  init(callbacks: WaveCombatCallbacks): void {
    this.callbacks = callbacks;
  }

  /** Clear timers. Call in ngOnDestroy. */
  cleanup(): void {
    if (this.waveClearTimerId !== null) {
      clearTimeout(this.waveClearTimerId);
      this.waveClearTimerId = null;
    }
    if (this.waveStartPulseTimerId !== null) {
      clearTimeout(this.waveStartPulseTimerId);
      this.waveStartPulseTimerId = null;
    }
    this.callbacks = null;
  }

  /** Show a centered "Wave X Clear!" banner for 2 seconds. */
  onWaveComplete(wave: number, perfectWave: boolean): void {
    this.waveClearMessage = perfectWave ? `Wave ${wave} Clear! Perfect!` : `Wave ${wave} Clear!`;
    this.showWaveClear = true;
    if (this.waveClearTimerId !== null) {
      clearTimeout(this.waveClearTimerId);
    }
    this.waveClearTimerId = setTimeout(() => {
      this.showWaveClear = false;
      this.waveClearTimerId = null;
    }, 2000);
  }

  /** Briefly pulse the wave counter in the HUD when a new wave begins. */
  triggerWaveStartPulse(): void {
    this.waveStartPulse = true;
    if (this.waveStartPulseTimerId !== null) {
      clearTimeout(this.waveStartPulseTimerId);
    }
    this.waveStartPulseTimerId = setTimeout(() => {
      this.waveStartPulse = false;
      this.waveStartPulseTimerId = null;
    }, 300);
  }

  startWave(): void {
    const state = this.gameStateService.getState();
    if (state.phase === GamePhase.COMBAT) return;
    if (state.phase === GamePhase.VICTORY || state.phase === GamePhase.DEFEAT) return;

    this.lastWaveReward = 0;
    this.lastInterestEarned = 0;
    this.combatLoopService.resetLeakState();
    this.relicService.resetWaveState();
    this.minimapService.show();

    this.gameStateService.startWave();

    // Discard previous hand and draw new wave hand only when startWave() successfully
    // transitioned to COMBAT. Skip on the very first wave (ngOnInit already drew the
    // opening hand) and when startWave() was a no-op.
    if (state.wave > 0 && this.gameStateService.getState().phase === GamePhase.COMBAT) {
      this.deckService.discardHand();
      this.deckService.drawForWave();
    }
    const modEffects = this.gameStateService.getModifierEffects();
    const waveCountMult = modEffects.waveCountMultiplier ?? 1;
    this.waveService.startWave(this.gameStateService.getState().wave, this.sceneService.getScene(), waveCountMult);

    this.audioService.playWaveStart();
    this.triggerWaveStartPulse();
  }

  /**
   * Advance combat by one discrete turn.
   *
   * Guards: only runs during COMBAT phase; aborts if a tower card is mid-placement
   * (pending card is first cancelled to refund energy). No-op during VICTORY/DEFEAT.
   */
  endTurn(): void {
    const state = this.gameStateService.getState();
    if (state.phase !== GamePhase.COMBAT) return;

    if (this.callbacks?.isRenderingUnavailable()) return;

    // If a tower card is waiting for tile placement, cancel it first so the
    // player doesn't accidentally lose the card by ending the turn.
    if (this.callbacks?.hasPendingCard()) {
      this.callbacks.cancelPlacement();
      return;
    }

    const result = this.combatLoopService.resolveTurn(
      this.sceneService.getScene(),
    );

    // Forward combat telemetry into the RECAP panel's turn-history buffer.
    // damageDealt covers tower fire + mortar-zone DoT; killsByTower carries
    // the per-(tower type, level) attribution. Lives / gold / cards-played
    // deltas are recorded by the component (it owns the external-state deltas).
    this.turnHistoryService.recordDamage(result.damageDealt);
    for (const entry of result.killsByTower) {
      if (entry.count <= 0) continue;
      const towerType = entry.type === 'dot' ? null : (entry.type as TowerType);
      for (let i = 0; i < entry.count; i++) {
        this.turnHistoryService.recordKillByTower(towerType, entry.level);
      }
    }

    // Expire mortar zone visuals whose turn count has elapsed.
    // Must run after resolveTurn so the turn counter has already advanced.
    this.combatVFXService.tickMortarZoneVisualsForTurn(
      this.combatLoopService.getTurnNumber(),
      this.sceneService.getScene(),
    );

    // Phase 5: resolution feedback — brief screen-shake punctuates the
    // discrete turn so the player feels *something* happened, even when no
    // enemies are damaged. Scales up if leaks or kills occurred.
    const shakeIntensity = result.exitCount > 0
      ? SCREEN_SHAKE_CONFIG.lifeLossIntensity
      : result.kills.length > 0 ? 0.08 : 0.04;
    const shakeDuration = result.exitCount > 0
      ? SCREEN_SHAKE_CONFIG.lifeLossDuration
      : 0.12;
    this.screenShakeService.trigger(shakeIntensity, shakeDuration);

    // Dispatch audio, kill particles, wave banner, achievement pop-ups.
    // deltaTime=0 because discrete turn resolution doesn't advance real time.
    const renderOutput = this.gameRenderService.processCombatResult(result, 0, performance.now());

    if (renderOutput.waveReward !== undefined) {
      this.lastWaveReward = renderOutput.waveReward;
      this.lastInterestEarned = renderOutput.interestEarned!;
    }
    if (renderOutput.waveCompleted) {
      this.towerCombatService.clearMortarZonesForWaveEnd(this.sceneService.getScene());
      this.onWaveComplete(renderOutput.waveCompleted.wave, renderOutput.waveCompleted.perfect);
    }

    this.callbacks?.onCombatResult(renderOutput);

    // Draw a new hand for the next player turn if combat continues.
    const postPhase = this.gameStateService.getState().phase;
    if (postPhase === GamePhase.COMBAT) {
      this.deckService.discardHand();
      this.deckService.drawForWave();
    }

    // Auto-save AFTER discard+draw so the checkpoint reflects the hand the player
    // will see on resume. On VICTORY/DEFEAT the save is skipped (checkpoint cleared).
    this.autoSaveCheckpoint();
  }

  private autoSaveCheckpoint(): void {
    try {
      const state = this.gameStateService.getState();
      if (state.phase === GamePhase.VICTORY || state.phase === GamePhase.DEFEAT) {
        this.encounterCheckpointService.clearCheckpoint();
        return;
      }

      const { enemies: serializedEnemies, enemyCounter } = this.enemyService.serializeEnemies();

      const checkpoint: EncounterCheckpoint = {
        version: CHECKPOINT_VERSION,
        timestamp: Date.now(),
        nodeId: this.runService.getCurrentEncounter()?.nodeId ?? '',
        encounterConfig: this.runService.getCurrentEncounter()!,
        rngState: this.runService.getRngState() ?? 0,
        deckRngState: this.deckService.getRngState() ?? undefined,
        gameState: this.gameStateService.serializeState(),
        turnNumber: this.combatLoopService.getTurnNumber(),
        leakedThisWave: this.combatLoopService.getLeakedThisWave(),
        towers: this.towerCombatService.serializeTowers(),
        mortarZones: this.towerCombatService.serializeMortarZones(),
        enemies: serializedEnemies,
        enemyCounter,
        statusEffects: this.statusEffectService.serializeEffects(),
        waveState: this.waveService.serializeState(),
        deckState: this.deckService.serializeState(),
        cardModifiers: this.cardEffectService.serializeModifiers(),
        relicFlags: this.relicService.serializeEncounterFlags(),
        gameStats: this.gameStatsService.serializeState(),
        challengeState: this.challengeTrackingService.serializeState(),
        wavePreview: this.wavePreviewService.serialize(),
        turnHistory: this.turnHistoryService.serialize(),
        itemInventory: this.itemService.serialize(),
        runStateFlags: this.runStateFlagService.serialize(),
        pathMutations: this.pathMutationService.serialize(),
        tileElevations: this.elevationService.serialize(),
        towerGraph: this.towerGraphService.serialize(),
      };

      this.encounterCheckpointService.saveCheckpoint(checkpoint);
    } catch {
      // Auto-save failures are non-fatal — swallow silently.
    }
  }
}
