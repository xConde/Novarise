import { Component, Input, Output, EventEmitter } from '@angular/core';
import { TowerType, TowerSpecialization, PlacedTower, MAX_TOWER_LEVEL, TOWER_SPECIALIZATIONS, TARGETING_MODE_LABELS, TargetingMode } from '../../models/tower.model';

@Component({
  selector: 'app-tower-info-panel',
  templateUrl: './tower-info-panel.component.html',
  styleUrls: ['./tower-info-panel.component.scss']
})
export class TowerInfoPanelComponent {
  @Input() selectedTowerInfo: PlacedTower | null = null;
  @Input() selectedTowerStats: { damage: number; range: number; fireRate: number } | null = null;
  @Input() upgradeCost = 0;
  @Input() sellValue = 0;
  @Input() gold = 0;
  @Input() showSpecializationChoice = false;
  @Input() specOptions: { spec: TowerSpecialization; label: string; description: string; damage: number; range: number; fireRate: number }[] = [];
  @Input() sellConfirmPending = false;

  @Output() upgrade = new EventEmitter<void>();
  @Output() sell = new EventEmitter<void>();
  @Output() deselect = new EventEmitter<void>();
  @Output() cycleTargeting = new EventEmitter<void>();
  @Output() selectSpecialization = new EventEmitter<TowerSpecialization>();
  @Output() cancelSpecialization = new EventEmitter<void>();

  readonly MAX_TOWER_LEVEL = MAX_TOWER_LEVEL;
  readonly TowerType = TowerType;
  readonly targetingModeLabels = TARGETING_MODE_LABELS;

  /** Pre-compute star arrays to avoid template allocation per CD cycle. */
  get filledStars(): number[] {
    return this.selectedTowerInfo ? Array(this.selectedTowerInfo.level).fill(0) : [];
  }
  get emptyStars(): number[] {
    return this.selectedTowerInfo ? Array(MAX_TOWER_LEVEL - this.selectedTowerInfo.level).fill(0) : [];
  }

  specLabel(tower: PlacedTower): string {
    if (!tower.specialization) return '';
    return TOWER_SPECIALIZATIONS[tower.type][tower.specialization].label;
  }
}
