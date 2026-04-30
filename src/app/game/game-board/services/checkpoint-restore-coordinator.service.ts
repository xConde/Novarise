import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GameBoardService } from '../game-board.service';
import { SceneService } from './scene.service';
import { EnemyService } from './enemy.service';
import { GameStateService } from './game-state.service';
import { WaveService } from './wave.service';
import { TowerCombatService } from './tower-combat.service';
import { GameStatsService } from './game-stats.service';
import { StatusEffectService } from './status-effect.service';
import { ChallengeTrackingService } from './challenge-tracking.service';
import { GameSessionService } from './game-session.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { TowerMeshFactoryService } from './tower-mesh-factory.service';
import { EnemyMeshFactoryService } from './enemy-mesh-factory.service';
import { CombatLoopService } from './combat-loop.service';
import { ChallengeDisplayService } from './challenge-display.service';
import { AscensionModifierService } from './ascension-modifier.service';
import { TurnHistoryService } from './turn-history.service';
import { WavePreviewService } from './wave-preview.service';
import { PathMutationService } from './path-mutation.service';
import { ElevationService } from './elevation.service';
import { TowerGraphService } from './tower-graph.service';
import { SpawnPreviewViewService } from './spawn-preview-view.service';
import { ItemService } from '../../../run/services/item.service';
import { RunStateFlagService } from '../../../run/services/run-state-flag.service';
import { EncounterCheckpointService } from '../../../run/services/encounter-checkpoint.service';
import { RunService } from '../../../run/services/run.service';
import { RelicService } from '../../../run/services/relic.service';
import { CardEffectService } from '../../../run/services/card-effect.service';
import { DeckService } from '../../../run/services/deck.service';
import { BlockType } from '../models/game-board-tile';
import { GamePhase } from '../models/game-state.model';
import { BOARD_CONFIG } from '../constants/board.constants';
import { TowerUpgradeVisualService } from './tower-upgrade-visual.service';

export interface RestoreOptions {
  /**
   * Called when the checkpoint cannot be loaded or throws mid-restore.
   * Component owns the fallback so it can re-route through its own
   * lifecycle (e.g. invoke initFreshEncounter directly).
   */
  onFallback: () => void;
}

/**
 * CheckpointRestoreCoordinatorService — orchestrates the 18-step encounter
 * restore sequence formerly inlined as GameBoardComponent.restoreFromCheckpoint().
 *
 * The single most audit-sensitive method in the codebase. Every step
 * comment is load-bearing — copy verbatim, do not reorder, do not "clean
 * up". See decomposition plan Cluster 6.
 *
 * Step ordering (FROZEN):
 *   1.  Board tiles already rendered before this call.
 *   2.  Apply ascension modifier.
 *   2a. Restore run-level RNG.
 *   3.  Restore turn number BEFORE mortar zone expiry checks.
 *   3.5 Restore path mutations BEFORE towers + enemies (board state dep).
 *   3.6 Restore elevations AFTER mutations, BEFORE towers (tower Y dep).
 *   4.  Restore towers (with elevation Y fixup).
 *   4.5 Rebuild tower adjacency graph.
 *   4.6 Restore graph overlay state (v10+).
 *   5.  Restore mortar zones.
 *   6.  Restore enemies.
 *   7.  Restore status effects.
 *   8.  Update health bars.
 *   9.  Restore deck state. 9a: deck RNG (v4+).
 *   10. Restore card-effect modifiers.
 *   11. Restore game stats.
 *   12. Restore challenge tracking.
 *   13. Restore relic encounter flags.
 *   13a. Restore wave-preview one-shot bonus.
 *   13b. Restore RECAP buffer.
 *   13c. Restore item inventory (v4+).
 *   13d. Restore run-state flags (v5+).
 *   14. Restore wave state.
 *   15. setCustomWaves + setMaxWaves (phase-guarded — must precede phase flip).
 *   16. Restore combat-loop leakedThisWave flag.
 *   17. Restore game state LAST (flips phase → triggers UI subscribers).
 *   18. Seed wave preview for the restored phase.
 *
 * Component-scoped per the Sprint 41 hierarchy trap. Several of the
 * services it touches (PathMutationService, ElevationService,
 * TowerCombatService, EnemyService, etc.) are component-scoped — hoisting
 * this coordinator to root would inject mismatched peers.
 */
@Injectable()
export class CheckpointRestoreCoordinatorService {
  constructor(
    private encounterCheckpointService: EncounterCheckpointService,
    private runService: RunService,
    private sceneService: SceneService,
    private gameBoardService: GameBoardService,
    private gameStateService: GameStateService,
    private waveService: WaveService,
    private enemyService: EnemyService,
    private towerCombatService: TowerCombatService,
    private gameStatsService: GameStatsService,
    private statusEffectService: StatusEffectService,
    private challengeTrackingService: ChallengeTrackingService,
    private gameSessionService: GameSessionService,
    private meshRegistry: BoardMeshRegistryService,
    private towerMeshFactory: TowerMeshFactoryService,
    private enemyMeshFactory: EnemyMeshFactoryService,
    private combatLoopService: CombatLoopService,
    private challengeDisplayService: ChallengeDisplayService,
    private ascensionModifier: AscensionModifierService,
    private turnHistoryService: TurnHistoryService,
    private wavePreviewService: WavePreviewService,
    private pathMutationService: PathMutationService,
    private elevationService: ElevationService,
    private towerGraphService: TowerGraphService,
    private spawnPreview: SpawnPreviewViewService,
    private itemService: ItemService,
    private runStateFlagService: RunStateFlagService,
    private relicService: RelicService,
    private cardEffectService: CardEffectService,
    private deckService: DeckService,
    private towerUpgradeVisualService: TowerUpgradeVisualService,
  ) {}

  restore(options: RestoreOptions): void {
    const checkpoint = this.encounterCheckpointService.loadCheckpoint();
    if (!checkpoint) {
      // Checkpoint not found — fall back to fresh encounter initialization
      this.runService.isRestoringCheckpoint = false;
      options.onFallback();
      return;
    }

    try {
      const scene = this.sceneService.getScene();
      const encounter = checkpoint.encounterConfig;

      // Step 1: Board tiles already rendered (importBoard + renderGameBoard ran before this call)

      // Step 2: Apply ascension modifiers
      const runState = this.runService.runState;
      if (runState) {
        this.ascensionModifier.apply(runState.ascensionLevel, encounter.isElite, encounter.isBoss);
      }

      // Step 2a: Restore run-level RNG (safety net — RunService.restoreEncounter() already
      // calls setState when runRng is non-null, but after a page reload runRng may be null
      // until this call re-creates the instance from the saved state).
      this.runService.restoreRngState(checkpoint.rngState);

      // Step 3: Restore CombatLoopService turn number (before mortar zone expiry checks)
      this.combatLoopService.setTurnNumber(checkpoint.turnNumber);

      // Step 3.5: Restore path mutations BEFORE towers (towers can be placed on player-built
      // BASE tiles) and BEFORE enemies (their serialized paths assume the mutated board state).
      //
      // Restore ordering:
      //   a) restore() reloads the mutation journal + nextId counter (no tile/mesh side effects)
      //   b) Re-apply each mutation's tile data change to the freshly-imported board
      //   c) Swap the tile mesh to match the restored tile type
      //
      // The board was imported fresh from map data (Step 1), so tiles are at their
      // original pre-mutation state. We must re-apply each mutation in journal order
      // to get back to the mid-encounter board state.
      this.pathMutationService.restore(checkpoint.pathMutations);
      for (const mutation of checkpoint.pathMutations.mutations) {
        // Determine what type the tile should be AFTER this mutation.
        // op → target type mapping (mirrors PathMutationService.applyMutation):
        //   build → BASE, block → WALL, destroy → WALL, bridgehead → WALL
        const targetType =
          mutation.op === 'build' ? BlockType.BASE : BlockType.WALL;

        // Re-apply tile data (board starts fresh from importBoard)
        this.gameBoardService.setTileType(
          mutation.row,
          mutation.col,
          targetType,
          mutation.op,
          mutation.priorType,
        );

        // Swap the Three.js mesh to match restored tile type. Pass `mutation.op`
        // so swapMesh routes through TerraformMaterialPoolService for the
        // teal/amber/red/violet tint — without it, restored mutations render
        // as plain BASE/WALL tiles (Phase C sprint 30 red-team finding).
        this.pathMutationService.swapMesh(mutation.row, mutation.col, targetType, scene, mutation.op);
      }
      // Invalidate path cache once after all mutations are replayed
      if (checkpoint.pathMutations.mutations.length > 0) {
        this.enemyService.repathAffectedEnemies(-1, -1);
      }

      // Step 3.6: Restore tile elevations AFTER path mutations (mutations may have
      // changed BlockType; elevations compose on top of the current BlockType) and
      // BEFORE towers (tower Y is derived from tile elevation at placement time).
      //
      // Restore ordering:
      //   a) restore() reloads the elevation journal + nextId (no tile/mesh side effects)
      //   b) Re-apply each non-zero tile elevation to the board data
      //   c) Translate tile mesh Y to the restored elevation
      //
      // Does NOT invalidate pathfinding cache — elevation does not affect isTraversable.
      this.elevationService.restore(checkpoint.tileElevations);
      for (const entry of checkpoint.tileElevations.elevations) {
        this.gameBoardService.setTileElevation(entry.row, entry.col, entry.value);
        const newTileY = entry.value + BOARD_CONFIG.tileHeight / 2;
        this.meshRegistry.translateTileMesh(entry.row, entry.col, newTileY);
      }
      // Sprint 39: recreate cliff meshes for all restored elevated tiles.
      // elevationService.restore() only reloads the journal; cliff meshes (visual-only)
      // must be recreated separately since they are not serialized (derived from elevation).
      this.elevationService.restoreCliffMeshes(checkpoint.tileElevations.elevations);

      // Step 4: Restore towers — create meshes, register in TowerCombatService
      const towerMeshes = new Map<string, THREE.Group>();
      for (const tower of checkpoint.towers) {
        const mesh = this.towerMeshFactory.createTowerMesh(
          tower.row, tower.col, tower.type,
          this.gameBoardService.getBoardWidth(), this.gameBoardService.getBoardHeight()
        );
        // Tower factory always places the group at fixed tileHeight. If Step 3.6
        // restored the underlying tile to a non-zero elevation, translate the
        // tower group up so it sits on top of the raised tile instead of
        // clipping into the ground. Disposal-neutral — identity-stable mesh.
        const boardSnapshot = this.gameBoardService.getGameBoard();
        const tileElevation = boardSnapshot?.[tower.row]?.[tower.col]?.elevation ?? 0;
        if (tileElevation !== 0) {
          mesh.position.y = tileElevation + BOARD_CONFIG.tileHeight;
        }
        scene.add(mesh);
        this.meshRegistry.towerMeshes.set(tower.id, mesh);
        towerMeshes.set(tower.id, mesh);
        // Mark board tile as occupied — use forceSetTower to bypass BFS validation.
        // Placing towers one-by-one from a checkpoint would cause wouldBlockPath() to
        // reject valid positions before the full saved layout is restored.
        this.gameBoardService.forceSetTower(tower.row, tower.col, tower.type);
      }
      this.towerCombatService.restoreTowers(checkpoint.towers, towerMeshes);

      // Re-apply tier-part visibility + scale + emissive boost for towers above level 1.
      // Meshes are built at T1 defaults (tier-gated parts hidden). The combat-service
      // restore correctly sets each tower's level, but the mesh does not reflect it until
      // we call applyUpgradeVisuals here.
      for (const tower of checkpoint.towers) {
        if (tower.level > 1) {
          const mesh = towerMeshes.get(tower.id);
          if (mesh) {
            this.towerUpgradeVisualService.applyUpgradeVisuals(
              mesh, tower.level, tower.specialization,
            );
          }
        }
      }

      this.meshRegistry.rebuildTowerChildrenArray();

      // Step 4.5: Rebuild the tower adjacency graph from the restored placedTowers.
      // Graph is DERIVED state (not persisted) — restoreTowers repopulates the
      // source-of-truth map directly, bypassing the register/unregister hooks that
      // would normally keep the graph in sync. This single rebuild() consumes the
      // current `placedTowersGetter()` result and re-derives all 4-dir edges +
      // cluster membership. O(N × 4) lookups — well under 0.1ms for realistic
      // tower counts. See conduit-adjacency-graph.md §9 for the "graph state is
      // derived, not checkpointed" rationale.
      this.towerGraphService.rebuild();

      // Step 4.6: Restore graph overlay state (virtual edges + disruption entries).
      // v10 added — v9 checkpoints migrated to empty state by EncounterCheckpointService.
      // MUST run after rebuild() so keyToId is populated — restore() maps virtual-edge
      // coordinates to tower ids via that lookup.
      this.towerGraphService.restore(checkpoint.towerGraph);

      // Step 5: Restore mortar zones
      this.towerCombatService.restoreMortarZones(checkpoint.mortarZones);

      // Step 6: Restore enemies — create meshes, register in EnemyService
      const enemyMeshes = new Map<string, THREE.Mesh>();
      for (const enemy of checkpoint.enemies) {
        const tempEnemy = {
          ...enemy,
          path: enemy.path.map(n => ({ ...n, parent: undefined })),
          mesh: undefined,
          statusParticles: [],
          statusParticleEffectType: undefined,
        };
        const mesh = this.enemyMeshFactory.createEnemyMesh(tempEnemy as unknown as Parameters<typeof this.enemyMeshFactory.createEnemyMesh>[0]);
        scene.add(mesh);
        enemyMeshes.set(enemy.id, mesh);
      }
      this.enemyService.restoreEnemies(checkpoint.enemies, enemyMeshes, checkpoint.enemyCounter);

      // Step 7: Restore status effects
      this.statusEffectService.restoreEffects(checkpoint.statusEffects);

      // Step 8: Update health bars for restored enemies
      const camera = this.sceneService.getCamera();
      if (camera) {
        this.enemyService.updateHealthBars(camera.quaternion);
      }

      // Step 9: Restore deck state (piles, energy — NO reshuffle)
      this.deckService.restoreState(checkpoint.deckState);
      // Step 9a: Restore deck-level RNG so in-encounter reshuffles are deterministic.
      // Field is absent on pre-v4 checkpoints (migration sets it to undefined) — skip in that case.
      if (checkpoint.deckRngState !== undefined) {
        this.deckService.setRngState(checkpoint.deckRngState);
      }

      // Step 10: Restore card effect modifiers
      this.cardEffectService.restoreModifiers(checkpoint.cardModifiers);

      // Step 11: Restore game stats
      this.gameStatsService.restoreFromCheckpoint(checkpoint.gameStats);

      // Step 12: Restore challenge tracking
      this.challengeTrackingService.restoreFromCheckpoint(checkpoint.challengeState);

      // Step 13: Restore relic encounter flags
      this.relicService.restoreEncounterFlags(checkpoint.relicFlags);

      // Step 13c: Restore item (consumable) inventory. v4 checkpoints are
      // migrated to an empty inventory by EncounterCheckpointService.
      this.itemService.restore(checkpoint.itemInventory);

      // Step 13d: Restore run-state flags (cross-event memory). v5 checkpoints
      // are migrated to empty entries by EncounterCheckpointService.
      this.runStateFlagService.restore(checkpoint.runStateFlags);

      // Step 13a: Restore wave-preview one-shot bonus so mid-encounter scout
      // plays survive a save/resume. Pre-v2 checkpoints are migrated to a
      // zero-bonus default by EncounterCheckpointService before we get here.
      this.wavePreviewService.restore(checkpoint.wavePreview);

      // Step 13b: Restore RECAP buffer so the player sees their pre-quit
      // turn history. v2 checkpoints migrate to an empty array — silent, not
      // fatal.
      this.turnHistoryService.restore(checkpoint.turnHistory);

      // Step 14: Restore wave state (turnSchedule, index, seenTypes)
      this.waveService.restoreState(checkpoint.waveState);

      // Step 15: Set custom wave definitions and max-wave count BEFORE restoreFromCheckpoint.
      // GameStateService.setMaxWaves() has a phase guard (phase===SETUP && wave===0) — it must
      // run while phase is still SETUP (i.e., before the checkpoint's COMBAT/INTERMISSION
      // phase is applied). WaveService.setCustomWaves() must precede this for parity with the
      // fresh-encounter path, and also before phaseChange$ fires so subscribers see wave defs.
      this.waveService.setCustomWaves(encounter.waves);
      this.gameStateService.setMaxWaves(encounter.waves.length);

      // Step 16: Restore combat loop leaked flag
      this.combatLoopService.setLeakedThisWave(checkpoint.leakedThisWave);

      // Step 17: Restore game state LAST (sets phase → triggers UI subscription updates)
      this.gameStateService.restoreFromCheckpoint(checkpoint.gameState);

      // Step 18: Seed wave preview for the current restored state
      const state = this.gameStateService.getState();
      if (state.phase === GamePhase.INTERMISSION || state.phase === GamePhase.COMBAT) {
        this.spawnPreview.refreshFor(state);
      }

      // Clear restore flag and checkpoint storage
      this.runService.isRestoringCheckpoint = false;
      this.encounterCheckpointService.clearCheckpoint();
      this.challengeDisplayService.updateIndicators(encounter.campaignMapId ?? null);
    } catch (error) {
      console.error('Failed to restore checkpoint, falling back to fresh encounter:', error);
      this.runService.isRestoringCheckpoint = false;
      this.encounterCheckpointService.clearCheckpoint();
      // Clean up any partial restore state before starting fresh
      this.gameSessionService.resetAllServices(this.sceneService.getScene());
      options.onFallback();
    }
  }
}
