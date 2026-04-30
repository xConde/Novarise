import { GameBoardService } from '../../game-board.service';
import { TowerCombatService } from '../../services/tower-combat.service';
import { TowerPlacementService } from '../../services/tower-placement.service';
import { TowerSelectionService } from '../../services/tower-selection.service';
import { TowerAnimationService } from '../../services/tower-animation.service';
import { TowerUpgradeVisualService } from '../../services/tower-upgrade-visual.service';
import { GameBoardTile } from '../../models/game-board-tile';

/**
 * Create a pre-configured GameBoardService spy with standard return values.
 * Pass a board getter to also stub getGameBoard().
 *
 * Stubs all commonly-used public methods with safe defaults:
 *   - getBoardWidth / getBoardHeight / getTileSize — return the supplied dimensions
 *   - canPlaceTower / wouldBlockPath — return false (safe no-op)
 *   - placeTower / removeTower — return false (safe no-op)
 *   - importBoard — no-op void
 */
export function createGameBoardServiceSpy(
  width = 10,
  height = 10,
  tileSize = 1,
  boardFn?: () => GameBoardTile[][]
): jasmine.SpyObj<GameBoardService> {
  const methods: (keyof GameBoardService)[] = [
    'getGameBoard',
    'getBoardWidth',
    'getBoardHeight',
    'getTileSize',
    'canPlaceTower',
    'wouldBlockPath',
    'placeTower',
    'removeTower',
    'importBoard',
  ];
  const spy = jasmine.createSpyObj<GameBoardService>('GameBoardService', methods);
  spy.getBoardWidth.and.returnValue(width);
  spy.getBoardHeight.and.returnValue(height);
  spy.getTileSize.and.returnValue(tileSize);
  spy.canPlaceTower.and.returnValue(false);
  spy.wouldBlockPath.and.returnValue(false);
  spy.placeTower.and.returnValue(false);
  spy.removeTower.and.returnValue(false);
  if (boardFn) {
    spy.getGameBoard.and.callFake(boardFn);
  }
  return spy;
}

/**
 * Create a pre-configured TowerCombatService spy.
 *
 * Default return values:
 *   - update() — empty result (no kills, no shots)
 *   - upgradeTower() / upgradeTowerWithSpec() / setTargetingMode() / cycleTargetingMode() — false/null
 *   - drainAudioEvents() — empty array
 *   - unregisterTower() — undefined
 *   - All other mutating methods — no-op void
 */
export function createTowerCombatServiceSpy(): jasmine.SpyObj<TowerCombatService> {
  // M2 S4: 'update' removed; fireTurn + tickMortarZonesForTurn are the turn-based replacements.
  const spy = jasmine.createSpyObj<TowerCombatService>('TowerCombatService', [
    'drainAudioEvents',
    'registerTower',
    'upgradeTower',
    'upgradeTowerWithSpec',
    'unregisterTower',
    'fireTurn',
    'tickMortarZonesForTurn',
    'setTargetingMode',
    'cycleTargetingMode',
    'getTower',
    'getPlacedTowers',
  ]);
  spy.fireTurn.and.returnValue({ killed: [], fired: [], hitCount: 0, damageDealt: 0 });
  spy.tickMortarZonesForTurn.and.returnValue({ kills: [], damageDealt: 0 });
  spy.upgradeTower.and.returnValue(false);
  spy.upgradeTowerWithSpec.and.returnValue(false);
  spy.setTargetingMode.and.returnValue(false);
  spy.cycleTargetingMode.and.returnValue(null);
  spy.unregisterTower.and.returnValue(undefined);
  spy.drainAudioEvents.and.returnValue([]);
  spy.getTower.and.returnValue(undefined);
  spy.getPlacedTowers.and.returnValue(new Map());
  return spy;
}

/**
 * Create a pre-configured TowerPlacementService spy.
 *
 * Default return values:
 *   - isDragging — false
 *   - onTowerDragStart / cancelDrag / removeDragListeners / init — no-op void
 */
export function createTowerPlacementServiceSpy(): jasmine.SpyObj<TowerPlacementService> {
  const spy = jasmine.createSpyObj<TowerPlacementService>(
    'TowerPlacementService',
    ['onTowerDragStart', 'cancelDrag', 'removeDragListeners', 'init', 'cleanup'],
    { isDragging: false }
  );
  return spy;
}

/**
 * Create a pre-configured TowerSelectionService spy.
 *
 * Default return values:
 *   - selectedTowerInfo / selectedTowerStats / upgradePreview — null
 *   - sellConfirmPending / showSpecializationChoice — false
 *   - specOptions — empty array
 *   - selectedTowerUpgradeCost / selectedTowerUpgradePercent / selectedTowerSellValue — 0
 *   - selectPlacedTower / deselectTower / refreshTowerInfoPanel / cycleTargeting — no-op void
 */
export function createTowerSelectionServiceSpy(): jasmine.SpyObj<TowerSelectionService> {
  const spy = jasmine.createSpyObj<TowerSelectionService>(
    'TowerSelectionService',
    ['selectPlacedTower', 'deselectTower', 'refreshTowerInfoPanel', 'cycleTargeting'],
    {
      selectedTowerInfo: null,
      selectedTowerStats: null,
      selectedTowerUpgradeCost: 0,
      selectedTowerUpgradePercent: 0,
      selectedTowerSellValue: 0,
      upgradePreview: null,
      showSpecializationChoice: false,
      specOptions: [],
      sellConfirmPending: false,
    }
  );
  return spy;
}

/**
 * Create a pre-configured TowerAnimationService spy.
 *
 * All animation methods are stubbed as no-op voids:
 *   - triggerFire / startMuzzleFlash / updateMuzzleFlashes / updateTowerAnimations / updateTilePulse
 */
export function createTowerAnimationServiceSpy(): jasmine.SpyObj<TowerAnimationService> {
  return jasmine.createSpyObj<TowerAnimationService>('TowerAnimationService', [
    'triggerFire',
    'startMuzzleFlash',
    'updateMuzzleFlashes',
    'updateTowerAnimations',
    'tickRecoilAnimations',
    'tickTubeEmits',
    'tickEmitterPulses',
    'tickTierUpScale',
    'tickSellAnimations',
    'tickSelectionPulse',
    'tickHoverLift',
    'updateTilePulse',
  ]);
}

/**
 * Create a pre-configured TowerUpgradeVisualService spy.
 *
 * Default return values:
 *   - flashCount / ringCount — 0
 *   - All visual methods — no-op void
 */
export function createTowerUpgradeVisualServiceSpy(): jasmine.SpyObj<TowerUpgradeVisualService> {
  const spy = jasmine.createSpyObj<TowerUpgradeVisualService>(
    'TowerUpgradeVisualService',
    [
      'applyLevelScale',
      'spawnUpgradeFlash',
      'addGlowRing',
      'removeGlowRing',
      'update',
      'cleanup',
      'applyUpgradeVisuals',
      'applySpecializationVisual',
    ],
    { flashCount: 0, ringCount: 0 }
  );
  return spy;
}
