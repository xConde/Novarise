import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TileHighlightService } from './tile-highlight.service';
import { GameBoardService } from '../game-board.service';
import { GameStateService } from './game-state.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { TILE_EMISSIVE } from '../constants/ui.constants';
import { BlockType, GameBoardTile } from '../models/game-board-tile';
import { TowerType } from '../models/tower.model';
import { TileInstanceLayer } from './tile-instance-layer';

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

function makeTile(
  row: number,
  col: number,
  type: BlockType = BlockType.BASE,
  isPurchasable = true,
  towerType: TowerType | null = null
): GameBoardTile {
  return new GameBoardTile(row, col, type, type !== BlockType.WALL, isPurchasable, 0, towerType);
}

/**
 * Register `coords` as INDIVIDUAL tile meshes in the registry. Caller
 * disposes them via cleanupRegistry().
 */
function registerIndividualTiles(
  registry: BoardMeshRegistryService,
  coords: Array<{ row: number; col: number; type?: BlockType }>,
): void {
  for (const c of coords) {
    const m = makeMesh(c.row, c.col, c.type ?? BlockType.BASE);
    registry.tileMeshes.set(`${c.row}-${c.col}`, m);
  }
  registry.rebuildTileMeshArray();
}

/**
 * Register a single InstancedMesh layer covering the given coords.
 */
function registerInstancedLayer(
  registry: BoardMeshRegistryService,
  blockType: BlockType,
  coords: Array<{ row: number; col: number }>,
): TileInstanceLayer {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x404858 });
  const layer = new TileInstanceLayer(blockType, geo, mat, coords.map(c => ({
    row: c.row, col: c.col, worldX: c.col, worldZ: c.row, worldY: 0.1,
  })));
  registry.tileInstanceLayers.set(blockType, layer);
  registry.rebuildTilePickables();
  return layer;
}

function cleanupRegistry(registry: BoardMeshRegistryService): void {
  registry.tileMeshes.forEach(m => {
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  });
  registry.tileInstanceLayers.forEach(layer => {
    layer.mesh.geometry.dispose();
    (layer.mesh.material as THREE.Material).dispose();
    layer.dispose();
  });
  registry.clear();
}

// ---------------------------------------------------------------------------

describe('TileHighlightService', () => {
  let service: TileHighlightService;
  let registry: BoardMeshRegistryService;
  let boardSpy: jasmine.SpyObj<GameBoardService>;
  let stateSpy: jasmine.SpyObj<GameStateService>;

  beforeEach(() => {
    boardSpy = jasmine.createSpyObj<GameBoardService>(
      'GameBoardService',
      ['getGameBoard', 'getBoardWidth', 'getBoardHeight', 'getTileSize', 'wouldBlockPath'],
    );
    stateSpy = jasmine.createSpyObj<GameStateService>('GameStateService', ['canAfford']);

    boardSpy.getBoardWidth.and.returnValue(5);
    boardSpy.getBoardHeight.and.returnValue(5);
    boardSpy.getTileSize.and.returnValue(1);
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
  });

  afterEach(() => {
    cleanupRegistry(registry);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Individual-surface (non-BASE in sprint 22) — emissive mutation path
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateHighlights — individual surface', () => {
    it('marks affordable BASE tiles as highlighted', () => {
      const board = [
        [makeTile(0, 0), makeTile(0, 1)],
        [makeTile(1, 0), makeTile(1, 1)],
      ];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);
      registerIndividualTiles(registry, [
        { row: 0, col: 0 }, { row: 0, col: 1 },
        { row: 1, col: 0 }, { row: 1, col: 1 },
      ]);

      service.updateHighlights(TowerType.BASIC, null, 1);

      expect(service.isHighlighted('0-0')).toBeTrue();
      expect(service.isHighlighted('0-1')).toBeTrue();
      expect(service.isHighlighted('1-0')).toBeTrue();
      expect(service.isHighlighted('1-1')).toBeTrue();
    });

    it('applies emissive intensity to highlighted tiles on individual surface', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);
      registerIndividualTiles(registry, [{ row: 0, col: 0 }]);

      service.updateHighlights(TowerType.BASIC, null, 1);

      const mesh = registry.tileMeshes.get('0-0')!;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.emissiveIntensity).toBeCloseTo(TILE_EMISSIVE.validPlacement, 5);
    });

    it('dims emissive intensity for unaffordable tiles', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(false);
      registerIndividualTiles(registry, [{ row: 0, col: 0 }]);

      service.updateHighlights(TowerType.BASIC, null, 1);

      const mat = registry.tileMeshes.get('0-0')!.material as THREE.MeshStandardMaterial;
      const expected = TILE_EMISSIVE.validPlacement * TILE_EMISSIVE.unaffordableDimming;
      expect(mat.emissiveIntensity).toBeCloseTo(expected, 5);
    });

    it('skips the selected tile', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);
      registerIndividualTiles(registry, [{ row: 0, col: 0 }]);

      service.updateHighlights(TowerType.BASIC, { row: 0, col: 0 }, 1);

      expect(service.isHighlighted('0-0')).toBeFalse();
    });

    it('skips non-BASE tiles', () => {
      const board = [[makeTile(0, 0, BlockType.WALL)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);
      registerIndividualTiles(registry, [{ row: 0, col: 0, type: BlockType.WALL }]);

      service.updateHighlights(TowerType.BASIC, null, 1);

      expect(service.isHighlighted('0-0')).toBeFalse();
    });

    it('skips tiles with a tower already placed', () => {
      const board = [[makeTile(0, 0, BlockType.BASE, true, TowerType.BASIC)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);
      registerIndividualTiles(registry, [{ row: 0, col: 0 }]);

      service.updateHighlights(TowerType.BASIC, null, 1);

      expect(service.isHighlighted('0-0')).toBeFalse();
    });

    it('uses blocked tint for path-blocking tiles', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);
      boardSpy.wouldBlockPath.and.returnValue(true);
      registerIndividualTiles(registry, [{ row: 0, col: 0 }]);

      service.updateHighlights(TowerType.BASIC, null, 1);

      const mat = registry.tileMeshes.get('0-0')!.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(TILE_EMISSIVE.blockedPlacementColor);
      expect(mat.emissiveIntensity).toBeCloseTo(TILE_EMISSIVE.blockedPlacement, 5);
    });
  });

  describe('clearHighlights — individual surface', () => {
    it('restores emissive after highlighting', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);
      registerIndividualTiles(registry, [{ row: 0, col: 0 }]);
      const mat = registry.tileMeshes.get('0-0')!.material as THREE.MeshStandardMaterial;
      const originalEmissive = mat.emissive.getHex();
      const originalIntensity = mat.emissiveIntensity;

      service.updateHighlights(TowerType.BASIC, null, 1);
      service.clearHighlights();

      expect(mat.emissive.getHex()).toBe(originalEmissive);
      expect(mat.emissiveIntensity).toBe(originalIntensity);
      expect(service.isHighlighted('0-0')).toBeFalse();
    });

    it('is idempotent', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);
      registerIndividualTiles(registry, [{ row: 0, col: 0 }]);

      service.updateHighlights(TowerType.BASIC, null, 1);
      service.clearHighlights();
      expect(() => service.clearHighlights()).not.toThrow();
    });
  });

  describe('hover (individual surface)', () => {
    it('applyHoverByCoord bumps emissive', () => {
      registerIndividualTiles(registry, [{ row: 0, col: 0 }]);
      const mat = registry.tileMeshes.get('0-0')!.material as THREE.MeshStandardMaterial;
      const before = mat.emissiveIntensity;

      service.applyHoverByCoord(0, 0);

      expect(mat.emissiveIntensity).toBeCloseTo(TILE_EMISSIVE.hover, 5);
      expect(mat.emissiveIntensity).not.toBe(before);
    });

    it('restoreAfterHoverByCoord restores prior emissive', () => {
      registerIndividualTiles(registry, [{ row: 0, col: 0 }]);
      const mat = registry.tileMeshes.get('0-0')!.material as THREE.MeshStandardMaterial;
      const originalIntensity = mat.emissiveIntensity;

      service.applyHoverByCoord(0, 0);
      service.restoreAfterHoverByCoord(0, 0);

      expect(mat.emissiveIntensity).toBe(originalIntensity);
    });

    it('restoring an unhovered tile is a no-op', () => {
      registerIndividualTiles(registry, [{ row: 0, col: 0 }]);
      const mat = registry.tileMeshes.get('0-0')!.material as THREE.MeshStandardMaterial;
      const originalIntensity = mat.emissiveIntensity;

      service.restoreAfterHoverByCoord(0, 0);

      expect(mat.emissiveIntensity).toBe(originalIntensity);
    });
  });

  describe('selection (individual surface)', () => {
    it('applySelectionByCoord raises emissive to selected level', () => {
      registerIndividualTiles(registry, [{ row: 0, col: 0 }]);
      const mat = registry.tileMeshes.get('0-0')!.material as THREE.MeshStandardMaterial;

      service.applySelectionByCoord(0, 0);

      expect(mat.emissiveIntensity).toBeCloseTo(TILE_EMISSIVE.selected, 5);
    });

    it('restoreSelectionByCoord undoes selection', () => {
      registerIndividualTiles(registry, [{ row: 0, col: 0 }]);
      const mat = registry.tileMeshes.get('0-0')!.material as THREE.MeshStandardMaterial;
      const originalIntensity = mat.emissiveIntensity;

      service.applySelectionByCoord(0, 0);
      service.restoreSelectionByCoord(0, 0);

      expect(mat.emissiveIntensity).toBe(originalIntensity);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Instanced surface — instanceColor mutation path
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateHighlights — instanced surface', () => {
    it('mutates per-instance color, NOT the shared material emissive', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);
      const layer = registerInstancedLayer(registry, BlockType.BASE, [{ row: 0, col: 0 }]);
      const mat = layer.mesh.material as THREE.MeshStandardMaterial;
      const sharedEmissiveBefore = mat.emissive.getHex();

      service.updateHighlights(TowerType.BASIC, null, 1);

      const c = layer.getColorAt(0, 0)!;
      // The instanceColor was changed off identity (1, 1, 1)
      const isIdentity = c.r === 1 && c.g === 1 && c.b === 1;
      expect(isIdentity).toBeFalse();
      // Crucially, the shared material's emissive was NOT mutated.
      expect(mat.emissive.getHex()).toBe(sharedEmissiveBefore);
    });

    it('two instanced BASE tiles get DIFFERENT instanceColors after highlight', () => {
      const board = [
        [makeTile(0, 0), makeTile(0, 1)],
      ];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);
      // path-blocking is per-tile; mark (0,1) blocked, (0,0) not.
      boardSpy.wouldBlockPath.and.callFake((r, c) => r === 0 && c === 1);
      const layer = registerInstancedLayer(registry, BlockType.BASE, [
        { row: 0, col: 0 }, { row: 0, col: 1 },
      ]);

      service.updateHighlights(TowerType.BASIC, null, 1);

      const c0 = layer.getColorAt(0, 0)!;
      const c1 = layer.getColorAt(0, 1)!;
      // Compare raw RGB channels — getHex() clamps to [0,1] but the tint
      // formula intentionally pushes values above 1.0 for HDR tone mapping.
      const equal = c0.r === c1.r && c0.g === c1.g && c0.b === c1.b;
      expect(equal).toBeFalse();
    });
  });

  describe('clearHighlights — instanced surface', () => {
    it('restores instance color to the prior value', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);
      const layer = registerInstancedLayer(registry, BlockType.BASE, [{ row: 0, col: 0 }]);
      const before = layer.getColorAt(0, 0)!.clone();

      service.updateHighlights(TowerType.BASIC, null, 1);
      service.clearHighlights();

      const after = layer.getColorAt(0, 0)!;
      expect(after.r).toBeCloseTo(before.r, 5);
      expect(after.g).toBeCloseTo(before.g, 5);
      expect(after.b).toBeCloseTo(before.b, 5);
    });
  });

  describe('hover (instanced surface) — does NOT alias siblings', () => {
    it('applyHoverByCoord on tile A leaves tile B at identity color', () => {
      const layer = registerInstancedLayer(registry, BlockType.BASE, [
        { row: 0, col: 0 }, { row: 0, col: 1 },
      ]);

      service.applyHoverByCoord(0, 0);

      const cB = layer.getColorAt(0, 1)!;
      expect(cB.r).toBeCloseTo(1, 5);
      expect(cB.g).toBeCloseTo(1, 5);
      expect(cB.b).toBeCloseTo(1, 5);
    });
  });
});
