/**
 * Phase C merge-readiness — tint formula regression lock.
 *
 * `applyTileTint` for the instanced surface uses an HDR brightening
 * formula `instanceColor = (1 + tintR*I, 1 + tintG*I, 1 + tintB*I)`.
 * The math intentionally pushes channels >1 so the ACES tone-mapping
 * pipeline brightens visibly. Headless can't render the actual pixel,
 * but it CAN lock the math: if the formula is ever inadvertently
 * changed (e.g. a future refactor switches to `lerp(white, tint, ...)`
 * which would darken on non-1 channels), this spec fires.
 *
 * Covers WebGL gap risks #1–4 in the merge-readiness checklist:
 * tile tint visual consistency, affordable/unaffordable distinguishability,
 * blocked/valid distinguishability, hover/selected/highlighted distinguishability.
 */

import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TileHighlightService } from './tile-highlight.service';
import { GameBoardService } from '../game-board.service';
import { GameStateService } from './game-state.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { TileInstanceLayer } from './tile-instance-layer';
import { TILE_EMISSIVE } from '../constants/ui.constants';
import { BlockType, GameBoardTile } from '../models/game-board-tile';
import { TowerType } from '../models/tower.model';

describe('TileHighlight tint formula regression (merge-readiness)', () => {
  let service: TileHighlightService;
  let registry: BoardMeshRegistryService;
  let boardSpy: jasmine.SpyObj<GameBoardService>;
  let stateSpy: jasmine.SpyObj<GameStateService>;
  let layer: TileInstanceLayer;
  const scene = new THREE.Scene();

  function expectedTintFor(emissiveHex: number, intensity: number): { r: number; g: number; b: number } {
    const c = new THREE.Color(emissiveHex);
    const i = Math.max(0, Math.min(intensity, 2));
    return {
      r: 1 + c.r * i,
      g: 1 + c.g * i,
      b: 1 + c.b * i,
    };
  }

  beforeEach(() => {
    boardSpy = jasmine.createSpyObj<GameBoardService>(
      'GameBoardService',
      ['getGameBoard', 'getBoardWidth', 'getBoardHeight', 'getTileSize', 'wouldBlockPath'],
    );
    stateSpy = jasmine.createSpyObj<GameStateService>('GameStateService', ['canAfford']);
    boardSpy.wouldBlockPath.and.returnValue(false);

    TestBed.configureTestingModule({
      providers: [
        TileHighlightService,
        BoardMeshRegistryService,
        { provide: GameBoardService, useValue: boardSpy },
        { provide: GameStateService, useValue: stateSpy },
      ],
    });
    service = TestBed.inject(TileHighlightService);
    registry = TestBed.inject(BoardMeshRegistryService);

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial();
    layer = new TileInstanceLayer(BlockType.BASE, geo, mat, [
      { row: 0, col: 0, worldX: 0, worldZ: 0, worldY: 0.1 },
      { row: 0, col: 1, worldX: 1, worldZ: 0, worldY: 0.1 },
      { row: 0, col: 2, worldX: 2, worldZ: 0, worldY: 0.1 },
    ]);
    registry.tileInstanceLayers.set(BlockType.BASE, layer);
    registry.rebuildTilePickables();
  });

  afterEach(() => {
    layer.mesh.geometry.dispose();
    (layer.mesh.material as THREE.Material).dispose();
    layer.dispose(scene);
    registry.clear();
  });

  function makeTile(row: number, col: number): GameBoardTile {
    return new GameBoardTile(row, col, BlockType.BASE, true, true, 0, null);
  }

  it('hover formula: emissive=0x303848, intensity=0.5', () => {
    service.applyHoverByCoord(0, 0);
    const c = layer.getColorAt(0, 0)!;
    const expected = expectedTintFor(TILE_EMISSIVE.defaultColor, TILE_EMISSIVE.hover);
    expect(c.r).toBeCloseTo(expected.r, 4);
    expect(c.g).toBeCloseTo(expected.g, 4);
    expect(c.b).toBeCloseTo(expected.b, 4);
  });

  it('selection formula: emissive=0x303848, intensity=0.8', () => {
    service.applySelectionByCoord(0, 0);
    const c = layer.getColorAt(0, 0)!;
    const expected = expectedTintFor(TILE_EMISSIVE.defaultColor, TILE_EMISSIVE.selected);
    expect(c.r).toBeCloseTo(expected.r, 4);
    expect(c.g).toBeCloseTo(expected.g, 4);
    expect(c.b).toBeCloseTo(expected.b, 4);
  });

  it('valid placement (affordable) formula: emissive=0x00ccaa, intensity=0.35', () => {
    boardSpy.getGameBoard.and.returnValue([[makeTile(0, 0)]]);
    stateSpy.canAfford.and.returnValue(true);
    service.updateHighlights(TowerType.BASIC, null, 1);

    const c = layer.getColorAt(0, 0)!;
    const expected = expectedTintFor(TILE_EMISSIVE.validPlacementColor, TILE_EMISSIVE.validPlacement);
    expect(c.r).toBeCloseTo(expected.r, 4);
    expect(c.g).toBeCloseTo(expected.g, 4);
    expect(c.b).toBeCloseTo(expected.b, 4);
  });

  it('valid placement (unaffordable) formula: dimmed by 0.35× factor', () => {
    boardSpy.getGameBoard.and.returnValue([[makeTile(0, 0)]]);
    stateSpy.canAfford.and.returnValue(false);
    service.updateHighlights(TowerType.BASIC, null, 1);

    const c = layer.getColorAt(0, 0)!;
    const intensity = TILE_EMISSIVE.validPlacement * TILE_EMISSIVE.unaffordableDimming;
    const expected = expectedTintFor(TILE_EMISSIVE.validPlacementColor, intensity);
    expect(c.r).toBeCloseTo(expected.r, 4);
    expect(c.g).toBeCloseTo(expected.g, 4);
    expect(c.b).toBeCloseTo(expected.b, 4);
  });

  it('blocked placement formula: emissive=0xcc3322, intensity=0.45', () => {
    boardSpy.getGameBoard.and.returnValue([[makeTile(0, 0)]]);
    stateSpy.canAfford.and.returnValue(true);
    boardSpy.wouldBlockPath.and.returnValue(true);
    service.updateHighlights(TowerType.BASIC, null, 1);

    const c = layer.getColorAt(0, 0)!;
    const expected = expectedTintFor(TILE_EMISSIVE.blockedPlacementColor, TILE_EMISSIVE.blockedPlacement);
    expect(c.r).toBeCloseTo(expected.r, 4);
    expect(c.g).toBeCloseTo(expected.g, 4);
    expect(c.b).toBeCloseTo(expected.b, 4);
  });

  // ───────── Distinguishability invariants — these would have caught
  // the red-team-flagged risks #2 and #3 if they had regressed. ─────────

  it('affordable vs unaffordable: at LEAST one channel differs by >5%', () => {
    boardSpy.getGameBoard.and.returnValue([[makeTile(0, 0)]]);
    stateSpy.canAfford.and.returnValue(true);
    service.updateHighlights(TowerType.BASIC, null, 1);
    const affordable = layer.getColorAt(0, 0)!.clone();
    service.clearHighlights();

    stateSpy.canAfford.and.returnValue(false);
    service.updateHighlights(TowerType.BASIC, null, 1);
    const unaffordable = layer.getColorAt(0, 0)!;

    const dr = Math.abs(affordable.r - unaffordable.r);
    const dg = Math.abs(affordable.g - unaffordable.g);
    const db = Math.abs(affordable.b - unaffordable.b);
    const maxDelta = Math.max(dr, dg, db);
    expect(maxDelta)
      .withContext(`affordable=${JSON.stringify(affordable)} unaffordable=${JSON.stringify(unaffordable)}`)
      .toBeGreaterThan(0.05);
  });

  it('blocked vs valid: at LEAST one channel differs by >10% (different hue)', () => {
    boardSpy.getGameBoard.and.returnValue([[makeTile(0, 0)]]);
    stateSpy.canAfford.and.returnValue(true);
    boardSpy.wouldBlockPath.and.returnValue(false);
    service.updateHighlights(TowerType.BASIC, null, 1);
    const valid = layer.getColorAt(0, 0)!.clone();
    service.clearHighlights();

    boardSpy.wouldBlockPath.and.returnValue(true);
    service.updateHighlights(TowerType.BASIC, null, 1);
    const blocked = layer.getColorAt(0, 0)!;

    const dr = Math.abs(valid.r - blocked.r);
    const dg = Math.abs(valid.g - blocked.g);
    const maxDelta = Math.max(dr, dg);
    expect(maxDelta).toBeGreaterThan(0.1);
  });

  it('hover vs selection: selection brighter on at least one non-zero channel', () => {
    service.applyHoverByCoord(0, 0);
    const hover = layer.getColorAt(0, 0)!.clone();
    service.restoreAfterHoverByCoord(0, 0);

    service.applySelectionByCoord(0, 0);
    const selected = layer.getColorAt(0, 0)!;

    // Selection intensity (0.8) > hover intensity (0.5), same color → all channels stronger.
    expect(selected.r).toBeGreaterThan(hover.r - 1e-6);
    expect(selected.g).toBeGreaterThan(hover.g - 1e-6);
    expect(selected.b).toBeGreaterThan(hover.b - 1e-6);
    // At least one channel meaningfully different. Three.js r152+ converts
    // hex to linear-space before storing, so the dim defaultColor (0x303848
    // ≈ (0.188, 0.220, 0.282) sRGB → ~(0.029, 0.040, 0.066) linear) yields
    // small absolute deltas — but they're still visible after tone mapping.
    const maxDelta = Math.max(
      Math.abs(selected.r - hover.r),
      Math.abs(selected.g - hover.g),
      Math.abs(selected.b - hover.b),
    );
    expect(maxDelta).toBeGreaterThan(0.01);
  });
});
