import { GameBoardService } from '../game-board.service';
import { EnemyService, DamageResult } from '../services/enemy.service';
import { Enemy } from '../models/enemy.model';
import { GameBoardTile } from '../models/game-board-tile';

/**
 * Create a pre-configured GameBoardService spy with standard return values.
 * Pass a board getter to also stub getGameBoard().
 */
export function createGameBoardServiceSpy(
  width: number = 10,
  height: number = 10,
  tileSize: number = 1,
  boardFn?: () => GameBoardTile[][]
): jasmine.SpyObj<GameBoardService> {
  const methods: (keyof GameBoardService)[] = ['getGameBoard', 'getBoardWidth', 'getBoardHeight', 'getTileSize'];
  const spy = jasmine.createSpyObj<GameBoardService>('GameBoardService', methods);
  spy.getBoardWidth.and.returnValue(width);
  spy.getBoardHeight.and.returnValue(height);
  spy.getTileSize.and.returnValue(tileSize);
  if (boardFn) {
    spy.getGameBoard.and.callFake(boardFn);
  }
  return spy;
}

/**
 * Create a pre-configured EnemyService spy.
 * The damageEnemy callFake mutates enemy.health and returns killed status.
 */
export function createEnemyServiceSpy(
  enemyMap: Map<string, Enemy>
): jasmine.SpyObj<EnemyService> {
  const methods: (keyof EnemyService)[] = ['getEnemies', 'damageEnemy', 'spawnEnemy', 'removeEnemy'];
  const spy = jasmine.createSpyObj<EnemyService>('EnemyService', methods);
  spy.getEnemies.and.returnValue(enemyMap);
  spy.damageEnemy.and.callFake((id: string, damage: number): DamageResult => {
    const enemy = enemyMap.get(id);
    if (!enemy || enemy.health <= 0) return { killed: false, spawnedEnemies: [] };
    enemy.health -= damage;
    return { killed: enemy.health <= 0, spawnedEnemies: [] };
  });
  return spy;
}
