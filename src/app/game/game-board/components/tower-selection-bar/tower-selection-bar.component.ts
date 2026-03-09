import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TowerType, TowerStats } from '../../models/tower.model';

@Component({
  selector: 'app-tower-selection-bar',
  templateUrl: './tower-selection-bar.component.html',
  styleUrls: ['./tower-selection-bar.component.scss']
})
export class TowerSelectionBarComponent {
  @Input() towerTypes: { type: TowerType; hotkey: string }[] = [];
  @Input() selectedTowerType!: TowerType;
  @Input() towerConfigs!: Record<TowerType, TowerStats>;
  @Input() towerDescriptions!: Record<TowerType, string>;
  @Input() effectiveCosts = new Map<TowerType, number>();
  @Input() gold = 0;

  @Output() selectTowerType = new EventEmitter<TowerType>();
}
