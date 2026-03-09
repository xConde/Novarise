import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MapStorageService, MapMetadata } from '../../games/novarise/core/map-storage.service';
import { MapBridgeService } from '../game-board/services/map-bridge.service';
import { QUICK_PLAY_PARAM } from '../guards/game.guard';
import { DEMO_MAPS, DemoMapConfig } from '../game-board/models/demo-maps.model';

const DELETE_CONFIRM_TIMEOUT_MS = 3000;

@Component({
  selector: 'app-map-select',
  templateUrl: './map-select.component.html',
  styleUrls: ['./map-select.component.scss']
})
export class MapSelectComponent implements OnInit, OnDestroy {
  maps: MapMetadata[] = [];
  readonly demoMaps: readonly DemoMapConfig[] = DEMO_MAPS;
  deleteConfirmId: string | null = null;
  private deleteConfirmTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private mapStorage: MapStorageService,
    private mapBridge: MapBridgeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.maps = this.mapStorage.getAllMaps();
  }

  ngOnDestroy(): void {
    this.clearDeleteConfirmTimer();
  }

  selectMap(map: MapMetadata): void {
    const mapData = this.mapStorage.loadMap(map.id);
    if (!mapData) {
      this.maps = this.maps.filter(m => m.id !== map.id);
      return;
    }

    const playability = this.mapStorage.validateMapPlayability(mapData);
    if (!playability.playable) {
      alert(`This map cannot be played: ${playability.error}`);
      return;
    }

    this.mapBridge.setEditorMapState(mapData);
    this.router.navigate(['/play']);
  }

  quickPlay(): void {
    this.mapBridge.clearEditorMap();
    this.router.navigate(['/play'], { queryParams: { [QUICK_PLAY_PARAM]: 'true' } });
  }

  selectDemoMap(demoMap: DemoMapConfig): void {
    this.mapBridge.setEditorMapState(demoMap.state);
    this.router.navigate(['/play']);
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
