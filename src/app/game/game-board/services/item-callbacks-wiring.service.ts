import { Injectable } from '@angular/core';
import { ItemService } from '../../../run/services/item.service';
import { GameStateService } from './game-state.service';
import { EnemyService } from './enemy.service';
import { WaveService } from './wave.service';
import { DeckService } from '../../../run/services/deck.service';
import { RunService } from '../../../run/services/run.service';
import { NodeType, getNodeById } from '../../../run/models/node-map.model';

/**
 * ItemCallbacksWiringService — wires ItemService combat + run-level
 * callbacks against the live game-board services.
 *
 * Sprint 41 DI hierarchy trap (see decomposition plan): this service MUST
 * live in GameBoardComponent.providers (NOT providedIn: 'root') so that the
 * EnemyService / WaveService / GameStateService it captures are the SAME
 * component-scoped instances the rest of the encounter is using. Hoisting
 * to root would silently inject root-level (likely undefined) peers.
 *
 * Callers:
 *   - wire()   from GameBoardComponent.ngOnInit, after the basic service
 *              graph is constructed but before initFreshEncounter() /
 *              restoreFromCheckpoint() (which may trigger item effects).
 *   - unwire() from GameBoardComponent.ngOnDestroy.
 */
@Injectable()
export class ItemCallbacksWiringService {
  constructor(
    private itemService: ItemService,
    private gameStateService: GameStateService,
    private enemyService: EnemyService,
    private waveService: WaveService,
    private deckService: DeckService,
    private runService: RunService,
  ) {}

  wire(): void {
    this.itemService.registerCombatCallbacks(
      () => this.gameStateService.getState().phase,
      (damage: number) => {
        const enemies = [...this.enemyService.getEnemies().values()];
        const living = enemies.filter(e => !e.dying && e.health > 0);
        if (living.length === 0) return false;
        for (const enemy of living) {
          this.enemyService.damageEnemy(enemy.id, damage);
        }
        // Dead enemies are removed by the normal render loop's dying-animation
        // pass; no explicit scene removal needed here.
        return true;
      },
      (delta: number) => { this.gameStateService.addLives(delta); },
      () => {
        const state = this.gameStateService.getState();
        return { current: state.lives, max: state.maxLives };
      },
      (amount: number) => { this.deckService.addEnergy(amount); },
      () => { this.waveService.insertEmptyTurn(); },
      (multiplier: number) => { this.waveService.setNextWaveEnemySpeedMultiplier(multiplier); },
    );

    this.itemService.registerRunCallbacks(
      (amount: number) => { this.gameStateService.addGold(amount); },
      () => {
        const runState = this.runService.runState;
        const nodeMap = this.runService.nodeMap;
        if (!runState?.currentNodeId || !nodeMap) return false;
        const currentNode = getNodeById(nodeMap, runState.currentNodeId);
        return currentNode?.type === NodeType.SHOP;
      },
      () => { this.runService.generateShopItems(); },
    );
  }

  unwire(): void {
    this.itemService.unregisterCallbacks();
  }
}
