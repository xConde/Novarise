import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EditMode, BrushTool } from '../../novarise.component';
import { TerrainType, TERRAIN_CONFIGS } from '../../models/terrain-types.enum';

@Component({
  selector: 'app-edit-controls',
  templateUrl: './edit-controls.component.html',
  styleUrls: ['./edit-controls.component.scss']
})
export class EditControlsComponent {
  @Input() editMode: EditMode = 'paint';
  @Input() selectedTerrainType: TerrainType = TerrainType.BEDROCK;
  @Input() brushSize: number = 1;
  @Input() activeTool: BrushTool = 'brush';

  @Output() editModeChange = new EventEmitter<EditMode>();
  @Output() terrainTypeChange = new EventEmitter<TerrainType>();
  @Output() brushSizeChange = new EventEmitter<number>();
  @Output() activeToolChange = new EventEmitter<BrushTool>();

  public terrainTypes = Object.values(TerrainType);
  public terrainConfigs = TERRAIN_CONFIGS;
  public brushSizes = [1, 3, 5, 7];
  public activeTab: 'editor' | 'shortcuts' = 'editor';
  public isCollapsed = false;

  public setTab(tab: 'editor' | 'shortcuts'): void {
    if (this.activeTab === tab) {
      this.isCollapsed = true;
    } else {
      this.activeTab = tab;
      this.isCollapsed = false;
    }
  }

  public openPanel(): void {
    this.isCollapsed = false;
  }

  public setMode(mode: EditMode): void {
    this.editModeChange.emit(mode);
  }

  public selectTerrain(type: TerrainType): void {
    this.terrainTypeChange.emit(type);
  }

  public setBrushSize(size: number): void {
    this.brushSizeChange.emit(size);
  }

  public setTool(tool: BrushTool): void {
    this.activeToolChange.emit(tool);
  }

  public getTerrainColor(type: TerrainType): string {
    return `#${TERRAIN_CONFIGS[type].color.toString(16).padStart(6, '0')}`;
  }
}
