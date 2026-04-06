import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TileHighlightService } from './tile-highlight.service';
import { GameBoardService } from '../game-board.service';
import { GameStateService } from './game-state.service';
import { TilePricingService, TilePriceInfo } from './tile-pricing.service';
import { PriceLabelService } from './price-label.service';
import { TILE_EMISSIVE, HEATMAP_GRADIENT } from '../constants/ui.constants';
import { BlockType, GameBoardTile } from '../models/game-board-tile';
import { TowerType } from '../models/tower.model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMesh(row: number, col: number, type: BlockType = BlockType.BASE): THREE.Mesh {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData['row'] = row;
  mesh.userData['col'] = col;
  mesh.userData['tile'] = { type };
  return mesh;
}

function makePriceInfo(cost: number, strategicMultiplier: number, percentIncrease = 0): TilePriceInfo {
  return {
    cost,
    strategicMultiplier,
    percentIncrease,
    tier: 'base',
    isPremium: false,
  };
}

function makeTile(
  row: number,
  col: number,
  type: BlockType = BlockType.BASE,
  isPurchasable = true,
  towerType: TowerType | null = null
): GameBoardTile {
  // GameBoardTile stores position as x/y (x=row, y=col) internally
  const tile = new GameBoardTile(row, col, type, type !== BlockType.WALL, isPurchasable, 0, towerType);
  return tile;
}

function makeTileMeshes(specs: Array<{ row: number; col: number; type?: BlockType }>): Map<string, THREE.Mesh> {
  const map = new Map<string, THREE.Mesh>();
  for (const spec of specs) {
    const mesh = makeMesh(spec.row, spec.col, spec.type ?? BlockType.BASE);
    map.set(`${spec.row}-${spec.col}`, mesh);
  }
  return map;
}

function disposeMeshMap(meshes: Map<string, THREE.Mesh>): void {
  for (const mesh of meshes.values()) {
    mesh.geometry.dispose();
    (mesh.material as THREE.MeshStandardMaterial).dispose();
  }
}

// ---------------------------------------------------------------------------
// TileHighlightService
// ---------------------------------------------------------------------------

describe('TileHighlightService', () => {
  let service: TileHighlightService;
  let boardSpy: jasmine.SpyObj<GameBoardService>;
  let stateSpy: jasmine.SpyObj<GameStateService>;
  let pricingSpy: jasmine.SpyObj<TilePricingService>;
  let labelSpy: jasmine.SpyObj<PriceLabelService>;
  let scene: THREE.Scene;

  beforeEach(() => {
    boardSpy = jasmine.createSpyObj<GameBoardService>(
      'GameBoardService',
      ['getGameBoard', 'getBoardWidth', 'getBoardHeight', 'getTileSize']
    );
    stateSpy = jasmine.createSpyObj<GameStateService>(
      'GameStateService',
      ['canAfford']
    );
    pricingSpy = jasmine.createSpyObj<TilePricingService>(
      'TilePricingService',
      ['getTilePrice', 'getTilePriceMap']
    );
    labelSpy = jasmine.createSpyObj<PriceLabelService>(
      'PriceLabelService',
      ['showLabels', 'hideLabels']
    );

    boardSpy.getBoardWidth.and.returnValue(5);
    boardSpy.getBoardHeight.and.returnValue(5);
    boardSpy.getTileSize.and.returnValue(1);
    pricingSpy.getTilePriceMap.and.returnValue(new Map());

    TestBed.configureTestingModule({
      providers: [
        TileHighlightService,
        { provide: GameBoardService,   useValue: boardSpy  },
        { provide: GameStateService,   useValue: stateSpy  },
        { provide: TilePricingService, useValue: pricingSpy },
        { provide: PriceLabelService,  useValue: labelSpy  },
      ],
    });
    service = TestBed.inject(TileHighlightService);
    scene = new THREE.Scene();
  });

  afterEach(() => {
    scene.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // updateHighlights — affordable tiles
  // ---------------------------------------------------------------------------

  describe('updateHighlights', () => {
    it('marks affordable BASE tiles as highlighted', () => {
      const board = [
        [makeTile(0, 0), makeTile(0, 1)],
        [makeTile(1, 0), makeTile(1, 1)],
      ];
      boardSpy.getGameBoard.and.returnValue(board);
      pricingSpy.getTilePrice.and.returnValue(makePriceInfo(100, 0.3));
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([
        { row: 0, col: 0 }, { row: 0, col: 1 },
        { row: 1, col: 0 }, { row: 1, col: 1 },
      ]);

      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      expect(service.isHighlighted('0-0')).toBeTrue();
      expect(service.isHighlighted('0-1')).toBeTrue();
      expect(service.isHighlighted('1-0')).toBeTrue();
      expect(service.isHighlighted('1-1')).toBeTrue();

      disposeMeshMap(tileMeshes);
    });

    it('applies heatmap emissive color to affordable tiles', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      pricingSpy.getTilePrice.and.returnValue(makePriceInfo(50, 0.0)); // min strategic value
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      const mesh = tileMeshes.get('0-0')!;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      // At strategic value 0.0 heatmap returns green stop (first gradient stop)
      expect(mat.emissiveIntensity).toBeGreaterThan(0);
      expect(mesh.userData['heatmapR']).toBeDefined();
      expect(mesh.userData['heatmapG']).toBeDefined();
      expect(mesh.userData['heatmapB']).toBeDefined();
      expect(mesh.userData['heatmapIntensity']).toBeDefined();

      disposeMeshMap(tileMeshes);
    });

    it('dims emissive for unaffordable-but-valid tiles', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      pricingSpy.getTilePrice.and.returnValue(makePriceInfo(200, 0.5));
      stateSpy.canAfford.and.returnValue(false); // cannot afford

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      const mesh = tileMeshes.get('0-0')!;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const { color, intensity } = service.interpolateHeatmap(0.5);
      const dim = TILE_EMISSIVE.unaffordableDimming;

      expect(mat.emissiveIntensity).toBeCloseTo(intensity * dim, 5);
      expect(mesh.userData['heatmapIntensity']).toBeCloseTo(intensity * dim, 5);
      expect(mesh.userData['heatmapR']).toBeCloseTo(color.r * dim, 5);

      disposeMeshMap(tileMeshes);
    });

    it('skips the selected tile', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      pricingSpy.getTilePrice.and.returnValue(makePriceInfo(50, 0.0));
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, { row: 0, col: 0 }, scene, 1);

      expect(service.isHighlighted('0-0')).toBeFalse();

      disposeMeshMap(tileMeshes);
    });

    it('skips non-BASE tiles', () => {
      const board = [[makeTile(0, 0, BlockType.WALL)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0, type: BlockType.WALL }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      expect(service.isHighlighted('0-0')).toBeFalse();
      expect(pricingSpy.getTilePrice).not.toHaveBeenCalled();

      disposeMeshMap(tileMeshes);
    });

    it('skips tiles with a tower already placed', () => {
      const board = [[makeTile(0, 0, BlockType.BASE, true, TowerType.BASIC)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      expect(service.isHighlighted('0-0')).toBeFalse();

      disposeMeshMap(tileMeshes);
    });

    it('calls showLabels when highlighted tiles exist', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      pricingSpy.getTilePrice.and.returnValue(makePriceInfo(50, 0.0));
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      expect(labelSpy.showLabels).toHaveBeenCalled();

      disposeMeshMap(tileMeshes);
    });

    it('does not call showLabels when no tiles are highlighted', () => {
      // Board is empty — loop never reaches highlighting
      boardSpy.getGameBoard.and.returnValue([]);
      const tileMeshes = new Map<string, THREE.Mesh>();
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      expect(labelSpy.showLabels).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // clearHighlights
  // ---------------------------------------------------------------------------

  describe('clearHighlights', () => {
    it('restores original emissive values on all highlighted tiles', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      pricingSpy.getTilePrice.and.returnValue(makePriceInfo(50, 0.3));
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      // Verify it was highlighted first
      expect(service.isHighlighted('0-0')).toBeTrue();

      service.clearHighlights(tileMeshes, scene);

      const mesh = tileMeshes.get('0-0')!;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.emissiveIntensity).toBe(TILE_EMISSIVE.base);
      expect(service.isHighlighted('0-0')).toBeFalse();
      expect(mesh.userData['heatmapR']).toBeUndefined();

      disposeMeshMap(tileMeshes);
    });

    it('clears the highlightedTiles set', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      pricingSpy.getTilePrice.and.returnValue(makePriceInfo(50, 0.3));
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);
      service.clearHighlights(tileMeshes, scene);

      expect(service.getHighlightedTiles().size).toBe(0);

      disposeMeshMap(tileMeshes);
    });

    it('calls hideLabels on the scene', () => {
      boardSpy.getGameBoard.and.returnValue([]);
      service.clearHighlights(new Map(), scene);
      expect(labelSpy.hideLabels).toHaveBeenCalledWith(scene);
    });
  });

  // ---------------------------------------------------------------------------
  // restoreAfterHover
  // ---------------------------------------------------------------------------

  describe('restoreAfterHover', () => {
    it('restores heatmap color when tile is highlighted', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      pricingSpy.getTilePrice.and.returnValue(makePriceInfo(50, 0.3));
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      const mesh = tileMeshes.get('0-0')!;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      // Simulate hover by bumping emissiveIntensity
      mat.emissiveIntensity = TILE_EMISSIVE.hover;

      service.restoreAfterHover(mesh);

      expect(mat.emissiveIntensity).toBeCloseTo(mesh.userData['heatmapIntensity'], 5);

      disposeMeshMap(tileMeshes);
    });

    it('restores BASE emissive when tile is not highlighted', () => {
      const mesh = makeMesh(1, 1, BlockType.BASE);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = TILE_EMISSIVE.hover;

      // No highlights active
      service.restoreAfterHover(mesh);

      expect(mat.emissiveIntensity).toBe(TILE_EMISSIVE.base);

      mesh.geometry.dispose();
      mat.dispose();
    });

    it('restores WALL emissive when tile is not highlighted', () => {
      const mesh = makeMesh(1, 1, BlockType.WALL);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = TILE_EMISSIVE.hover;

      service.restoreAfterHover(mesh);

      expect(mat.emissiveIntensity).toBe(TILE_EMISSIVE.wall);

      mesh.geometry.dispose();
      mat.dispose();
    });

    it('restores special emissive for non-BASE/WALL types', () => {
      const mesh = makeMesh(1, 1, BlockType.SPAWNER);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = TILE_EMISSIVE.hover;

      service.restoreAfterHover(mesh);

      expect(mat.emissiveIntensity).toBe(TILE_EMISSIVE.special);

      mesh.geometry.dispose();
      mat.dispose();
    });
  });

  // ---------------------------------------------------------------------------
  // interpolateHeatmap
  // ---------------------------------------------------------------------------

  describe('interpolateHeatmap', () => {
    it('returns first stop color for value 0', () => {
      const result = service.interpolateHeatmap(0);
      const first = HEATMAP_GRADIENT[0];
      expect(result.color.r).toBeCloseTo(first[1], 5);
      expect(result.color.g).toBeCloseTo(first[2], 5);
      expect(result.color.b).toBeCloseTo(first[3], 5);
      expect(result.intensity).toBeCloseTo(first[4], 5);
    });

    it('returns last stop color for maximum value', () => {
      const stops = HEATMAP_GRADIENT;
      const maxVal = stops[stops.length - 1][0];
      const result = service.interpolateHeatmap(maxVal);
      const last = stops[stops.length - 1];
      expect(result.color.r).toBeCloseTo(last[1], 5);
      expect(result.color.g).toBeCloseTo(last[2], 5);
      expect(result.color.b).toBeCloseTo(last[3], 5);
      expect(result.intensity).toBeCloseTo(last[4], 5);
    });

    it('clamps values below 0 to the first stop', () => {
      const result = service.interpolateHeatmap(-1);
      const first = HEATMAP_GRADIENT[0];
      expect(result.color.r).toBeCloseTo(first[1], 5);
    });

    it('clamps values above max to the last stop', () => {
      const stops = HEATMAP_GRADIENT;
      const result = service.interpolateHeatmap(999);
      const last = stops[stops.length - 1];
      expect(result.color.r).toBeCloseTo(last[1], 5);
    });

    it('interpolates linearly between stops', () => {
      // Mid-point between stop[0] and stop[1] should average their values
      const stops = HEATMAP_GRADIENT;
      const midVal = (stops[0][0] + stops[1][0]) / 2;
      const result = service.interpolateHeatmap(midVal);
      const expectedR = (stops[0][1] + stops[1][1]) / 2;
      expect(result.color.r).toBeCloseTo(expectedR, 5);
    });
  });

  // ---------------------------------------------------------------------------
  // isHighlighted / getHighlightedTiles
  // ---------------------------------------------------------------------------

  describe('isHighlighted', () => {
    it('returns false for unhighlighted key', () => {
      expect(service.isHighlighted('2-3')).toBeFalse();
    });

    it('returns true after highlighting', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      pricingSpy.getTilePrice.and.returnValue(makePriceInfo(50, 0.0));
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      expect(service.isHighlighted('0-0')).toBeTrue();

      disposeMeshMap(tileMeshes);
    });
  });

  describe('getHighlightedTiles', () => {
    it('returns a ReadonlySet', () => {
      expect(service.getHighlightedTiles()).toEqual(jasmine.any(Set));
    });

    it('reflects current highlight state', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      pricingSpy.getTilePrice.and.returnValue(makePriceInfo(50, 0.0));
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      expect(service.getHighlightedTiles().has('0-0')).toBeTrue();
      expect(service.getHighlightedTiles().size).toBe(1);

      disposeMeshMap(tileMeshes);
    });
  });
});
