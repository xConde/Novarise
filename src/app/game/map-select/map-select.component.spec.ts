import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { MapSelectComponent } from './map-select.component';
import { MapStorageService, MapMetadata } from '../../games/novarise/core/map-storage.service';
import { MapBridgeService } from '../../core/services/map-bridge.service';
import { PlayerProfileService } from '../../core/services/player-profile.service';
import { MapScoreRecord } from '../game-board/models/score.model';
import { DifficultyLevel } from '../game-board/models/game-state.model';
import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../../games/novarise/models/terrain-types.enum';

const MOCK_MAPS: MapMetadata[] = [
  { id: 'map_1', name: 'First Map', createdAt: 1000, updatedAt: 2000, version: '1.0.0', gridSize: 25 },
  { id: 'map_2', name: 'Second Map', createdAt: 1500, updatedAt: 2500, version: '1.0.0', gridSize: 30 }
];

const MOCK_TERRAIN_STATE: TerrainGridState = {
  gridSize: 1,
  tiles: [[TerrainType.BEDROCK]],
  heightMap: [[0]],
  spawnPoints: [],
  exitPoints: [],
  version: '2.0.0'
};

const MOCK_SCORE_RECORD: MapScoreRecord = {
  mapId: 'map_1',
  bestScore: 3000,
  bestStars: 2,
  difficulty: DifficultyLevel.NORMAL,
  completedAt: 1700000000000,
};

describe('MapSelectComponent', () => {
  let component: MapSelectComponent;
  let fixture: ComponentFixture<MapSelectComponent>;
  let mapStorageSpy: jasmine.SpyObj<MapStorageService>;
  let mapBridgeSpy: jasmine.SpyObj<MapBridgeService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let playerProfileSpy: jasmine.SpyObj<PlayerProfileService>;

  beforeEach(async () => {
    mapStorageSpy = jasmine.createSpyObj('MapStorageService', ['getAllMaps', 'loadMap', 'deleteMap']);
    mapBridgeSpy = jasmine.createSpyObj('MapBridgeService', ['setEditorMapState', 'clearEditorMap', 'getMapId']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    playerProfileSpy = jasmine.createSpyObj('PlayerProfileService', ['getAllMapScores']);

    mapStorageSpy.getAllMaps.and.returnValue(MOCK_MAPS);
    mapStorageSpy.loadMap.and.returnValue(MOCK_TERRAIN_STATE);
    mapStorageSpy.deleteMap.and.returnValue(true);
    routerSpy.navigate.and.returnValue(Promise.resolve(true));
    playerProfileSpy.getAllMapScores.and.returnValue({});
    mapBridgeSpy.getMapId.and.returnValue(null);

    await TestBed.configureTestingModule({
      declarations: [MapSelectComponent],
      providers: [
        { provide: MapStorageService, useValue: mapStorageSpy },
        { provide: MapBridgeService, useValue: mapBridgeSpy },
        { provide: Router, useValue: routerSpy },
        { provide: PlayerProfileService, useValue: playerProfileSpy }
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

  it('should show map cards when maps are available', () => {
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.map-card');
    expect(cards.length).toBe(2);
  });

  it('should always show the quick play button', () => {
    fixture.detectChanges();
    const quickPlay = fixture.nativeElement.querySelector('.quick-play-btn');
    expect(quickPlay).toBeTruthy();
  });

  it('should show empty state when maps array is empty', () => {
    mapStorageSpy.getAllMaps.and.returnValue([]);
    fixture.detectChanges();
    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
    const cards = fixture.nativeElement.querySelectorAll('.map-card');
    expect(cards.length).toBe(0);
  });

  it('should not show empty state when maps are present', () => {
    fixture.detectChanges();
    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState).toBeNull();
  });

  it('selectMap should load map data and pass to MapBridgeService then navigate to /play', () => {
    fixture.detectChanges();
    component.selectMap(MOCK_MAPS[0]);
    expect(mapStorageSpy.loadMap).toHaveBeenCalledOnceWith('map_1');
    expect(mapBridgeSpy.setEditorMapState).toHaveBeenCalledOnceWith(MOCK_TERRAIN_STATE, 'map_1');
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

  it('should show create CTA button in empty state', () => {
    mapStorageSpy.getAllMaps.and.returnValue([]);
    fixture.detectChanges();
    const createBtn = fixture.nativeElement.querySelector('.empty-state .create-btn');
    expect(createBtn).toBeTruthy();
    expect(createBtn.textContent).toContain('Create a Map');
  });

  it('should navigate to editor when create CTA is clicked', () => {
    mapStorageSpy.getAllMaps.and.returnValue([]);
    fixture.detectChanges();
    const createBtn = fixture.nativeElement.querySelector('.empty-state .create-btn');
    createBtn.click();
    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/edit']);
  });

  describe('quickPlay', () => {
    it('should clear editor map and navigate to /play with quickplay param', () => {
      fixture.detectChanges();
      component.quickPlay();
      expect(mapBridgeSpy.clearEditorMap).toHaveBeenCalledOnceWith();
      expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/play'], { queryParams: { quickplay: 'true' } });
    });

    it('should render quick play button that triggers quickPlay', () => {
      fixture.detectChanges();
      const quickPlayBtn = fixture.nativeElement.querySelector('.quick-play-btn');
      quickPlayBtn.click();
      expect(mapBridgeSpy.clearEditorMap).toHaveBeenCalled();
    });
  });

  describe('deleteMap', () => {
    const mockEvent = new MouseEvent('click');

    beforeEach(() => {
      spyOn(mockEvent, 'stopPropagation');
    });

    it('first click should set deleteConfirmId without deleting', () => {
      fixture.detectChanges();
      component.deleteMap('map_1', mockEvent);
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(component.deleteConfirmId).toBe('map_1');
      expect(mapStorageSpy.deleteMap).not.toHaveBeenCalled();
    });

    it('second click on same map should delete and refresh list', () => {
      fixture.detectChanges();
      component.deleteMap('map_1', mockEvent);
      component.deleteMap('map_1', mockEvent);
      expect(mapStorageSpy.deleteMap).toHaveBeenCalledOnceWith('map_1');
      expect(mapStorageSpy.getAllMaps).toHaveBeenCalledTimes(2); // init + refresh
      expect(component.deleteConfirmId).toBeNull();
    });

    it('clicking a different map should reset confirmation to the new map', () => {
      fixture.detectChanges();
      component.deleteMap('map_1', mockEvent);
      expect(component.deleteConfirmId).toBe('map_1');
      component.deleteMap('map_2', mockEvent);
      expect(component.deleteConfirmId).toBe('map_2');
      expect(mapStorageSpy.deleteMap).not.toHaveBeenCalled();
    });

    it('should auto-cancel confirmation after timeout', fakeAsync(() => {
      fixture.detectChanges();
      component.deleteMap('map_1', mockEvent);
      expect(component.deleteConfirmId).toBe('map_1');
      tick(3000);
      expect(component.deleteConfirmId).toBeNull();
    }));

    it('should clear timer on destroy', fakeAsync(() => {
      fixture.detectChanges();
      component.deleteMap('map_1', mockEvent);
      component.ngOnDestroy();
      tick(3000);
      // No error means timer was cleared successfully
      expect(component.deleteConfirmId).toBe('map_1'); // unchanged since timer was cleared
    }));
  });

  describe('editMap', () => {
    const mockEvent = new MouseEvent('click');

    beforeEach(() => {
      spyOn(mockEvent, 'stopPropagation');
    });

    it('should load map into bridge and navigate to /edit', () => {
      fixture.detectChanges();
      component.editMap(MOCK_MAPS[0], mockEvent);
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mapStorageSpy.loadMap).toHaveBeenCalledOnceWith('map_1');
      expect(mapBridgeSpy.setEditorMapState).toHaveBeenCalledOnceWith(MOCK_TERRAIN_STATE);
      expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/edit']);
    });

    it('should not navigate when loadMap returns null', () => {
      mapStorageSpy.loadMap.and.returnValue(null);
      fixture.detectChanges();
      component.editMap(MOCK_MAPS[0], mockEvent);
      expect(mapBridgeSpy.setEditorMapState).not.toHaveBeenCalled();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });
  });

  describe('grid size display', () => {
    it('should display grid size on map cards', () => {
      fixture.detectChanges();
      const metaElements = fixture.nativeElement.querySelectorAll('.map-card .map-meta');
      expect(metaElements.length).toBe(2);
      expect(metaElements[0].textContent).toContain('25');
      expect(metaElements[1].textContent).toContain('30');
    });
  });

  describe('getMapStars / getMapBestScore helpers', () => {
    it('getMapStars returns 0 for a map with no score record', () => {
      fixture.detectChanges();
      expect(component.getMapStars('no_such_map')).toBe(0);
    });

    it('getMapStars returns bestStars from the score record', () => {
      playerProfileSpy.getAllMapScores.and.returnValue({ map_1: MOCK_SCORE_RECORD });
      fixture.detectChanges();
      expect(component.getMapStars('map_1')).toBe(2);
    });

    it('getMapBestScore returns null for a map with no score record', () => {
      fixture.detectChanges();
      expect(component.getMapBestScore('no_such_map')).toBeNull();
    });

    it('getMapBestScore returns bestScore from the score record', () => {
      playerProfileSpy.getAllMapScores.and.returnValue({ map_1: MOCK_SCORE_RECORD });
      fixture.detectChanges();
      expect(component.getMapBestScore('map_1')).toBe(3000);
    });
  });

  describe('map score display', () => {
    it('should not show .map-score for a map with no score record', () => {
      playerProfileSpy.getAllMapScores.and.returnValue({});
      fixture.detectChanges();
      const scoreEls = fixture.nativeElement.querySelectorAll('.map-score');
      expect(scoreEls.length).toBe(0);
    });

    it('should show .map-score for a map with a score record', () => {
      playerProfileSpy.getAllMapScores.and.returnValue({ map_1: MOCK_SCORE_RECORD });
      fixture.detectChanges();
      const scoreEls = fixture.nativeElement.querySelectorAll('.map-score');
      expect(scoreEls.length).toBe(1);
    });

    it('selectMap passes mapId to bridge', () => {
      fixture.detectChanges();
      component.selectMap(MOCK_MAPS[1]);
      expect(mapBridgeSpy.setEditorMapState).toHaveBeenCalledWith(MOCK_TERRAIN_STATE, 'map_2');
    });
  });

  describe('last-played map highlight', () => {
    it('should set lastPlayedMapId from mapBridge on init', () => {
      mapBridgeSpy.getMapId.and.returnValue('map_1');
      fixture.detectChanges();
      expect(component.lastPlayedMapId).toBe('map_1');
    });

    it('should set lastPlayedMapId to null when mapBridge has no mapId', () => {
      mapBridgeSpy.getMapId.and.returnValue(null);
      fixture.detectChanges();
      expect(component.lastPlayedMapId).toBeNull();
    });

    it('should apply map-card--last-played class to the last-played map card', () => {
      mapBridgeSpy.getMapId.and.returnValue('map_1');
      fixture.detectChanges();
      const cards = fixture.nativeElement.querySelectorAll('.map-card') as NodeListOf<HTMLElement>;
      expect(cards[0].classList).toContain('map-card--last-played');
      expect(cards[1].classList).not.toContain('map-card--last-played');
    });

    it('should not apply map-card--last-played when no last-played map', () => {
      mapBridgeSpy.getMapId.and.returnValue(null);
      fixture.detectChanges();
      const highlighted = fixture.nativeElement.querySelectorAll('.map-card--last-played');
      expect(highlighted.length).toBe(0);
    });
  });
});
