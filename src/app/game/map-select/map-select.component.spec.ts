import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { MapSelectComponent } from './map-select.component';
import { MapStorageService, MapMetadata } from '../../games/novarise/core/map-storage.service';
import { MapBridgeService } from '../game-board/services/map-bridge.service';
import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../../games/novarise/models/terrain-types.enum';
import { DifficultyLevel } from '../game-board/models/difficulty.model';

const MOCK_MAPS: MapMetadata[] = [
  { id: 'map_1', name: 'First Map', createdAt: 1000, updatedAt: 2000, version: '1.0.0', gridSize: 25 },
  { id: 'map_2', name: 'Second Map', createdAt: 1500, updatedAt: 2500, version: '1.0.0', gridSize: 25 }
];

const MOCK_TERRAIN_STATE: TerrainGridState = {
  gridSize: 1,
  tiles: [[TerrainType.BEDROCK]],
  heightMap: [[0]],
  spawnPoint: null,
  exitPoint: null,
  version: '1.0.0'
};

describe('MapSelectComponent', () => {
  let component: MapSelectComponent;
  let fixture: ComponentFixture<MapSelectComponent>;
  let mapStorageSpy: jasmine.SpyObj<MapStorageService>;
  let mapBridgeSpy: jasmine.SpyObj<MapBridgeService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mapStorageSpy = jasmine.createSpyObj('MapStorageService', ['getAllMaps', 'loadMap']);
    mapBridgeSpy = jasmine.createSpyObj('MapBridgeService', [
      'setEditorMapState',
      'getDifficulty',
      'setDifficulty'
    ]);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    mapStorageSpy.getAllMaps.and.returnValue(MOCK_MAPS);
    mapStorageSpy.loadMap.and.returnValue(MOCK_TERRAIN_STATE);
    mapBridgeSpy.getDifficulty.and.returnValue(DifficultyLevel.NORMAL);
    routerSpy.navigate.and.returnValue(Promise.resolve(true));

    await TestBed.configureTestingModule({
      declarations: [MapSelectComponent],
      providers: [
        { provide: MapStorageService, useValue: mapStorageSpy },
        { provide: MapBridgeService, useValue: mapBridgeSpy },
        { provide: Router, useValue: routerSpy }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MapSelectComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should load maps from MapStorageService on init', () => {
    fixture.detectChanges();
    expect(mapStorageSpy.getAllMaps).toHaveBeenCalledOnceWith();
    expect(component.maps).toEqual(MOCK_MAPS);
  });

  it('should restore difficulty from MapBridgeService on init', () => {
    mapBridgeSpy.getDifficulty.and.returnValue(DifficultyLevel.HARD);
    fixture.detectChanges();
    expect(component.selectedDifficulty).toBe(DifficultyLevel.HARD);
  });

  it('should show map cards when maps are available', () => {
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.map-card');
    expect(cards.length).toBe(2);
  });

  it('should show "no maps" message when maps array is empty', () => {
    mapStorageSpy.getAllMaps.and.returnValue([]);
    fixture.detectChanges();
    const noMaps = fixture.nativeElement.querySelector('.no-maps');
    expect(noMaps).toBeTruthy();
    const cards = fixture.nativeElement.querySelectorAll('.map-card');
    expect(cards.length).toBe(0);
  });

  it('should not show "no maps" message when maps are present', () => {
    fixture.detectChanges();
    const noMaps = fixture.nativeElement.querySelector('.no-maps');
    expect(noMaps).toBeNull();
  });

  it('selectDifficulty should update selectedDifficulty and call mapBridge.setDifficulty', () => {
    fixture.detectChanges();
    component.selectDifficulty(DifficultyLevel.EASY);
    expect(component.selectedDifficulty).toBe(DifficultyLevel.EASY);
    expect(mapBridgeSpy.setDifficulty).toHaveBeenCalledOnceWith(DifficultyLevel.EASY);
  });

  it('selectMap should load map data and pass to MapBridgeService then navigate to /play', () => {
    fixture.detectChanges();
    component.selectMap(MOCK_MAPS[0]);
    expect(mapStorageSpy.loadMap).toHaveBeenCalledOnceWith('map_1');
    expect(mapBridgeSpy.setEditorMapState).toHaveBeenCalledOnceWith(MOCK_TERRAIN_STATE);
    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/play']);
  });

  it('selectMap should not navigate when loadMap returns null', () => {
    mapStorageSpy.loadMap.and.returnValue(null);
    fixture.detectChanges();
    component.selectMap(MOCK_MAPS[0]);
    expect(mapBridgeSpy.setEditorMapState).not.toHaveBeenCalled();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('goToEditor should navigate to /edit', () => {
    fixture.detectChanges();
    component.goToEditor();
    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/edit']);
  });
});
