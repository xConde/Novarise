import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { PlacedTower, TowerSpecialization, TowerType, MAX_TOWER_LEVEL, TOWER_SPECIALIZATIONS } from '../../models/tower.model';
import { StatusEffectType } from '../../constants/status-effect.constants';

@Component({
  selector: 'app-tower-info-panel',
  templateUrl: './tower-info-panel.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class TowerInfoPanelComponent {
  @Input() towerInfo: PlacedTower | null = null;
  @Input() towerStats: { damage: number; range: number; fireRate: number; statusEffect?: StatusEffectType } | null = null;
  @Input() upgradeCost = 0;
  @Input() upgradePercent = 0;
  @Input() sellValue = 0;
  @Input() upgradePreview: { damage: number; range: number; fireRate: number } | null = null;
  @Input() showSpecializationChoice = false;
  @Input() specOptions: { spec: TowerSpecialization; label: string; description: string; damage: number; range: number; fireRate: number }[] = [];
  @Input() gold = 0;
  @Input() sellConfirmPending = false;
  @Input() targetingModeLabels: Record<string, string> = {};

  @Output() close = new EventEmitter<void>();
  @Output() upgrade = new EventEmitter<void>();
  @Output() sell = new EventEmitter<void>();
  @Output() cycleTargeting = new EventEmitter<void>();
  @Output() selectSpecialization = new EventEmitter<TowerSpecialization>();
  @Output() cancelSpecialization = new EventEmitter<void>();

  readonly MAX_TOWER_LEVEL = MAX_TOWER_LEVEL;
  readonly TowerType = TowerType;
  readonly TowerSpecialization = TowerSpecialization;

  levelStars(count: number): number[] {
    return Array(Math.max(0, count)).fill(0);
  }

  specLabel(tower: PlacedTower): string {
    if (!tower.specialization) return '';
    return TOWER_SPECIALIZATIONS[tower.type][tower.specialization].label;
  }
}
