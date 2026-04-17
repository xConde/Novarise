import { fakeAsync, tick } from '@angular/core/testing';
import { WaveCombatFacadeService, WaveCombatCallbacks } from './wave-combat-facade.service';
import { GameStateService } from './game-state.service';
import { WaveService } from './wave.service';
import { CombatLoopService } from './combat-loop.service';
import { GameRenderService } from './game-render.service';
import { CombatVFXService } from './combat-vfx.service';
import { ScreenShakeService } from './screen-shake.service';
import { AudioService } from './audio.service';
import { DeckService } from '../../../run/services/deck.service';
import { RelicService } from '../../../run/services/relic.service';
import { MinimapService } from './minimap.service';
import { GameNotificationService } from './game-notification.service';
import { SceneService } from './scene.service';
import { GamePhase } from '../models/game-state.model';
import { EnemyService } from './enemy.service';
import { TowerCombatService } from './tower-combat.service';
import { StatusEffectService } from './status-effect.service';
import { GameStatsService } from './game-stats.service';
import { ChallengeTrackingService } from './challenge-tracking.service';
import { RunService } from '../../../run/services/run.service';
import { CardEffectService } from '../../../run/services/card-effect.service';
import { ItemService } from '../../../run/services/item.service';
import { EncounterCheckpointService } from '../../../run/services/encounter-checkpoint.service';
import { WavePreviewService } from './wave-preview.service';
import { TurnHistoryService } from './turn-history.service';

function makeCallbacks(overrides: Partial<WaveCombatCallbacks> = {}): WaveCombatCallbacks {
  return {
    onWaveComplete: jasmine.createSpy('onWaveComplete'),
    onCombatResult: jasmine.createSpy('onCombatResult'),
    onRefreshUI: jasmine.createSpy('onRefreshUI'),
    hasPendingCard: jasmine.createSpy('hasPendingCard').and.returnValue(false),
    cancelPendingCard: jasmine.createSpy('cancelPendingCard'),
    cancelPlacement: jasmine.createSpy('cancelPlacement'),
    isRenderingUnavailable: jasmine.createSpy('isRenderingUnavailable').and.returnValue(false),
    ...overrides,
  };
}

describe('WaveCombatFacadeService', () => {
  let service: WaveCombatFacadeService;
  let gameStateService: jasmine.SpyObj<GameStateService>;
  let waveService: jasmine.SpyObj<WaveService>;
  let combatLoopService: jasmine.SpyObj<CombatLoopService>;
  let gameRenderService: jasmine.SpyObj<GameRenderService>;
  let combatVFXService: jasmine.SpyObj<CombatVFXService>;
  let screenShakeService: jasmine.SpyObj<ScreenShakeService>;
  let audioService: jasmine.SpyObj<AudioService>;
  let deckService: jasmine.SpyObj<DeckService>;
  let relicService: jasmine.SpyObj<RelicService>;
  let minimapService: jasmine.SpyObj<MinimapService>;
  let notificationService: jasmine.SpyObj<GameNotificationService>;
  let sceneService: jasmine.SpyObj<SceneService>;
  let enemyService: jasmine.SpyObj<EnemyService>;
  let towerCombatService: jasmine.SpyObj<TowerCombatService>;
  let statusEffectService: jasmine.SpyObj<StatusEffectService>;
  let gameStatsService: jasmine.SpyObj<GameStatsService>;
  let challengeTrackingService: jasmine.SpyObj<ChallengeTrackingService>;
  let runService: jasmine.SpyObj<RunService>;
  let cardEffectService: jasmine.SpyObj<CardEffectService>;
  let itemService: jasmine.SpyObj<ItemService>;
  let encounterCheckpointService: jasmine.SpyObj<EncounterCheckpointService>;
  let wavePreviewService: jasmine.SpyObj<WavePreviewService>;
  let turnHistoryService: jasmine.SpyObj<TurnHistoryService>;

  const defaultState = {
    phase: GamePhase.INTERMISSION,
    wave: 1,
    isEndless: false,
    gold: 100,
    lives: 20,
    isPaused: false,
    initialLives: 20,
    initialGold: 0,
    maxLives: 20,
    maxWaves: 10,
    elapsedTime: 0,
    difficulty: 'NORMAL' as const,
    activeModifiers: new Set(),
  } as unknown as ReturnType<GameStateService['getState']>;

  beforeEach(() => {
    gameStateService = jasmine.createSpyObj('GameStateService', ['getState', 'startWave', 'getModifierEffects', 'setAscensionModifierEffects', 'serializeState']);
    gameStateService.getState.and.returnValue({ ...defaultState });
    gameStateService.getModifierEffects.and.returnValue({});
    (gameStateService.serializeState as jasmine.Spy).and.returnValue({});

    waveService = jasmine.createSpyObj('WaveService', ['startWave', 'hasCustomWaves', 'getWaveDefinitions', 'serializeState']);
    waveService.hasCustomWaves.and.returnValue(false);
    (waveService.serializeState as jasmine.Spy).and.returnValue({});

    gameRenderService = jasmine.createSpyObj('GameRenderService', ['processCombatResult']);
    gameRenderService.processCombatResult.and.returnValue({});

    combatVFXService = jasmine.createSpyObj('CombatVFXService', ['tickMortarZoneVisualsForTurn']);
    screenShakeService = jasmine.createSpyObj('ScreenShakeService', ['trigger']);
    audioService = jasmine.createSpyObj('AudioService', ['playWaveStart']);

    deckService = jasmine.createSpyObj('DeckService', ['discardHand', 'drawForWave', 'serializeState', 'getRngState']);
    (deckService.serializeState as jasmine.Spy).and.returnValue({});
    (deckService.getRngState as jasmine.Spy).and.returnValue(null);
    relicService = jasmine.createSpyObj('RelicService', ['resetWaveState', 'serializeEncounterFlags']);
    minimapService = jasmine.createSpyObj('MinimapService', ['show']);
    notificationService = jasmine.createSpyObj('GameNotificationService', ['show']);
    sceneService = jasmine.createSpyObj('SceneService', ['getScene']);
    sceneService.getScene.and.returnValue({} as THREE.Scene);

    enemyService = jasmine.createSpyObj('EnemyService', ['serializeEnemies']);
    enemyService.serializeEnemies.and.returnValue({ enemies: [], enemyCounter: 0 });

    towerCombatService = jasmine.createSpyObj('TowerCombatService', ['serializeTowers', 'serializeMortarZones', 'clearMortarZonesForWaveEnd']);
    towerCombatService.serializeTowers.and.returnValue([]);
    towerCombatService.serializeMortarZones.and.returnValue([]);

    statusEffectService = jasmine.createSpyObj('StatusEffectService', ['serializeEffects']);
    statusEffectService.serializeEffects.and.returnValue([]);

    gameStatsService = jasmine.createSpyObj('GameStatsService', ['serializeState']);
    gameStatsService.serializeState.and.returnValue({
      totalGoldEarned: 0, totalDamageDealt: 0, shotsFired: 0, killsByTowerType: {}, enemiesLeaked: 0,
      towersPlaced: 0, towersSold: 0,
    });

    challengeTrackingService = jasmine.createSpyObj('ChallengeTrackingService', ['serializeState']);
    challengeTrackingService.serializeState.and.returnValue({
      totalGoldSpent: 0, maxTowersPlaced: 0, towerTypesUsed: [], currentTowerCount: 0, livesLostThisGame: 0,
    });

    runService = jasmine.createSpyObj('RunService', ['getCurrentEncounter', 'getRngState']);
    runService.getCurrentEncounter.and.returnValue(null);
    runService.getRngState.and.returnValue(null);

    cardEffectService = jasmine.createSpyObj('CardEffectService', ['serializeModifiers']);
    cardEffectService.serializeModifiers.and.returnValue([]);

    itemService = jasmine.createSpyObj('ItemService', ['serialize']);
    (itemService.serialize as jasmine.Spy).and.returnValue({ entries: [] });

    encounterCheckpointService = jasmine.createSpyObj('EncounterCheckpointService', ['saveCheckpoint', 'clearCheckpoint']);
    encounterCheckpointService.saveCheckpoint.and.returnValue(true);

    turnHistoryService = jasmine.createSpyObj<TurnHistoryService>('TurnHistoryService', [
      'beginTurn', 'endTurn', 'recordCardPlayed', 'recordKillByTower',
      'recordDamage', 'recordGoldEarned', 'recordLifeLost', 'getLastCompletedTurn', 'getRecords', 'reset',
      'serialize', 'restore',
    ]);
    turnHistoryService.serialize.and.returnValue([]);

    wavePreviewService = jasmine.createSpyObj('WavePreviewService', [
      'serialize', 'restore', 'addOneShotBonus', 'getPreviewDepth', 'getFutureWavesSummary', 'resetForEncounter',
    ]);
    wavePreviewService.serialize.and.returnValue({ oneShotBonus: 0 });

    combatLoopService = jasmine.createSpyObj('CombatLoopService', ['resetLeakState', 'resolveTurn', 'getTurnNumber', 'getLeakedThisWave']);
    combatLoopService.resolveTurn.and.returnValue({
      exitCount: 0,
      kills: [],
      firedTypes: [],
      hitCount: 0,
      damageDealt: 0,
      killsByTower: [],
      combatAudioEvents: [],
      defeatTriggered: false,
      waveCompletion: null,
      gameEnd: null,
    } as unknown as ReturnType<CombatLoopService['resolveTurn']>);
    combatLoopService.getTurnNumber.and.returnValue(0);
    combatLoopService.getLeakedThisWave.and.returnValue(false);

    service = new WaveCombatFacadeService(
      gameStateService,
      waveService,
      combatLoopService,
      gameRenderService,
      combatVFXService,
      screenShakeService,
      audioService,
      deckService,
      relicService,
      minimapService,
      notificationService,
      sceneService,
      enemyService,
      towerCombatService,
      statusEffectService,
      gameStatsService,
      challengeTrackingService,
      runService,
      cardEffectService,
      itemService,
      encounterCheckpointService,
      wavePreviewService,
      turnHistoryService,
    );
  });

  // Avoid fake import of THREE by using an empty object — SceneService is fully mocked
  // and getScene() never returns a real Three.js scene in these unit tests.

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initial state', () => {
    it('waveClearMessage is empty', () => {
      expect(service.waveClearMessage).toBe('');
    });

    it('showWaveClear is false', () => {
      expect(service.showWaveClear).toBe(false);
    });

    it('waveStartPulse is false', () => {
      expect(service.waveStartPulse).toBe(false);
    });

    it('lastWaveReward is 0', () => {
      expect(service.lastWaveReward).toBe(0);
    });

    it('lastInterestEarned is 0', () => {
      expect(service.lastInterestEarned).toBe(0);
    });
  });

  describe('onWaveComplete()', () => {
    it('sets waveClearMessage and shows banner', () => {
      service.onWaveComplete(3, false);
      expect(service.waveClearMessage).toBe('Wave 3 Clear!');
      expect(service.showWaveClear).toBe(true);
    });

    it('appends "Perfect!" for perfect waves', () => {
      service.onWaveComplete(2, true);
      expect(service.waveClearMessage).toBe('Wave 2 Clear! Perfect!');
    });

    it('auto-hides banner after 2000ms', fakeAsync(() => {
      service.onWaveComplete(1, false);
      expect(service.showWaveClear).toBe(true);
      tick(2000);
      expect(service.showWaveClear).toBe(false);
    }));

    it('resets existing timer when called again before expiry', fakeAsync(() => {
      service.onWaveComplete(1, false);
      tick(1000);
      service.onWaveComplete(2, false);
      tick(1999);
      expect(service.showWaveClear).toBe(true);
      tick(1);
      expect(service.showWaveClear).toBe(false);
    }));
  });

  describe('triggerWaveStartPulse()', () => {
    it('sets waveStartPulse to true', () => {
      service.triggerWaveStartPulse();
      expect(service.waveStartPulse).toBe(true);
    });

    it('auto-clears waveStartPulse after 300ms', fakeAsync(() => {
      service.triggerWaveStartPulse();
      tick(300);
      expect(service.waveStartPulse).toBe(false);
    }));
  });

  describe('startWave()', () => {
    it('is a no-op when phase is COMBAT', () => {
      gameStateService.getState.and.returnValue({ ...defaultState, phase: GamePhase.COMBAT });
      service.startWave();
      expect(gameStateService.startWave).not.toHaveBeenCalled();
    });

    it('is a no-op when phase is VICTORY', () => {
      gameStateService.getState.and.returnValue({ ...defaultState, phase: GamePhase.VICTORY });
      service.startWave();
      expect(gameStateService.startWave).not.toHaveBeenCalled();
    });

    it('is a no-op when phase is DEFEAT', () => {
      gameStateService.getState.and.returnValue({ ...defaultState, phase: GamePhase.DEFEAT });
      service.startWave();
      expect(gameStateService.startWave).not.toHaveBeenCalled();
    });

    it('calls gameStateService.startWave() when phase allows', () => {
      service.startWave();
      expect(gameStateService.startWave).toHaveBeenCalled();
    });

    it('resets lastWaveReward and lastInterestEarned', () => {
      service.lastWaveReward = 50;
      service.lastInterestEarned = 10;
      service.startWave();
      expect(service.lastWaveReward).toBe(0);
      expect(service.lastInterestEarned).toBe(0);
    });

    it('calls relicService.resetWaveState()', () => {
      service.startWave();
      expect(relicService.resetWaveState).toHaveBeenCalled();
    });

    it('calls minimapService.show()', () => {
      service.startWave();
      expect(minimapService.show).toHaveBeenCalled();
    });

    it('calls audioService.playWaveStart()', () => {
      service.startWave();
      expect(audioService.playWaveStart).toHaveBeenCalled();
    });

    it('does NOT discard hand on wave 0', () => {
      gameStateService.getState.and.returnValue({ ...defaultState, wave: 0 });
      service.startWave();
      expect(deckService.discardHand).not.toHaveBeenCalled();
    });

    it('discards and redraws hand when wave > 0 and startWave transitions to COMBAT', () => {
      // getState() is called three times: phase guard, post-startWave phase check, waveService.startWave arg.
      const combatState = { ...defaultState, wave: 1, phase: GamePhase.COMBAT };
      gameStateService.getState.and.returnValues(
        { ...defaultState, wave: 1, phase: GamePhase.INTERMISSION },
        combatState,
        combatState,
      );
      service.startWave();
      expect(deckService.discardHand).toHaveBeenCalled();
      expect(deckService.drawForWave).toHaveBeenCalled();
    });

    it('does NOT discard hand when startWave no-ops (phase stays non-COMBAT)', () => {
      // getState() three times: phase guard, post-startWave check, waveService.startWave arg.
      const intermissionState = { ...defaultState, wave: 1, phase: GamePhase.INTERMISSION };
      gameStateService.getState.and.returnValues(
        intermissionState,
        intermissionState,
        intermissionState,
      );
      service.startWave();
      expect(deckService.discardHand).not.toHaveBeenCalled();
      expect(deckService.drawForWave).not.toHaveBeenCalled();
    });
  });

  describe('endTurn()', () => {
    it('is a no-op when phase is not COMBAT', () => {
      gameStateService.getState.and.returnValue({ ...defaultState, phase: GamePhase.INTERMISSION });
      service.init(makeCallbacks());
      service.endTurn();
      expect(combatLoopService.resolveTurn).not.toHaveBeenCalled();
    });

    it('is a no-op when rendering is unavailable', () => {
      gameStateService.getState.and.returnValue({ ...defaultState, phase: GamePhase.COMBAT });
      service.init(makeCallbacks({ isRenderingUnavailable: () => true }));
      service.endTurn();
      expect(combatLoopService.resolveTurn).not.toHaveBeenCalled();
    });

    it('cancels placement and returns when a pending card exists', () => {
      gameStateService.getState.and.returnValue({ ...defaultState, phase: GamePhase.COMBAT });
      const callbacks = makeCallbacks({ hasPendingCard: () => true });
      service.init(callbacks);
      service.endTurn();
      expect(callbacks.cancelPlacement).toHaveBeenCalled();
      expect(combatLoopService.resolveTurn).not.toHaveBeenCalled();
    });

    it('calls resolveTurn when phase is COMBAT and no pending card', () => {
      gameStateService.getState.and.returnValue({ ...defaultState, phase: GamePhase.COMBAT });
      service.init(makeCallbacks());
      service.endTurn();
      expect(combatLoopService.resolveTurn).toHaveBeenCalled();
    });

    it('calls screenShakeService.trigger()', () => {
      gameStateService.getState.and.returnValue({ ...defaultState, phase: GamePhase.COMBAT });
      service.init(makeCallbacks());
      service.endTurn();
      expect(screenShakeService.trigger).toHaveBeenCalled();
    });

    it('updates lastWaveReward and lastInterestEarned from render output', () => {
      gameStateService.getState.and.returnValue({ ...defaultState, phase: GamePhase.COMBAT });
      gameRenderService.processCombatResult.and.returnValue({ waveReward: 75, interestEarned: 15 });
      service.init(makeCallbacks());
      service.endTurn();
      expect(service.lastWaveReward).toBe(75);
      expect(service.lastInterestEarned).toBe(15);
    });

    it('calls callbacks.onCombatResult with render output', () => {
      gameStateService.getState.and.returnValue({ ...defaultState, phase: GamePhase.COMBAT });
      const renderOutput = { waveReward: 50 };
      gameRenderService.processCombatResult.and.returnValue(renderOutput);
      const callbacks = makeCallbacks();
      service.init(callbacks);
      service.endTurn();
      expect(callbacks.onCombatResult).toHaveBeenCalledWith(renderOutput);
    });

    it('draws a new hand when combat continues after turn', () => {
      // First call returns COMBAT, second (post-turn check) also COMBAT
      let callCount = 0;
      gameStateService.getState.and.callFake(() => {
        callCount++;
        return { ...defaultState, phase: GamePhase.COMBAT };
      });
      service.init(makeCallbacks());
      service.endTurn();
      expect(deckService.discardHand).toHaveBeenCalled();
      expect(deckService.drawForWave).toHaveBeenCalled();
    });

    it('does NOT draw a new hand when combat ends after the turn', () => {
      let callCount = 0;
      gameStateService.getState.and.callFake(() => {
        callCount++;
        // First call (phase guard) is COMBAT; second (post-turn) is INTERMISSION
        return { ...defaultState, phase: callCount === 1 ? GamePhase.COMBAT : GamePhase.INTERMISSION };
      });
      service.init(makeCallbacks());
      service.endTurn();
      expect(deckService.discardHand).not.toHaveBeenCalled();
      expect(deckService.drawForWave).not.toHaveBeenCalled();
    });
  });

  describe('autoSaveCheckpoint call order', () => {
    it('calls autoSaveCheckpoint AFTER discardHand and drawForWave when combat continues', () => {
      const callOrder: string[] = [];
      (deckService.discardHand as jasmine.Spy).and.callFake(() => callOrder.push('discardHand'));
      (deckService.drawForWave as jasmine.Spy).and.callFake(() => callOrder.push('drawForWave'));
      (encounterCheckpointService.saveCheckpoint as jasmine.Spy).and.callFake(() => callOrder.push('saveCheckpoint'));

      gameStateService.getState.and.returnValue({ ...defaultState, phase: GamePhase.COMBAT });
      service.init(makeCallbacks());
      service.endTurn();

      const discardIdx = callOrder.indexOf('discardHand');
      const drawIdx = callOrder.indexOf('drawForWave');
      const saveIdx = callOrder.indexOf('saveCheckpoint');

      expect(discardIdx).toBeGreaterThanOrEqual(0);
      expect(drawIdx).toBeGreaterThanOrEqual(0);
      expect(saveIdx).toBeGreaterThan(discardIdx);
      expect(saveIdx).toBeGreaterThan(drawIdx);
    });

    it('still calls autoSaveCheckpoint when combat ends after the turn (no discard/draw)', () => {
      let callCount = 0;
      gameStateService.getState.and.callFake(() => {
        callCount++;
        return { ...defaultState, phase: callCount === 1 ? GamePhase.COMBAT : GamePhase.INTERMISSION };
      });
      service.init(makeCallbacks());
      service.endTurn();
      // Phase transitions to INTERMISSION so no discard/draw, but checkpoint save still fires
      expect(encounterCheckpointService.saveCheckpoint).toHaveBeenCalled();
      expect(deckService.discardHand).not.toHaveBeenCalled();
    });
  });

  describe('autoSaveCheckpoint — deckRngState', () => {
    it('includes deckRngState in saved checkpoint when getDeckRngState returns a value', fakeAsync(() => {
      (deckService.getRngState as jasmine.Spy).and.returnValue(55555);
      // endTurn() has a phase guard (COMBAT only) — use COMBAT so the save path runs
      gameStateService.getState.and.returnValue({ ...defaultState, phase: GamePhase.COMBAT });
      service.init(makeCallbacks());
      service.endTurn();

      expect(encounterCheckpointService.saveCheckpoint).toHaveBeenCalled();
      const saved = (encounterCheckpointService.saveCheckpoint as jasmine.Spy).calls.mostRecent().args[0];
      expect(saved.deckRngState).toBe(55555);
    }));

    it('includes deckRngState as undefined in saved checkpoint when getDeckRngState returns null', fakeAsync(() => {
      (deckService.getRngState as jasmine.Spy).and.returnValue(null);
      // endTurn() has a phase guard (COMBAT only) — use COMBAT so the save path runs
      gameStateService.getState.and.returnValue({ ...defaultState, phase: GamePhase.COMBAT });
      service.init(makeCallbacks());
      service.endTurn();

      expect(encounterCheckpointService.saveCheckpoint).toHaveBeenCalled();
      const saved = (encounterCheckpointService.saveCheckpoint as jasmine.Spy).calls.mostRecent().args[0];
      expect(saved.deckRngState).toBeUndefined();
    }));
  });

  describe('cleanup()', () => {
    it('clears the wave-clear timer', fakeAsync(() => {
      service.onWaveComplete(1, false);
      service.cleanup();
      tick(2000);
      // Banner stays in whatever state it was — key thing is no timer fires after cleanup
      expect((service as any).waveClearTimerId).toBeNull();
    }));

    it('clears the wave-start-pulse timer', fakeAsync(() => {
      service.triggerWaveStartPulse();
      service.cleanup();
      tick(300);
      expect((service as any).waveStartPulseTimerId).toBeNull();
    }));
  });
});

// Minimal import to satisfy jasmine.createSpyObj typing
import * as THREE from 'three';
