import * as THREE from 'three';
import { TileInstanceLayer } from './tile-instance-layer';
import { BlockType } from '../models/game-board-tile';

interface InstanceSpec {
  row: number;
  col: number;
  worldX: number;
  worldZ: number;
  worldY: number;
}

const sampleInstances = (n: number): InstanceSpec[] => {
  const out: InstanceSpec[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      row: Math.floor(i / 5),
      col: i % 5,
      worldX: i * 0.1,
      worldZ: i * 0.2,
      worldY: 0.1,
    });
  }
  return out;
};

describe('TileInstanceLayer', () => {
  let geometry: THREE.BoxGeometry;
  let material: THREE.MeshStandardMaterial;

  beforeEach(() => {
    geometry = new THREE.BoxGeometry(0.95, 0.2, 0.95);
    material = new THREE.MeshStandardMaterial({ color: 0x404858 });
  });

  afterEach(() => {
    geometry.dispose();
    material.dispose();
  });

  describe('construction', () => {
    it('creates an InstancedMesh with the correct count', () => {
      const layer = new TileInstanceLayer(BlockType.BASE, geometry, material, sampleInstances(10));
      expect(layer.mesh).toBeInstanceOf(THREE.InstancedMesh);
      expect(layer.mesh.count).toBe(10);
      expect(layer.count).toBe(10);
      layer.dispose();
    });

    it('handles zero instances (degenerate but valid)', () => {
      const layer = new TileInstanceLayer(BlockType.BASE, geometry, material, []);
      expect(layer.count).toBe(0);
      expect(layer.mesh.count).toBe(0);
      layer.dispose();
    });

    it('records blockType on userData and as a property', () => {
      const layer = new TileInstanceLayer(BlockType.WALL, geometry, material, sampleInstances(3));
      expect(layer.blockType).toBe(BlockType.WALL);
      expect(layer.mesh.userData['blockType']).toBe(BlockType.WALL);
      layer.dispose();
    });

    it('positions each instance at the supplied world coords', () => {
      const layer = new TileInstanceLayer(BlockType.BASE, geometry, material, [
        { row: 0, col: 0, worldX: 1, worldZ: 2, worldY: 3 },
      ]);
      const m = new THREE.Matrix4();
      layer.mesh.getMatrixAt(0, m);
      const pos = new THREE.Vector3();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      m.decompose(pos, q, s);
      expect(pos.x).toBeCloseTo(1);
      expect(pos.y).toBeCloseTo(3);
      expect(pos.z).toBeCloseTo(2);
      expect(s.x).toBeCloseTo(1);
      layer.dispose();
    });

    it('initialises instanceColor to identity (1, 1, 1) for every instance', () => {
      const layer = new TileInstanceLayer(BlockType.BASE, geometry, material, sampleInstances(5));
      for (let i = 0; i < 5; i++) {
        const c = new THREE.Color();
        layer.mesh.getColorAt(i, c);
        expect(c.r).toBeCloseTo(1);
        expect(c.g).toBeCloseTo(1);
        expect(c.b).toBeCloseTo(1);
      }
      layer.dispose();
    });

    it('castShadow=false + receiveShadow=true (sprint 27 perf optimisation)', () => {
      const layer = new TileInstanceLayer(BlockType.BASE, geometry, material, sampleInstances(1));
      // Tiles are flat ground; they don't meaningfully self-shadow.
      // Cliffs/towers/enemies still cast onto these tiles via receiveShadow.
      expect(layer.mesh.castShadow).toBeFalse();
      expect(layer.mesh.receiveShadow).toBeTrue();
      layer.dispose();
    });
  });

  describe('coordinate lookup', () => {
    let layer: TileInstanceLayer;

    beforeEach(() => {
      layer = new TileInstanceLayer(BlockType.BASE, geometry, material, sampleInstances(10));
    });

    afterEach(() => {
      layer.dispose();
    });

    it('lookupCoord(instanceId) returns {row, col}', () => {
      // Index 7 of sampleInstances(10) corresponds to row=floor(7/5)=1, col=7%5=2
      const coord = layer.lookupCoord(7);
      expect(coord).toEqual({ row: 1, col: 2 });
    });

    it('lookupCoord returns null for out-of-range instanceId', () => {
      expect(layer.lookupCoord(999)).toBeNull();
    });

    it('findIndex(row, col) inverts lookupCoord', () => {
      const idx = layer.findIndex(1, 2);
      expect(idx).toBe(7);
    });

    it('findIndex returns -1 for an unknown coord', () => {
      expect(layer.findIndex(99, 99)).toBe(-1);
    });
  });

  describe('per-instance color', () => {
    let layer: TileInstanceLayer;

    beforeEach(() => {
      layer = new TileInstanceLayer(BlockType.BASE, geometry, material, sampleInstances(5));
    });

    afterEach(() => {
      layer.dispose();
    });

    it('setColorAt mutates only the targeted instance', () => {
      layer.setColorAt(0, 1, new THREE.Color(0xff0000));
      const c0 = layer.getColorAt(0, 1);
      const c1 = layer.getColorAt(0, 0);
      expect(c0!.getHex()).toBe(0xff0000);
      expect(c1!.r).toBeCloseTo(1);
      expect(c1!.g).toBeCloseTo(1);
      expect(c1!.b).toBeCloseTo(1);
    });

    it('returns false when the coord is not in the layer', () => {
      expect(layer.setColorAt(99, 99, new THREE.Color(0xff0000))).toBeFalse();
    });

    it('resetColorAt restores identity', () => {
      layer.setColorAt(0, 1, new THREE.Color(0xff0000));
      layer.resetColorAt(0, 1);
      const c = layer.getColorAt(0, 1);
      expect(c!.r).toBeCloseTo(1);
      expect(c!.g).toBeCloseTo(1);
      expect(c!.b).toBeCloseTo(1);
    });

    it('marks instanceColor.needsUpdate after a set', () => {
      const versionBefore = layer.mesh.instanceColor!.version;
      layer.setColorAt(0, 0, new THREE.Color(0xff0000));
      expect(layer.mesh.instanceColor!.version).toBeGreaterThan(versionBefore);
    });
  });

  describe('elevation', () => {
    let layer: TileInstanceLayer;

    beforeEach(() => {
      layer = new TileInstanceLayer(BlockType.BASE, geometry, material, [
        { row: 0, col: 0, worldX: 1, worldZ: 2, worldY: 0.1 },
        { row: 0, col: 1, worldX: 2, worldZ: 2, worldY: 0.1 },
      ]);
    });

    afterEach(() => {
      layer.dispose();
    });

    it('setElevationAt updates only Y for the targeted instance', () => {
      layer.setElevationAt(0, 0, 5);
      const m = new THREE.Matrix4();
      layer.mesh.getMatrixAt(0, m);
      const pos = new THREE.Vector3();
      m.decompose(pos, new THREE.Quaternion(), new THREE.Vector3());
      expect(pos.x).toBeCloseTo(1);
      expect(pos.y).toBeCloseTo(5);
      expect(pos.z).toBeCloseTo(2);
    });

    it('does not affect sibling instances', () => {
      layer.setElevationAt(0, 0, 5);
      const m = new THREE.Matrix4();
      layer.mesh.getMatrixAt(1, m);
      const pos = new THREE.Vector3();
      m.decompose(pos, new THREE.Quaternion(), new THREE.Vector3());
      expect(pos.y).toBeCloseTo(0.1);
    });

    it('showAt after hideAt restores construction Y when no elevation history', () => {
      layer.hideAt(0, 0);
      layer.showAt(0, 0);
      const m = new THREE.Matrix4();
      layer.mesh.getMatrixAt(0, m);
      const pos = new THREE.Vector3();
      m.decompose(pos, new THREE.Quaternion(), new THREE.Vector3());
      expect(pos.y).toBeCloseTo(0.1);
    });

    it('setElevationAt updates basePos so subsequent showAt restores the elevated Y (sprint 30 red-team fix)', () => {
      layer.setElevationAt(0, 0, 5);
      layer.hideAt(0, 0);
      layer.showAt(0, 0);
      const m = new THREE.Matrix4();
      layer.mesh.getMatrixAt(0, m);
      const pos = new THREE.Vector3();
      m.decompose(pos, new THREE.Quaternion(), new THREE.Vector3());
      // Pre-fix: this would snap back to 0.1 (construction Y), losing the
      // elevation. Post-fix: basePos.y was updated by setElevationAt.
      expect(pos.y).toBeCloseTo(5);
    });

    it('hideAt collapses instance scale to zero (sprint 22 red-team fix)', () => {
      layer.hideAt(0, 0);
      const m = new THREE.Matrix4();
      layer.mesh.getMatrixAt(0, m);
      const pos = new THREE.Vector3();
      const scale = new THREE.Vector3();
      m.decompose(pos, new THREE.Quaternion(), scale);
      expect(scale.x).toBeCloseTo(0, 5);
      expect(scale.y).toBeCloseTo(0, 5);
      expect(scale.z).toBeCloseTo(0, 5);
    });

    it('lookupCoord returns null for a hidden instance', () => {
      layer.hideAt(0, 0);
      expect(layer.lookupCoord(0)).toBeNull();
    });

    it('showAt restores both position AND scale, and unhides for raycast lookup', () => {
      layer.hideAt(0, 0);
      expect(layer.lookupCoord(0)).toBeNull();
      layer.showAt(0, 0);
      const m = new THREE.Matrix4();
      layer.mesh.getMatrixAt(0, m);
      const scale = new THREE.Vector3();
      m.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
      expect(scale.x).toBeCloseTo(1, 5);
      expect(layer.lookupCoord(0)).toEqual({ row: 0, col: 0 });
    });

    it('marks instanceMatrix.needsUpdate after elevation change', () => {
      const versionBefore = layer.mesh.instanceMatrix.version;
      layer.setElevationAt(0, 0, 5);
      expect(layer.mesh.instanceMatrix.version).toBeGreaterThan(versionBefore);
    });
  });

  describe('dispose', () => {
    it('detaches from scene and disposes the InstancedMesh', () => {
      const layer = new TileInstanceLayer(BlockType.BASE, geometry, material, sampleInstances(3));
      const scene = new THREE.Scene();
      scene.add(layer.mesh);
      spyOn(layer.mesh, 'dispose');
      layer.dispose(scene);
      expect(layer.mesh.dispose).toHaveBeenCalledTimes(1);
      expect(scene.children).not.toContain(layer.mesh);
    });

    it('does NOT dispose geometry or material (registry-owned)', () => {
      const layer = new TileInstanceLayer(BlockType.BASE, geometry, material, sampleInstances(3));
      spyOn(geometry, 'dispose');
      spyOn(material, 'dispose');
      layer.dispose();
      expect(geometry.dispose).not.toHaveBeenCalled();
      expect(material.dispose).not.toHaveBeenCalled();
    });

    it('disposes when no scene is passed (uses parent if attached)', () => {
      const layer = new TileInstanceLayer(BlockType.BASE, geometry, material, sampleInstances(3));
      const scene = new THREE.Scene();
      scene.add(layer.mesh);
      layer.dispose(); // no scene arg
      expect(scene.children).not.toContain(layer.mesh);
    });
  });

  describe('raycast resolution path (the sprint 22+ integration target)', () => {
    it('an InstancedMesh raycast hit can be resolved to (row, col)', () => {
      const layer = new TileInstanceLayer(BlockType.BASE, geometry, material, [
        { row: 5, col: 7, worldX: 0, worldZ: 0, worldY: 0 },
      ]);
      // Simulate Three.js handing us an intersection with instanceId=0.
      const coord = layer.lookupCoord(0);
      expect(coord).toEqual({ row: 5, col: 7 });
      layer.dispose();
    });
  });
});
