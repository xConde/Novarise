import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EditMode } from '../../novarise.component';
import { TerrainType, TERRAIN_CONFIGS } from '../../models/terrain-types.enum';

@Component({
  selector: 'app-edit-controls',
  templateUrl: './edit-controls.component.html',
  styleUrls: ['./edit-controls.component.scss']
})
export class EditControlsComponent {
  @Input() editMode: EditMode = 'paint';
  @Input() selectedTerrainType: TerrainType = TerrainType.BEDROCK;

  @Output() editModeChange = new EventEmitter<EditMode>();
  @Output() terrainTypeChange = new EventEmitter<TerrainType>();

  public terrainTypes = Object.values(TerrainType);
  public terrainConfigs = TERRAIN_CONFIGS;

  public setMode(mode: EditMode): void {
    this.editModeChange.emit(mode);
  }

  public selectTerrain(type: TerrainType): void {
    this.terrainTypeChange.emit(type);
  }

  public getTerrainColor(type: TerrainType): string {
    return `#${TERRAIN_CONFIGS[type].color.toString(16).padStart(6, '0')}`;
  }
}
