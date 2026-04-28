import { Injectable } from '@angular/core';
import { GameBoardService } from '../game-board.service';
import { GameStateService } from './game-state.service';
import { WaveService } from './wave.service';
import { CombatLoopService } from './combat-loop.service';
import { ChallengeDisplayService } from './challenge-display.service';
import { ChallengeIndicator } from '../components/game-hud/game-hud.component';
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
import { ELEVATION_CONFIG } from '../constants/elevation.constants';
import { BlockType } from '../models/game-board-tile';
import { shuffleInPlace } from '../utils/coordinate-utils';

/**
 * EncounterBootstrapService — orchestrates the fresh-encounter setup
 * sequence formerly inlined as GameBoardComponent.initFreshEncounter().
 * Called on the normal (non-restore) path and as the fallback when
 * checkpoint loading fails.
 *
 * The ordering below is LOAD-BEARING — every comment encodes a past bug.
 * Do not reorder steps. See decomposition plan Cluster 5.
 *
 * Component-scoped (provided in GameBoardComponent.providers) because the
 * peers it injects (WaveService, CombatLoopService, ElevationService,
 * GameBoardService, etc.) are component-scoped. Hoisting to root would
 * silently inject undefined / different peers (Sprint 41 hierarchy trap).
 */
@Injectable()
export class EncounterBootstrapService {
  constructor(
    private gameBoardService: GameBoardService,
    private gameStateService: GameStateService,
    private waveService: WaveService,
    private combatLoopService: CombatLoopService,
    private challengeDisplayService: ChallengeDisplayService,
    private gamePauseService: GamePauseService,
    private tutorialService: TutorialService,
    private ascensionModifier: AscensionModifierService,
    private wavePreviewService: WavePreviewService,
    private spawnPreview: SpawnPreviewViewService,
    private waveCombat: WaveCombatFacadeService,
    private elevationService: ElevationService,
    private runService: RunService,
    private relicService: RelicService,
    private deckService: DeckService,
    private cardEffectService: CardEffectService,
  ) {}

  /**
   * Apply run encounter configuration and start the first wave.
   * Returns the up-to-date challenge indicators so the component getter
   * stays in sync (mirrors the prior updateChallengeIndicators() side
   * effect). Returns an empty array when no encounter is active.
   */
  bootstrapFresh(): ChallengeIndicator[] {
    const encounter = this.runService.getCurrentEncounter();
    const runState = this.runService.runState;
    if (!encounter || !runState) return [];

    this.gameStateService.setInitialLives(
      runState.lives,
      runState.maxLives + this.relicService.getMaxLivesBonus(),
    );
    this.gameStateService.addGold(this.relicService.getStartingGoldBonus());
    this.gameStateService.snapshotInitialGold();
    this.waveService.setCustomWaves(encounter.waves);
    this.gameStateService.setMaxWaves(encounter.waves.length);
    this.ascensionModifier.apply(runState.ascensionLevel, encounter.isElite, encounter.isBoss);

    this.challengeDisplayService.updateIndicators(encounter.campaignMapId ?? null);

    // Reset card modifier state from any previous encounter (root-scoped service
    // survives route transitions — must be explicitly cleared between encounters).
    this.cardEffectService.reset();

    // Reset turn counter + leak flag + frame buffers. Without this the
    // turnNumber persists from the prior encounter (the audit that caught
    // this noted: SPEED_RUN challenges would instantly fail from encounter 2
    // onward because turnsUsed was cumulative).
    this.combatLoopService.reset();

    // Sprint 36 SURVEYOR_ROD — pre-place elevated tiles at encounter start.
    // Board is already imported and rendered before bootstrapFresh() fires,
    // so tiles are valid. ElevationService.reset() ran in resetAllServices()
    // before this point — the board is clean. Uses runService.nextRandom().
    if (this.relicService.hasSurveyorRod()) {
      this.applySurveyorRodEffect();
    }

    // Reset one-shot scout bonuses so a previous encounter's SCOUT_AHEAD does
    // not leak preview depth into this one. (Permanent SCOUTING_LENS bonus
    // stays because it reads live from RelicService.)
    this.wavePreviewService.resetForEncounter();

    // Reset pause-state flags so a prior encounter's autoPaused /
    // showQuitConfirm doesn't bleed through into this encounter's pause UI.
    this.gamePauseService.reset();

    // Initialize deck for this encounter and draw the opening hand
    this.deckService.resetForEncounter();
    this.deckService.drawForWave();

    // Seed initial wave preview (after setCustomWaves applies waves)
    this.spawnPreview.refreshFor(this.gameStateService.getState());

    if (this.runService.isInRun()) {
      // Starting a wave counts as the START_WAVE tutorial step by definition.
      this.tutorialService.dismissOnPlayerAction();
      this.waveCombat.startWave();
    }

    return this.challengeDisplayService.indicators;
  }

  /**
   * Sprint 36 SURVEYOR_ROD — pre-place SURVEYOR_ROD_TILE_COUNT (5) tiles at
   * elevation +1 at encounter start. Uses runService.nextRandom() — no Math.random().
   *
   * Candidate tiles: any tile that is not SPAWNER or EXIT, currently at elevation 0,
   * and not already occupied by something that would reject elevation (guard is in
   * ElevationService.setAbsolute → validate). Iterates until 5 placements succeed
   * or all candidates are exhausted — never crashes on pathological boards.
   */
  private applySurveyorRodEffect(): void {
    const board = this.gameBoardService.getGameBoard();
    const candidates: Array<{ row: number; col: number }> = [];
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        const tile = board[row][col];
        if (tile.type === BlockType.SPAWNER || tile.type === BlockType.EXIT) continue;
        const elevation = tile.elevation ?? 0;
        if (elevation !== 0) continue; // skip already-elevated tiles
        candidates.push({ row, col });
      }
    }

    let placed = 0;
    // Fisher-Yates shuffle using runService.nextRandom() for determinism.
    shuffleInPlace(candidates, () => this.runService.nextRandom());

    for (const { row, col } of candidates) {
      if (placed >= ELEVATION_CONFIG.SURVEYOR_ROD_TILE_COUNT) break;
      const result = this.elevationService.setAbsolute(
        row, col, ELEVATION_CONFIG.SURVEYOR_ROD_ELEVATION_AMOUNT,
        'surveyor-rod', 0, 'relic',
      );
      if (result.ok) placed++;
    }
  }
}
