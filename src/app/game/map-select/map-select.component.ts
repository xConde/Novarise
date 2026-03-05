import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MapStorageService, MapMetadata } from '../../games/novarise/core/map-storage.service';
import { MapBridgeService } from '../game-board/services/map-bridge.service';
import { DEFAULT_DIFFICULTY, DifficultyLevel, DIFFICULTY_PRESETS, DifficultyPreset } from '../game-board/models/difficulty.model';

@Component({
  selector: 'app-map-select',
  templateUrl: './map-select.component.html',
  styleUrls: ['./map-select.component.scss']
})
export class MapSelectComponent implements OnInit {
  maps: MapMetadata[] = [];

  /** Make enum available in template */
  DifficultyLevel = DifficultyLevel;

  /** All difficulty levels in display order */
  readonly difficultyLevels: DifficultyLevel[] = [
    DifficultyLevel.EASY,
    DifficultyLevel.NORMAL,
    DifficultyLevel.HARD,
    DifficultyLevel.NIGHTMARE
  ];

  /** Preset metadata (label, description, multipliers) keyed by level */
  readonly difficultyPresets: Record<DifficultyLevel, DifficultyPreset> = DIFFICULTY_PRESETS;

  /** Currently selected difficulty — defaults to whatever MapBridge has stored */
  selectedDifficulty: DifficultyLevel = DEFAULT_DIFFICULTY;

  constructor(
    private mapStorage: MapStorageService,
    private mapBridge: MapBridgeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.maps = this.mapStorage.getAllMaps();
    // Restore any previously selected difficulty from the bridge so the UI
    // reflects the stored value when the player navigates back here.
    this.selectedDifficulty = this.mapBridge.getDifficulty();
  }

  selectDifficulty(difficulty: DifficultyLevel): void {
    this.selectedDifficulty = difficulty;
    this.mapBridge.setDifficulty(difficulty);
  }

  selectMap(map: MapMetadata): void {
    const mapData = this.mapStorage.loadMap(map.id);
    if (mapData) {
      this.mapBridge.setEditorMapState(mapData);
      // Difficulty is already stored in the bridge via selectDifficulty()
      this.router.navigate(['/play']);
    }
  }

  goToEditor(): void {
    this.router.navigate(['/edit']);
  }

  goToCampaign(): void {
    this.router.navigate(['/campaign']);
  }
}
