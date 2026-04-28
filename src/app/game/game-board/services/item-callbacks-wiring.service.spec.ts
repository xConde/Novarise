import { ItemCallbacksWiringService } from './item-callbacks-wiring.service';
import { ItemService } from '../../../run/services/item.service';
import { GameStateService } from './game-state.service';
import { EnemyService } from './enemy.service';
import { WaveService } from './wave.service';
import { DeckService } from '../../../run/services/deck.service';
import { RunService } from '../../../run/services/run.service';
import { NodeType } from '../../../run/models/node-map.model';
import { GamePhase } from '../models/game-state.model';

interface FakeEnemy {
  id: string;
  health: number;
  dying: boolean;
}

describe('ItemCallbacksWiringService', () => {
  let itemSpy: jasmine.SpyObj<ItemService>;
  let gameStateSpy: jasmine.SpyObj<GameStateService>;
  let enemySpy: jasmine.SpyObj<EnemyService>;
  let waveSpy: jasmine.SpyObj<WaveService>;
  let deckSpy: jasmine.SpyObj<DeckService>;
  let runSpy: jasmine.SpyObj<RunService>;
  let service: ItemCallbacksWiringService;

  beforeEach(() => {
    itemSpy = jasmine.createSpyObj<ItemService>('ItemService', [
      'registerCombatCallbacks', 'registerRunCallbacks', 'unregisterCallbacks',
    ]);
    gameStateSpy = jasmine.createSpyObj<GameStateService>(
      'GameStateService', ['getState', 'addLives', 'addGold'],
    );
    enemySpy = jasmine.createSpyObj<EnemyService>(
      'EnemyService', ['getEnemies', 'damageEnemy'],
    );
    waveSpy = jasmine.createSpyObj<WaveService>(
      'WaveService', ['insertEmptyTurn', 'setNextWaveEnemySpeedMultiplier'],
    );
    deckSpy = jasmine.createSpyObj<DeckService>('DeckService', ['addEnergy']);
    runSpy = jasmine.createSpyObj<RunService>(
      'RunService', ['generateShopItems'], { runState: null, nodeMap: null },
    );

    service = new ItemCallbacksWiringService(
      itemSpy, gameStateSpy, enemySpy, waveSpy, deckSpy, runSpy,
    );
  });

  it('wire() registers both combat and run callbacks on ItemService', () => {
    service.wire();
    expect(itemSpy.registerCombatCallbacks).toHaveBeenCalledTimes(1);
    expect(itemSpy.registerRunCallbacks).toHaveBeenCalledTimes(1);
  });

  it('unwire() calls ItemService.unregisterCallbacks', () => {
    service.unwire();
    expect(itemSpy.unregisterCallbacks).toHaveBeenCalledTimes(1);
  });

  describe('registered combat callbacks', () => {
    let combatArgs: Parameters<ItemService['registerCombatCallbacks']>;

    beforeEach(() => {
      service.wire();
      combatArgs = itemSpy.registerCombatCallbacks.calls.mostRecent().args as
        Parameters<ItemService['registerCombatCallbacks']>;
    });

    it('getGamePhase returns the live game phase', () => {
      gameStateSpy.getState.and.returnValue({ phase: GamePhase.COMBAT } as ReturnType<GameStateService['getState']>);
      const [getGamePhase] = combatArgs;
      expect(getGamePhase()).toBe(GamePhase.COMBAT);
    });

    it('doDamageAllEnemies returns false when no living enemies remain', () => {
      enemySpy.getEnemies.and.returnValue(new Map());
      const [, doDamageAllEnemies] = combatArgs;
      expect(doDamageAllEnemies(10)).toBe(false);
      expect(enemySpy.damageEnemy).not.toHaveBeenCalled();
    });

    it('doDamageAllEnemies damages every living enemy and skips dying/zero-hp ones', () => {
      const enemies = new Map<string, FakeEnemy>([
        ['a', { id: 'a', health: 10, dying: false }],
        ['b', { id: 'b', health: 0,  dying: false }],
        ['c', { id: 'c', health: 5,  dying: true  }],
        ['d', { id: 'd', health: 3,  dying: false }],
      ]);
      enemySpy.getEnemies.and.returnValue(enemies as unknown as ReturnType<EnemyService['getEnemies']>);
      const [, doDamageAllEnemies] = combatArgs;
      expect(doDamageAllEnemies(7)).toBe(true);
      expect(enemySpy.damageEnemy).toHaveBeenCalledTimes(2);
      expect(enemySpy.damageEnemy).toHaveBeenCalledWith('a', 7);
      expect(enemySpy.damageEnemy).toHaveBeenCalledWith('d', 7);
    });

    it('doAdjustLives forwards delta to GameStateService.addLives', () => {
      const [, , doAdjustLives] = combatArgs;
      doAdjustLives(2);
      expect(gameStateSpy.addLives).toHaveBeenCalledWith(2);
    });

    it('getCurrentLives returns { current, max } from game state', () => {
      gameStateSpy.getState.and.returnValue({ lives: 4, maxLives: 7 } as ReturnType<GameStateService['getState']>);
      const [, , , getCurrentLives] = combatArgs;
      expect(getCurrentLives()).toEqual({ current: 4, max: 7 });
    });

    it('doAddEnergy forwards to DeckService.addEnergy', () => {
      const [, , , , doAddEnergy] = combatArgs;
      doAddEnergy(3);
      expect(deckSpy.addEnergy).toHaveBeenCalledWith(3);
    });

    it('doInsertEmptyTurn forwards to WaveService.insertEmptyTurn', () => {
      const [, , , , , doInsertEmptyTurn] = combatArgs;
      doInsertEmptyTurn();
      expect(waveSpy.insertEmptyTurn).toHaveBeenCalledTimes(1);
    });

    it('doApplyCaltrops forwards multiplier to WaveService', () => {
      const [, , , , , , doApplyCaltrops] = combatArgs;
      doApplyCaltrops(0.5);
      expect(waveSpy.setNextWaveEnemySpeedMultiplier).toHaveBeenCalledWith(0.5);
    });
  });

  describe('registered run callbacks', () => {
    let runArgs: Parameters<ItemService['registerRunCallbacks']>;

    beforeEach(() => {
      service.wire();
      runArgs = itemSpy.registerRunCallbacks.calls.mostRecent().args as
        Parameters<ItemService['registerRunCallbacks']>;
    });

    it('doAddGold forwards to GameStateService.addGold', () => {
      const [doAddGold] = runArgs;
      doAddGold(10);
      expect(gameStateSpy.addGold).toHaveBeenCalledWith(10);
    });

    it('getIsAtShopNode returns false when no current node', () => {
      const [, getIsAtShopNode] = runArgs;
      expect(getIsAtShopNode()).toBe(false);
    });

    it('getIsAtShopNode returns true when current node is a SHOP', () => {
      const shopNode = { id: 'n1', type: NodeType.SHOP };
      Object.defineProperty(runSpy, 'runState', {
        value: { currentNodeId: 'n1' },
      });
      Object.defineProperty(runSpy, 'nodeMap', {
        value: { nodes: [shopNode] },
      });
      const [, getIsAtShopNode] = runArgs;
      expect(getIsAtShopNode()).toBe(true);
    });

    it('getIsAtShopNode returns false when current node is non-SHOP', () => {
      const combatNode = { id: 'n1', type: NodeType.COMBAT };
      Object.defineProperty(runSpy, 'runState', {
        value: { currentNodeId: 'n1' },
      });
      Object.defineProperty(runSpy, 'nodeMap', {
        value: { nodes: [combatNode] },
      });
      const [, getIsAtShopNode] = runArgs;
      expect(getIsAtShopNode()).toBe(false);
    });

    it('doRegenerateShop forwards to RunService.generateShopItems', () => {
      const [, , doRegenerateShop] = runArgs;
      doRegenerateShop();
      expect(runSpy.generateShopItems).toHaveBeenCalledTimes(1);
    });
  });
});
