import { TowerType } from './tower.model';

export interface TowerUnlockCondition {
  type: 'campaign' | 'achievement' | 'default';
  campaignLevel?: number; // campaign level ID that unlocks this tower
  achievementId?: string; // achievement ID that unlocks this tower
  description: string;
}

export const TOWER_UNLOCK_CONDITIONS: Record<TowerType, TowerUnlockCondition> = {
  [TowerType.BASIC]: {
    type: 'default',
    description: 'Available from the start',
  },
  [TowerType.SNIPER]: {
    type: 'campaign',
    campaignLevel: 1,
    description: 'Complete Campaign Level 1',
  },
  [TowerType.SPLASH]: {
    type: 'campaign',
    campaignLevel: 2,
    description: 'Complete Campaign Level 2',
  },
  [TowerType.SLOW]: {
    type: 'campaign',
    campaignLevel: 3,
    description: 'Complete Campaign Level 3',
  },
  [TowerType.CHAIN]: {
    type: 'campaign',
    campaignLevel: 4,
    description: 'Complete Campaign Level 4',
  },
  [TowerType.MORTAR]: {
    type: 'campaign',
    campaignLevel: 5,
    description: 'Complete Campaign Level 5',
  },
};
