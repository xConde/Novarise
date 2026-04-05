import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MapStorageService, MapMetadata } from '../../games/novarise/core/map-storage.service';
import { MapBridgeService } from '../../core/services/map-bridge.service';
import { QUICK_PLAY_PARAM } from '../guards/game.guard';
import { PlayerProfileService } from '../../core/services/player-profile.service';
import { MapScoreRecord } from '../game-board/models/score.model';

const DELETE_CONFIRM_TIMEOUT_MS = 3000;

@Component({
  selector: 'app-map-select',
  templateUrl: './map-select.component.html',
  styleUrls: ['./map-select.component.scss']
})
export class MapSelectComponent implements OnInit, OnDestroy {
  maps: MapMetadata[] = [];
  mapScores: Record<string, MapScoreRecord> = {};
  deleteConfirmId: string | null = null;
  lastPlayedMapId: string | null = null;
  private deleteConfirmTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private mapStorage: MapStorageService,
    private mapBridge: MapBridgeService,
    private router: Router,
    private playerProfile: PlayerProfileService
  ) {}

  ngOnInit(): void {
    this.maps = this.mapStorage.getAllMaps();
    this.mapScores = this.playerProfile.getAllMapScores();
    this.lastPlayedMapId = this.mapBridge.getMapId();
  }

  ngOnDestroy(): void {
    this.clearDeleteConfirmTimer();
  }

  selectMap(map: MapMetadata): void {
    const mapData = this.mapStorage.loadMap(map.id);
    if (mapData) {
      this.mapBridge.setEditorMapState(mapData, map.id);
      this.router.navigate(['/play']);
    } else {
      this.maps = this.maps.filter(m => m.id !== map.id);
    }
  }

  getMapStars(mapId: string): number {
    return this.mapScores[mapId]?.bestStars ?? 0;
  }

  getMapBestScore(mapId: string): number | null {
    return this.mapScores[mapId]?.bestScore ?? null;
  }

  quickPlay(): void {
    this.mapBridge.clearEditorMap();
    this.router.navigate(['/play'], { queryParams: { [QUICK_PLAY_PARAM]: 'true' } });
  }

  editMap(map: MapMetadata, event: Event): void {
    event.stopPropagation();
    const mapData = this.mapStorage.loadMap(map.id);
    if (mapData) {
      this.mapBridge.setEditorMapState(mapData);
      this.router.navigate(['/edit']);
    } else {
      this.maps = this.maps.filter(m => m.id !== map.id);
    }
  }

  deleteMap(mapId: string, event: Event): void {
    event.stopPropagation();

    if (this.deleteConfirmId === mapId) {
      this.mapStorage.deleteMap(mapId);
      this.maps = this.mapStorage.getAllMaps();
      this.clearDeleteConfirmTimer();
      this.deleteConfirmId = null;
    } else {
      this.clearDeleteConfirmTimer();
      this.deleteConfirmId = mapId;
      this.deleteConfirmTimer = setTimeout(() => {
        this.deleteConfirmId = null;
        this.deleteConfirmTimer = null;
      }, DELETE_CONFIRM_TIMEOUT_MS);
    }
  }

  goToEditor(): void {
    this.router.navigate(['/edit']);
  }

  private clearDeleteConfirmTimer(): void {
    if (this.deleteConfirmTimer !== null) {
      clearTimeout(this.deleteConfirmTimer);
      this.deleteConfirmTimer = null;
    }
  }
}
