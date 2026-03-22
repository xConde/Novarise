import { TowerType, TowerSpecialization, TOWER_CONFIGS, TOWER_DESCRIPTIONS, TOWER_SPECIALIZATIONS } from './tower.model';

export interface TowerSpecInfo {
  label: string;
  description: string;
}

export interface TowerInfo {
  type: TowerType;
  name: string;
  description: string;
  damage: number;
  range: number;
  fireRate: number;
  cost: number;
  color: number;
  alpha: TowerSpecInfo;
  beta: TowerSpecInfo;
}

/** Display names for each tower type shown in the encyclopedia. */
const TOWER_DISPLAY_NAMES: Record<TowerType, string> = {
  [TowerType.BASIC]:  'Basic',
  [TowerType.SNIPER]: 'Sniper',
  [TowerType.SPLASH]: 'Splash',
  [TowerType.SLOW]:   'Slow',
  [TowerType.CHAIN]:  'Chain',
  [TowerType.MORTAR]: 'Mortar',
};

/** Pre-computed tower info cards for all tower types. Stats sourced from TOWER_CONFIGS. */
export const TOWER_INFO: Record<TowerType, TowerInfo> = (
  Object.values(TowerType) as TowerType[]
).reduce<Record<TowerType, TowerInfo>>((acc, type) => {
  const cfg = TOWER_CONFIGS[type];
  const specs = TOWER_SPECIALIZATIONS[type];
  acc[type] = {
    type,
    name: TOWER_DISPLAY_NAMES[type],
    description: TOWER_DESCRIPTIONS[type],
    damage: cfg.damage,
    range: cfg.range,
    fireRate: cfg.fireRate,
    cost: cfg.cost,
    color: cfg.color,
    alpha: {
      label: specs[TowerSpecialization.ALPHA].label,
      description: specs[TowerSpecialization.ALPHA].description,
    },
    beta: {
      label: specs[TowerSpecialization.BETA].label,
      description: specs[TowerSpecialization.BETA].description,
    },
  };
  return acc;
}, {} as Record<TowerType, TowerInfo>);
