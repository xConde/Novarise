/**
 * Maps TowerType to its per-tower icon name.
 *
 * All 4 card surfaces that render a tower type icon (card-hand,
 * app-game-card, library-card-tile, and card-draft) import this
 * single function rather than maintaining per-surface switch statements.
 * Falls back to 'crosshair' for any unrecognised value so new tower
 * types degrade gracefully until their icon is wired up.
 */
import { TowerType } from '../../../game/game-board/models/tower.model';
import { IconName } from './icon-registry';

export function towerTypeToIconName(towerType: TowerType): IconName {
  switch (towerType) {
    case TowerType.BASIC:  return 'tower-basic';
    case TowerType.SNIPER: return 'tower-sniper';
    case TowerType.SPLASH: return 'tower-splash';
    case TowerType.SLOW:   return 'tower-slow';
    case TowerType.CHAIN:  return 'tower-chain';
    case TowerType.MORTAR: return 'tower-mortar';
    default: return 'crosshair';
  }
}
