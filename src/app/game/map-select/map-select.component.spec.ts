import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { MapSelectComponent } from './map-select.component';
import { MapStorageService, MapMetadata } from '../../games/novarise/core/map-storage.service';
import { MapBridgeService } from '../game-board/services/map-bridge.service';
import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../../games/novarise/models/terrain-types.enum';
import { DEMO_MAPS } from '../game-board/models/demo-maps.model';

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

describe('MapSelectComponent', () => {
  let component: MapSelectComponent;
  let fixture: ComponentFixture<MapSelectComponent>;
  let mapStorageSpy: jasmine.SpyObj<MapStorageService>;
  let mapBridgeSpy: jasmine.SpyObj<MapBridgeService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mapStorageSpy = jasmine.createSpyObj('MapStorageService', ['getAllMaps', 'loadMap', 'deleteMap', 'validateMapPlayability']);
    mapBridgeSpy = jasmine.createSpyObj('MapBridgeService', ['setEditorMapState', 'clearEditorMap']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    mapStorageSpy.getAllMaps.and.returnValue(MOCK_MAPS);
    mapStorageSpy.loadMap.and.returnValue(MOCK_TERRAIN_STATE);
    mapStorageSpy.deleteMap.and.returnValue(true);
    mapStorageSpy.validateMapPlayability.and.returnValue({ playable: true });
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

  it('should show map cards when maps are available', () => {
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.map-card:not(.demo-card)');
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
    const cards = fixture.nativeElement.querySelectorAll('.map-card:not(.demo-card)');
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

  it('selectMap should not navigate when map fails playability validation', () => {
    mapStorageSpy.validateMapPlayability.and.returnValue({ playable: false, error: 'Map has no spawn points' });
    spyOn(window, 'alert');
    fixture.detectChanges();
    component.selectMap(MOCK_MAPS[0]);
    expect(mapStorageSpy.validateMapPlayability).toHaveBeenCalledOnceWith(MOCK_TERRAIN_STATE);
    expect(window.alert).toHaveBeenCalledWith('This map cannot be played: Map has no spawn points');
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
      const metaElements = fixture.nativeElement.querySelectorAll('.map-section:not(.demo-section) .map-card .map-meta');
      expect(metaElements.length).toBe(2);
      expect(metaElements[0].textContent).toContain('25');
      expect(metaElements[1].textContent).toContain('30');
    });
  });

  describe('demo maps', () => {
    it('should render demo map cards', () => {
      fixture.detectChanges();
      const demoCards = fixture.nativeElement.querySelectorAll('.demo-card');
      expect(demoCards.length).toBe(DEMO_MAPS.length);
    });

    it('should show "Built-in Maps" section label', () => {
      fixture.detectChanges();
      const demoSection = fixture.nativeElement.querySelector('.demo-section .section-label');
      expect(demoSection).toBeTruthy();
      expect(demoSection.textContent).toContain('Built-in Maps');
    });

    it('should display demo map names', () => {
      fixture.detectChanges();
      const names = fixture.nativeElement.querySelectorAll('.demo-card .map-name');
      expect(names.length).toBe(DEMO_MAPS.length);
      for (let i = 0; i < DEMO_MAPS.length; i++) {
        expect(names[i].textContent).toContain(DEMO_MAPS[i].name);
      }
    });

    it('should display demo map descriptions', () => {
      fixture.detectChanges();
      const descriptions = fixture.nativeElement.querySelectorAll('.demo-card .map-description');
      expect(descriptions.length).toBe(DEMO_MAPS.length);
      for (let i = 0; i < DEMO_MAPS.length; i++) {
        expect(descriptions[i].textContent).toContain(DEMO_MAPS[i].description);
      }
    });

    it('should display demo map grid sizes', () => {
      fixture.detectChanges();
      const metas = fixture.nativeElement.querySelectorAll('.demo-card .map-meta');
      expect(metas.length).toBe(DEMO_MAPS.length);
      for (let i = 0; i < DEMO_MAPS.length; i++) {
        expect(metas[i].textContent).toContain(String(DEMO_MAPS[i].state.gridSize));
      }
    });

    it('should show BUILT-IN badge on demo cards', () => {
      fixture.detectChanges();
      const badges = fixture.nativeElement.querySelectorAll('.demo-card .demo-badge');
      expect(badges.length).toBe(DEMO_MAPS.length);
      expect(badges[0].textContent).toContain('BUILT-IN');
    });

    it('should NOT show edit or delete buttons on demo cards', () => {
      fixture.detectChanges();
      const demoCards = fixture.nativeElement.querySelectorAll('.demo-card');
      for (let i = 0; i < demoCards.length; i++) {
        const editBtn = demoCards[i].querySelector('.edit-btn');
        const deleteBtn = demoCards[i].querySelector('.delete-btn');
        expect(editBtn).toBeNull();
        expect(deleteBtn).toBeNull();
      }
    });

    it('should NOT show card-actions container on demo cards', () => {
      fixture.detectChanges();
      const demoCards = fixture.nativeElement.querySelectorAll('.demo-card');
      for (let i = 0; i < demoCards.length; i++) {
        const actions = demoCards[i].querySelector('.card-actions');
        expect(actions).toBeNull();
      }
    });

    it('selectDemoMap should set map state via bridge and navigate to /play', () => {
      fixture.detectChanges();
      component.selectDemoMap(DEMO_MAPS[0]);
      expect(mapBridgeSpy.setEditorMapState).toHaveBeenCalledOnceWith(DEMO_MAPS[0].state);
      expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/play']);
    });

    it('clicking a demo card should call selectDemoMap', () => {
      fixture.detectChanges();
      const demoCards = fixture.nativeElement.querySelectorAll('.demo-card');
      spyOn(component, 'selectDemoMap');
      demoCards[0].click();
      expect(component.selectDemoMap).toHaveBeenCalledOnceWith(DEMO_MAPS[0]);
    });
  });
});
