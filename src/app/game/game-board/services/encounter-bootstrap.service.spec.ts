import { EncounterBootstrapService } from './encounter-bootstrap.service';
import { GameBoardService } from '../game-board.service';
import { GameStateService } from './game-state.service';
import { WaveService } from './wave.service';
import { CombatLoopService } from './combat-loop.service';
import { ChallengeDisplayService } from './challenge-display.service';
import { GamePauseService } from './game-pause.service';
import { TutorialService } from '../../../core/services/tutorial.service';
import { AscensionModifierService } from './ascension-modifier.service';
import { WavePreviewService } from './wave-preview.service';
import { ElevationService } from './elevation.service';
import { SpawnPreviewViewService } from './spawn-preview-view.service';
import { WaveCombatFacadeService } from './wave-combat-facade.service';
import { DeckService } from '../../../run/services/deck.service';
import { RunService } from '../../../run/services/run.service';
import { RelicService } from '../../../run/services/relic.service';
import { CardEffectService } from '../../../run/services/card-effect.service';

describe('EncounterBootstrapService', () => {
  let gameBoardSpy: jasmine.SpyObj<GameBoardService>;
  let gameStateSpy: jasmine.SpyObj<GameStateService>;
  let waveSpy: jasmine.SpyObj<WaveService>;
  let combatLoopSpy: jasmine.SpyObj<CombatLoopService>;
  let challengeDisplaySpy: jasmine.SpyObj<ChallengeDisplayService>;
  let gamePauseSpy: jasmine.SpyObj<GamePauseService>;
  let tutorialSpy: jasmine.SpyObj<TutorialService>;
  let ascensionSpy: jasmine.SpyObj<AscensionModifierService>;
  let wavePreviewSpy: jasmine.SpyObj<WavePreviewService>;
  let spawnPreviewSpy: jasmine.SpyObj<SpawnPreviewViewService>;
  let waveCombatSpy: jasmine.SpyObj<WaveCombatFacadeService>;
  let elevationSpy: jasmine.SpyObj<ElevationService>;
  let runSpy: jasmine.SpyObj<RunService>;
  let relicSpy: jasmine.SpyObj<RelicService>;
  let deckSpy: jasmine.SpyObj<DeckService>;
  let cardEffectSpy: jasmine.SpyObj<CardEffectService>;
  let service: EncounterBootstrapService;

  function makeEncounter(overrides: Partial<{
    waves: unknown[];
    isElite: boolean;
    isBoss: boolean;
    campaignMapId: string | null;
  }> = {}) {
    return {
      waves: [{}, {}, {}],
      isElite: false,
      isBoss: false,
      campaignMapId: 'forest',
      ...overrides,
    };
  }

  function makeRunState(overrides: Partial<{ lives: number; maxLives: number; ascensionLevel: number }> = {}) {
    return { lives: 20, maxLives: 20, ascensionLevel: 0, ...overrides };
  }

  beforeEach(() => {
    gameBoardSpy = jasmine.createSpyObj<GameBoardService>('GameBoardService', ['getGameBoard']);
    gameBoardSpy.getGameBoard.and.returnValue([]);
    gameStateSpy = jasmine.createSpyObj<GameStateService>('GameStateService', [
      'setInitialLives', 'addGold', 'snapshotInitialGold', 'setMaxWaves', 'getState',
    ]);
    gameStateSpy.getState.and.returnValue({ wave: 0, isEndless: false } as ReturnType<GameStateService['getState']>);
    waveSpy = jasmine.createSpyObj<WaveService>('WaveService', ['setCustomWaves']);
    combatLoopSpy = jasmine.createSpyObj<CombatLoopService>('CombatLoopService', ['reset']);
    challengeDisplaySpy = jasmine.createSpyObj<ChallengeDisplayService>(
      'ChallengeDisplayService', ['updateIndicators'], { indicators: [] },
    );
    challengeDisplaySpy.updateIndicators.and.returnValue([]);
    gamePauseSpy = jasmine.createSpyObj<GamePauseService>('GamePauseService', ['reset']);
    tutorialSpy = jasmine.createSpyObj<TutorialService>('TutorialService', ['dismissOnPlayerAction']);
    ascensionSpy = jasmine.createSpyObj<AscensionModifierService>('AscensionModifierService', ['apply']);
    wavePreviewSpy = jasmine.createSpyObj<WavePreviewService>('WavePreviewService', ['resetForEncounter']);
    spawnPreviewSpy = jasmine.createSpyObj<SpawnPreviewViewService>('SpawnPreviewViewService', ['refreshFor']);
    waveCombatSpy = jasmine.createSpyObj<WaveCombatFacadeService>('WaveCombatFacadeService', ['startWave']);
    elevationSpy = jasmine.createSpyObj<ElevationService>('ElevationService', ['setAbsolute']);
    runSpy = jasmine.createSpyObj<RunService>(
      'RunService',
      ['getCurrentEncounter', 'isInRun', 'nextRandom'],
      { runState: null },
    );
    relicSpy = jasmine.createSpyObj<RelicService>(
      'RelicService',
      ['getMaxLivesBonus', 'getStartingGoldBonus', 'hasSurveyorRod'],
    );
    relicSpy.getMaxLivesBonus.and.returnValue(0);
    relicSpy.getStartingGoldBonus.and.returnValue(0);
    relicSpy.hasSurveyorRod.and.returnValue(false);
    deckSpy = jasmine.createSpyObj<DeckService>('DeckService', ['resetForEncounter', 'drawForWave']);
    cardEffectSpy = jasmine.createSpyObj<CardEffectService>('CardEffectService', ['reset']);

    service = new EncounterBootstrapService(
      gameBoardSpy, gameStateSpy, waveSpy, combatLoopSpy, challengeDisplaySpy,
      gamePauseSpy, tutorialSpy, ascensionSpy, wavePreviewSpy, spawnPreviewSpy,
      waveCombatSpy, elevationSpy, runSpy, relicSpy, deckSpy, cardEffectSpy,
    );
  });

  it('returns empty indicators and short-circuits when no encounter is active', () => {
    runSpy.getCurrentEncounter.and.returnValue(null);
    const result = service.bootstrapFresh();
    expect(result).toEqual([]);
    expect(gameStateSpy.setInitialLives).not.toHaveBeenCalled();
    expect(deckSpy.resetForEncounter).not.toHaveBeenCalled();
  });

  it('short-circuits when encounter exists but runState is null', () => {
    runSpy.getCurrentEncounter.and.returnValue(makeEncounter() as ReturnType<RunService['getCurrentEncounter']>);
    Object.defineProperty(runSpy, 'runState', { value: null });
    service.bootstrapFresh();
    expect(gameStateSpy.setInitialLives).not.toHaveBeenCalled();
  });

  describe('with active encounter and runState', () => {
    beforeEach(() => {
      runSpy.getCurrentEncounter.and.returnValue(
        makeEncounter() as ReturnType<RunService['getCurrentEncounter']>,
      );
      Object.defineProperty(runSpy, 'runState', { value: makeRunState() });
    });

    it('applies relic bonuses on top of base lives + gold', () => {
      relicSpy.getMaxLivesBonus.and.returnValue(2);
      relicSpy.getStartingGoldBonus.and.returnValue(50);
      service.bootstrapFresh();
      expect(gameStateSpy.setInitialLives).toHaveBeenCalledWith(20, 22);
      expect(gameStateSpy.addGold).toHaveBeenCalledWith(50);
      expect(gameStateSpy.snapshotInitialGold).toHaveBeenCalled();
    });

    it('sets custom waves and maxWaves to encounter wave count', () => {
      service.bootstrapFresh();
      expect(waveSpy.setCustomWaves).toHaveBeenCalled();
      expect(gameStateSpy.setMaxWaves).toHaveBeenCalledWith(3);
    });

    it('applies ascension modifier with elite + boss flags', () => {
      runSpy.getCurrentEncounter.and.returnValue(
        makeEncounter({ isElite: true, isBoss: true }) as ReturnType<RunService['getCurrentEncounter']>,
      );
      Object.defineProperty(runSpy, 'runState', { value: makeRunState({ ascensionLevel: 5 }) });
      service.bootstrapFresh();
      expect(ascensionSpy.apply).toHaveBeenCalledWith(5, true, true);
    });

    it('updates challenge indicators with the campaign map id', () => {
      service.bootstrapFresh();
      expect(challengeDisplaySpy.updateIndicators).toHaveBeenCalledWith('forest');
    });

    it('passes null campaignMapId when encounter has no campaign id', () => {
      runSpy.getCurrentEncounter.and.returnValue(
        makeEncounter({ campaignMapId: null }) as ReturnType<RunService['getCurrentEncounter']>,
      );
      service.bootstrapFresh();
      expect(challengeDisplaySpy.updateIndicators).toHaveBeenCalledWith(null);
    });

    it('resets card-effect state and combat-loop state', () => {
      service.bootstrapFresh();
      expect(cardEffectSpy.reset).toHaveBeenCalled();
      expect(combatLoopSpy.reset).toHaveBeenCalled();
    });

    it('skips SURVEYOR_ROD setup when relic is inactive', () => {
      service.bootstrapFresh();
      expect(elevationSpy.setAbsolute).not.toHaveBeenCalled();
    });

    it('runs SURVEYOR_ROD elevation pass when relic is active', () => {
      relicSpy.hasSurveyorRod.and.returnValue(true);
      // Build an 8x8 board of plain tiles (more than 5 candidates so we can place 5).
      const board: Array<Array<{ type: number; elevation: number }>> = [];
      for (let r = 0; r < 8; r++) {
        const row: Array<{ type: number; elevation: number }> = [];
        for (let c = 0; c < 8; c++) row.push({ type: 0, elevation: 0 });
        board.push(row);
      }
      gameBoardSpy.getGameBoard.and.returnValue(board as unknown as ReturnType<GameBoardService['getGameBoard']>);
      elevationSpy.setAbsolute.and.returnValue({ ok: true } as ReturnType<ElevationService['setAbsolute']>);
      runSpy.nextRandom.and.returnValue(0.5);
      service.bootstrapFresh();
      // SURVEYOR_ROD_TILE_COUNT = 5
      expect(elevationSpy.setAbsolute).toHaveBeenCalledTimes(5);
    });

    it('resets wave-preview, pause, deck, and seeds spawn preview', () => {
      service.bootstrapFresh();
      expect(wavePreviewSpy.resetForEncounter).toHaveBeenCalled();
      expect(gamePauseSpy.reset).toHaveBeenCalled();
      expect(deckSpy.resetForEncounter).toHaveBeenCalled();
      expect(deckSpy.drawForWave).toHaveBeenCalled();
      expect(spawnPreviewSpy.refreshFor).toHaveBeenCalled();
    });

    it('starts the first wave and dismisses tutorial when in run', () => {
      runSpy.isInRun.and.returnValue(true);
      service.bootstrapFresh();
      expect(tutorialSpy.dismissOnPlayerAction).toHaveBeenCalled();
      expect(waveCombatSpy.startWave).toHaveBeenCalled();
    });

    it('does not start the first wave when not in a run', () => {
      runSpy.isInRun.and.returnValue(false);
      service.bootstrapFresh();
      expect(waveCombatSpy.startWave).not.toHaveBeenCalled();
    });
  });
});
