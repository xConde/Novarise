import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

import { LinkMeshService } from './link-mesh.service';
import { TowerGraphService } from './tower-graph.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { GameBoardService } from '../game-board.service';
import { PlacedTower, TowerType, DEFAULT_TARGETING_MODE } from '../models/tower.model';

describe('LinkMeshService (Conduit visualization)', () => {
  let service: LinkMeshService;
  let graph: TowerGraphService;
  let registry: BoardMeshRegistryService;
  let scene: THREE.Scene;
  let placedTowers: Map<string, PlacedTower>;

  function buildTower(row: number, col: number): PlacedTower {
    return {
      id: `${row}-${col}`,
      type: TowerType.BASIC,
      level: 1,
      row,
      col,
      kills: 0,
      totalInvested: 0,
      targetingMode: DEFAULT_TARGETING_MODE,
      mesh: null,
    };
  }

  function place(row: number, col: number): PlacedTower {
    const t = buildTower(row, col);
    placedTowers.set(t.id, t);
    // Populate the registry's tower mesh map so buildLineGeometry has positions.
    const group = new THREE.Group();
    group.position.set(row, 1, col);
    registry.towerMeshes.set(t.id, group);
    graph.registerTower(t);
    return t;
  }

  beforeEach(() => {
    placedTowers = new Map();
    scene = new THREE.Scene();

    TestBed.configureTestingModule({
      providers: [
        LinkMeshService,
        TowerGraphService,
        BoardMeshRegistryService,
        GameBoardService,
      ],
    });
    graph = TestBed.inject(TowerGraphService);
    registry = TestBed.inject(BoardMeshRegistryService);
    service = TestBed.inject(LinkMeshService);
    graph.setPlacedTowersGetter(() => placedTowers);
    service.attachScene(scene);
  });

  afterEach(() => {
    service.dispose();
    // Extra defensive: ensure the scene doesn't hold dangling THREE objects.
    scene.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material?.dispose();
      }
    });
  });

  it('creates a line when two 4-dir-adjacent towers are placed', () => {
    place(5, 5);
    place(5, 6);
    expect(service.getLineCount()).toBe(1);
  });

  it('removes a line when a tower is unregistered', () => {
    place(5, 5);
    place(5, 6);
    expect(service.getLineCount()).toBe(1);
    graph.unregisterTower('5-5');
    placedTowers.delete('5-5');
    expect(service.getLineCount()).toBe(0);
  });

  it('creates N edges for N adjacencies (plus-shape: 4 edges)', () => {
    place(5, 5); // center
    place(4, 5); // up
    place(6, 5); // down
    place(5, 4); // left
    place(5, 6); // right
    expect(service.getLineCount()).toBe(4);
  });

  it('creates a virtual-edge line on addVirtualEdge', () => {
    place(5, 5);
    place(10, 10);
    expect(service.getLineCount()).toBe(0); // not adjacent spatially
    graph.addVirtualEdge(5, 5, 10, 10, /* expiresOnTurn */ 100, 'src');
    expect(service.getLineCount()).toBe(1);
  });

  it('removes the virtual-edge line when tickTurn hits expiry', () => {
    place(5, 5);
    place(10, 10);
    graph.addVirtualEdge(5, 5, 10, 10, /* expiresOnTurn */ 10, 'src');
    expect(service.getLineCount()).toBe(1);
    graph.tickTurn(10);
    expect(service.getLineCount()).toBe(0);
  });

  it('dispose() drops all lines and disposes shared materials', () => {
    place(5, 5);
    place(5, 6);
    place(10, 10);
    graph.addVirtualEdge(5, 5, 10, 10, 100, 'src');
    expect(service.getLineCount()).toBe(2);

    service.dispose();
    expect(service.getLineCount()).toBe(0);

    // Subsequent events are no-ops (no scene attached after dispose).
    place(6, 6); // no-op — dispose already happened
    expect(service.getLineCount()).toBe(0);
  });

  it('idempotent edge-added events do not create duplicate lines', () => {
    place(5, 5);
    place(5, 6);
    const line = (service as any).lines.get('5-5__5-6') as THREE.Line;
    expect(line).toBeTruthy();

    // Simulate a spurious re-emit of the same edge.
    (graph as any).edgesAddedSubject.next({ a: '5-5', b: '5-6', kind: 'spatial' });
    const lineAfter = (service as any).lines.get('5-5__5-6') as THREE.Line;
    expect(lineAfter).toBe(line); // same instance — no duplicate
    expect(service.getLineCount()).toBe(1);
  });

  it('spatial and virtual edges use different shared materials', () => {
    place(5, 5);
    place(5, 6); // spatial edge
    place(10, 10);
    graph.addVirtualEdge(5, 5, 10, 10, 100, 'src'); // virtual edge

    const spatialLine = (service as any).lines.get('5-5__5-6') as THREE.Line;
    // Canonical key lex-orders the endpoints: "10-10" < "5-5" (first char '1' < '5').
    const virtualLine = (service as any).lines.get('10-10__5-5') as THREE.Line;

    expect(spatialLine.material).not.toBe(virtualLine.material);
  });

  it('reuses the same spatial material across all spatial edges', () => {
    place(5, 5);
    place(5, 6);
    place(6, 5);
    const a = (service as any).lines.get('5-5__5-6') as THREE.Line;
    const b = (service as any).lines.get('5-5__6-5') as THREE.Line;
    expect(a.material).toBe(b.material);
  });

  it('without attachScene, events are buffered-but-not-rendered (stub-safe)', () => {
    // Fresh service without attachScene.
    const freshGraph = new TowerGraphService();
    freshGraph.setPlacedTowersGetter(() => placedTowers);
    const freshRegistry = new BoardMeshRegistryService();
    const freshGameBoard = new GameBoardService();
    const fresh = new LinkMeshService(freshGraph, freshRegistry, freshGameBoard);

    const t1 = buildTower(5, 5);
    const t2 = buildTower(5, 6);
    placedTowers.set(t1.id, t1);
    placedTowers.set(t2.id, t2);
    freshGraph.registerTower(t1);
    freshGraph.registerTower(t2);

    expect(fresh.getLineCount()).toBe(0); // scene not attached → line creation skipped
    fresh.dispose();
  });
});
