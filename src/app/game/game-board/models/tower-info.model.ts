import { TowerType, TowerSpecialization, TOWER_CONFIGS, TOWER_DESCRIPTIONS, TOWER_SPECIALIZATIONS, TOWER_IDENTITIES } from './tower.model';

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
  cost: number;
  color: number;
  alpha: TowerSpecInfo;
  beta: TowerSpecInfo;
}

/** Pre-computed tower info cards for all tower types. Stats sourced from TOWER_CONFIGS. */
export const TOWER_INFO: Record<TowerType, TowerInfo> = (
  Object.values(TowerType) as TowerType[]
).reduce<Record<TowerType, TowerInfo>>((acc, type) => {
  const cfg = TOWER_CONFIGS[type];
  const specs = TOWER_SPECIALIZATIONS[type];
  acc[type] = {
    type,
    name: TOWER_IDENTITIES[type].displayName,
    description: TOWER_DESCRIPTIONS[type],
    damage: cfg.damage,
    range: cfg.range,
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
