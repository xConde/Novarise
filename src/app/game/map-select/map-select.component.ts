import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MapStorageService, MapMetadata } from '../../games/novarise/core/map-storage.service';
import { MapBridgeService } from '../game-board/services/map-bridge.service';

@Component({
  selector: 'app-map-select',
  templateUrl: './map-select.component.html',
  styleUrls: ['./map-select.component.scss']
})
export class MapSelectComponent implements OnInit {
  maps: MapMetadata[] = [];

  constructor(
    private mapStorage: MapStorageService,
    private mapBridge: MapBridgeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.maps = this.mapStorage.getAllMaps();
  }

  selectMap(map: MapMetadata): void {
    const mapData = this.mapStorage.loadMap(map.id);
    if (mapData) {
      this.mapBridge.setEditorMapState(mapData);
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
