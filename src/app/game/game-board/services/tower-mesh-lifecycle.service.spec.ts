import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

import { TowerMeshLifecycleService } from './tower-mesh-lifecycle.service';
import { TowerMeshFactoryService } from './tower-mesh-factory.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { SceneService } from './scene.service';
import { GameBoardService } from '../game-board.service';
import { TowerType } from '../models/tower.model';
import { createGameBoardServiceSpy, createSceneServiceSpy } from '../testing';

describe('TowerMeshLifecycleService', () => {
  let service: TowerMeshLifecycleService;
  let towerMeshFactorySpy: jasmine.SpyObj<TowerMeshFactoryService>;
  let meshRegistrySpy: jasmine.SpyObj<BoardMeshRegistryService>;
  let sceneSpy: jasmine.SpyObj<SceneService>;
  let gameBoardSpy: jasmine.SpyObj<GameBoardService>;

  let fakeScene: THREE.Scene;

  beforeEach(() => {
    fakeScene = new THREE.Scene();

    towerMeshFactorySpy = jasmine.createSpyObj<TowerMeshFactoryService>('TowerMeshFactoryService', [
      'createTowerMesh',
    ]);

    meshRegistrySpy = jasmine.createSpyObj<BoardMeshRegistryService>('BoardMeshRegistryService', [
      'rebuildTowerChildrenArray',
    ]);
    // towerMeshes is readonly — assign via cast so tests can mutate the Map
    (meshRegistrySpy as { towerMeshes: Map<string, THREE.Group> }).towerMeshes = new Map();

    sceneSpy = createSceneServiceSpy();
    sceneSpy.getScene.and.returnValue(fakeScene);

    gameBoardSpy = createGameBoardServiceSpy(10, 10);

    TestBed.configureTestingModule({
      providers: [
        TowerMeshLifecycleService,
        { provide: TowerMeshFactoryService, useValue: towerMeshFactorySpy },
        { provide: BoardMeshRegistryService, useValue: meshRegistrySpy },
        { provide: SceneService, useValue: sceneSpy },
        { provide: GameBoardService, useValue: gameBoardSpy },
      ],
    });

    service = TestBed.inject(TowerMeshLifecycleService);
  });

  afterEach(() => {
    fakeScene.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('placeMesh', () => {
    it('should create a mesh, register it, add to scene, and rebuild array', () => {
      const fakeMesh = new THREE.Group();
      towerMeshFactorySpy.createTowerMesh.and.returnValue(fakeMesh);

      const result = service.placeMesh(2, 3, TowerType.BASIC);

      expect(towerMeshFactorySpy.createTowerMesh).toHaveBeenCalledWith(2, 3, TowerType.BASIC, 10, 10);
      expect(meshRegistrySpy.towerMeshes.get('2-3')).toBe(fakeMesh);
      expect(fakeScene.children).toContain(fakeMesh);
      expect(meshRegistrySpy.rebuildTowerChildrenArray).toHaveBeenCalled();
      expect(result).toBe(fakeMesh);

      fakeMesh.clear();
    });
  });

  describe('removeMesh', () => {
    it('should remove mesh from scene, dispose, delete from registry, and rebuild array', () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial();
      const child = new THREE.Mesh(geo, mat);
      const group = new THREE.Group();
      group.add(child);

      fakeScene.add(group);
      meshRegistrySpy.towerMeshes.set('1-2', group);

      service.removeMesh('1-2');

      expect(fakeScene.children).not.toContain(group);
      expect(meshRegistrySpy.towerMeshes.has('1-2')).toBeFalse();
      expect(meshRegistrySpy.rebuildTowerChildrenArray).toHaveBeenCalled();
    });

    it('should be a no-op when key is not in registry', () => {
      service.removeMesh('99-99');
      expect(meshRegistrySpy.rebuildTowerChildrenArray).not.toHaveBeenCalled();
    });

    it('should mark group as selling and defer disposal when animated=true', () => {
      const group = new THREE.Group();
      fakeScene.add(group);
      meshRegistrySpy.towerMeshes.set('3-4', group);

      service.removeMesh('3-4', true);

      // Group still in scene (not removed yet) and still in registry
      expect(fakeScene.children).toContain(group);
      expect(meshRegistrySpy.towerMeshes.has('3-4')).toBeTrue();
      // Selling flag and start time must be written
      expect(group.userData['selling']).toBeTrue();
      expect(typeof group.userData['sellingStart']).toBe('number');
      // Rebuild still called so animation ticks track the selling group
      expect(meshRegistrySpy.rebuildTowerChildrenArray).toHaveBeenCalled();

      group.clear();
    });

    it('should remove synchronously when animated=false even if selling was set', () => {
      const group = new THREE.Group();
      group.userData['selling'] = true; // simulate interrupted animation
      fakeScene.add(group);
      meshRegistrySpy.towerMeshes.set('5-6', group);

      service.removeMesh('5-6', false);

      expect(fakeScene.children).not.toContain(group);
      expect(meshRegistrySpy.towerMeshes.has('5-6')).toBeFalse();
    });
  });
});
