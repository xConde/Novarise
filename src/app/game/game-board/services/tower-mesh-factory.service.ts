import { Injectable, Optional } from '@angular/core';
import * as THREE from 'three';
import { TowerType } from '../models/tower.model';
import { BOARD_CONFIG } from '../constants/board.constants';
import { gridToWorld } from '../utils/coordinate-utils';
import { GeometryRegistryService } from './geometry-registry.service';
import { MaterialRegistryService } from './material-registry.service';

interface TowerMaterialConfig {
  color: number;
  emissive: number;
  emissiveIntensity: number;
  metalness: number;
  roughness: number;
  transparent?: boolean;
  opacity?: number;
}

const TOWER_MATERIAL_CONFIGS: Readonly<Record<TowerType, TowerMaterialConfig>> = {
  [TowerType.BASIC]:  { color: 0xd47a3a, emissive: 0xaa6a2a, emissiveIntensity: 0.7, metalness: 0.3, roughness: 0.6 },
  [TowerType.SNIPER]: { color: 0x7a5ac4, emissive: 0x6a4a9a, emissiveIntensity: 0.8, metalness: 0.4, roughness: 0.4 },
  [TowerType.SPLASH]: { color: 0x4ac47a, emissive: 0x4a9a6a, emissiveIntensity: 0.7, metalness: 0.25, roughness: 0.7 },
  [TowerType.SLOW]:   { color: 0x4488ff, emissive: 0x2255cc, emissiveIntensity: 0.8, metalness: 0.5, roughness: 0.3, transparent: true, opacity: 0.9 },
  [TowerType.CHAIN]:  { color: 0xe6c440, emissive: 0xc89000, emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.2 },  // UX-40: desaturated from 0xffdd00 / 0xddaa00 / 1.0 — matches other tower mute levels
  [TowerType.MORTAR]: { color: 0x664422, emissive: 0x442200, emissiveIntensity: 0.4, metalness: 0.7, roughness: 0.5 },
};

const DEFAULT_TOWER_MATERIAL_CONFIG: TowerMaterialConfig = {
  color: 0xd47a3a, emissive: 0x8a4a1a, emissiveIntensity: 0.3, metalness: 0.2, roughness: 0.6,
};

function makeTowerMaterialFromConfig(cfg: TowerMaterialConfig): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ ...cfg });
}

@Injectable()
export class TowerMeshFactoryService {
  private readonly tileSize = BOARD_CONFIG.tileSize;
  private readonly tileHeight = BOARD_CONFIG.tileHeight;

  constructor(
    @Optional() private readonly geometryRegistry?: GeometryRegistryService,
    @Optional() private readonly materialRegistry?: MaterialRegistryService,
  ) {}

  /**
   * Create a tower mesh group positioned at the given board coordinates.
   */
  createTowerMesh(
    row: number,
    col: number,
    towerType: TowerType,
    boardWidth: number,
    boardHeight: number
  ): THREE.Group {
    const towerGroup = new THREE.Group();
    const tileTop = this.tileHeight;

    const mat = this.getTowerMaterial(towerType);

    switch (towerType) {
      case TowerType.BASIC: {
        // Ancient crystal obelisk - jagged and organic
        const obeliskBase = this.cyl(0.35, 0.42, 0.25, 6);
        const obeliskMid1 = this.cyl(0.32, 0.35, 0.35, 6);
        const obeliskMid2 = this.cyl(0.28, 0.32, 0.3, 6);
        const obeliskTop = this.cone(0.28, 0.4, 6);
        const crystal = this.oct(0.15, 0);

        const oBase = new THREE.Mesh(obeliskBase, mat);
        oBase.position.y = 0.125;
        oBase.rotation.y = Math.PI / 6;

        const oMid1 = new THREE.Mesh(obeliskMid1, mat);
        oMid1.position.y = 0.425;
        oMid1.rotation.y = -Math.PI / 6;

        const oMid2 = new THREE.Mesh(obeliskMid2, mat);
        oMid2.position.y = 0.75;

        const oTop = new THREE.Mesh(obeliskTop, mat);
        oTop.position.y = 1.1;
        oTop.rotation.y = Math.PI / 6;

        const oCrystal = new THREE.Mesh(crystal, mat);
        oCrystal.name = 'crystal';
        oCrystal.position.y = 1.35;

        towerGroup.add(oBase, oMid1, oMid2, oTop, oCrystal);
        break;
      }

      case TowerType.SNIPER: {
        // Tall crystalline spike - elegant and sharp
        const spikeBase = this.dod(0.3, 0);
        const spikeShaft1 = this.cyl(0.22, 0.26, 0.5, 8);
        const spikeShaft2 = this.cyl(0.18, 0.22, 0.5, 7);
        const spikeTip = this.cone(0.18, 0.7, 6);
        const spikePoint = this.cone(0.08, 0.3, 4);

        const snBase = new THREE.Mesh(spikeBase, mat);
        snBase.position.y = 0.2;
        snBase.rotation.y = Math.PI / 5;

        const snShaft1 = new THREE.Mesh(spikeShaft1, mat);
        snShaft1.position.y = 0.55;

        const snShaft2 = new THREE.Mesh(spikeShaft2, mat);
        snShaft2.position.y = 1.05;
        snShaft2.rotation.y = Math.PI / 7;

        const snTip = new THREE.Mesh(spikeTip, mat);
        snTip.position.y = 1.55;

        const snPoint = new THREE.Mesh(spikePoint, mat);
        snPoint.name = 'tip';
        snPoint.position.y = 2.0;

        towerGroup.add(snBase, snShaft1, snShaft2, snTip, snPoint);
        break;
      }

      case TowerType.SPLASH: {
        // Mushroom-like spore launcher - organic and bulbous
        const stemBase = this.cyl(0.28, 0.35, 0.3, 8);
        const stemMid = this.cyl(0.24, 0.28, 0.35, 8);
        const capBase = this.cyl(0.4, 0.3, 0.2, 12);
        // capTop has extra params (phiStart, phiLength, thetaStart, thetaLength).
        // UX-10: route through GeometryRegistry's escape hatch so it shares
        // across all SPLASH placements/ghosts instead of allocating per call.
        const capTop = this.geometryRegistry
          ? this.geometryRegistry.getOrCreateCustom(
              'splash:capTop',
              () => new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
            )
          : new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const spore1 = this.sphere(0.08, 6, 6);
        const spore2 = this.sphere(0.06, 6, 6);
        const spore3 = this.sphere(0.07, 6, 6);

        const spStemBase = new THREE.Mesh(stemBase, mat);
        spStemBase.position.y = 0.15;

        const spStemMid = new THREE.Mesh(stemMid, mat);
        spStemMid.position.y = 0.475;

        const spCapBase = new THREE.Mesh(capBase, mat);
        spCapBase.position.y = 0.75;

        const spCapTop = new THREE.Mesh(capTop, mat);
        spCapTop.position.y = 0.85;

        const spSpore1 = new THREE.Mesh(spore1, mat);
        spSpore1.name = 'spore';
        spSpore1.position.set(0.15, 0.95, 0.1);

        const spSpore2 = new THREE.Mesh(spore2, mat);
        spSpore2.name = 'spore';
        spSpore2.position.set(-0.12, 0.9, -0.08);

        const spSpore3 = new THREE.Mesh(spore3, mat);
        spSpore3.name = 'spore';
        spSpore3.position.set(0.08, 1.0, -0.15);

        towerGroup.add(spStemBase, spStemMid, spCapBase, spCapTop, spSpore1, spSpore2, spSpore3);
        break;
      }

      case TowerType.SLOW: {
        // Ice/freeze pad — flat wide cylinder base with a raised ring on top
        const iceBase = this.cyl(0.4, 0.45, 0.15, 12);
        const icePillar = this.cyl(0.18, 0.22, 0.45, 8);
        const iceRingOuter = this.cyl(0.42, 0.42, 0.08, 24);
        const iceRingInner = this.cyl(0.32, 0.32, 0.09, 24);
        const iceCrystal = this.oct(0.14, 0);

        const slBase = new THREE.Mesh(iceBase, mat);
        slBase.position.y = 0.075;

        const slPillar = new THREE.Mesh(icePillar, mat);
        slPillar.position.y = 0.375;

        const slRingOuter = new THREE.Mesh(iceRingOuter, mat);
        slRingOuter.position.y = 0.64;

        const slRingInner = new THREE.Mesh(iceRingInner, mat);
        slRingInner.position.y = 0.645;

        const slCrystal = new THREE.Mesh(iceCrystal, mat);
        slCrystal.name = 'crystal';
        slCrystal.position.y = 0.82;

        towerGroup.add(slBase, slPillar, slRingOuter, slRingInner, slCrystal);
        break;
      }

      case TowerType.CHAIN: {
        // Electric antenna — thin tall cylinder with sphere on top
        const chainBase = this.cyl(0.3, 0.38, 0.2, 8);
        const chainShaft = this.cyl(0.1, 0.14, 0.8, 6);
        const chainOrb = this.sphere(0.18, 10, 8);
        const chainSpark1 = this.sphere(0.06, 6, 6);
        const chainSpark2 = this.sphere(0.05, 6, 6);

        const chBase = new THREE.Mesh(chainBase, mat);
        chBase.position.y = 0.1;

        const chShaft = new THREE.Mesh(chainShaft, mat);
        chShaft.position.y = 0.6;

        const chOrb = new THREE.Mesh(chainOrb, mat);
        chOrb.name = 'orb';
        chOrb.position.y = 1.18;

        const chSpark1 = new THREE.Mesh(chainSpark1, mat);
        chSpark1.name = 'spark';
        chSpark1.position.set(0.22, 1.25, 0);

        const chSpark2 = new THREE.Mesh(chainSpark2, mat);
        chSpark2.name = 'spark';
        chSpark2.position.set(-0.18, 1.3, 0.14);

        towerGroup.add(chBase, chShaft, chOrb, chSpark1, chSpark2);
        break;
      }

      case TowerType.MORTAR: {
        // Dark cannon — wide squat cylinder base with angled barrel
        const mortarBase = this.cyl(0.42, 0.48, 0.3, 10);
        const mortarRing = this.cyl(0.36, 0.4, 0.15, 10);
        const mortarBarrel = this.cyl(0.1, 0.15, 0.5, 8);
        const mortarMuzzle = this.cyl(0.12, 0.1, 0.12, 8);

        const moBase = new THREE.Mesh(mortarBase, mat);
        moBase.position.y = 0.15;

        const moRing = new THREE.Mesh(mortarRing, mat);
        moRing.position.y = 0.375;

        // Angled barrel tilted ~40 degrees
        const moBarrel = new THREE.Mesh(mortarBarrel, mat);
        moBarrel.position.set(0.1, 0.72, 0);
        moBarrel.rotation.z = -Math.PI / 4.5;

        const moMuzzle = new THREE.Mesh(mortarMuzzle, mat);
        moMuzzle.position.set(0.25, 0.98, 0);
        moMuzzle.rotation.z = -Math.PI / 4.5;

        towerGroup.add(moBase, moRing, moBarrel, moMuzzle);
        break;
      }

      default: {
        const defaultGeom = this.cyl(0.3, 0.35, 0.6, 6);
        const defaultMesh = new THREE.Mesh(defaultGeom, mat);
        defaultMesh.position.y = 0.3;
        towerGroup.add(defaultMesh);
      }
    }

    // Position tower on the tile - sitting on top at tileHeight (0.2)
    const { x, z } = gridToWorld(row, col, boardWidth, boardHeight, this.tileSize);

    towerGroup.scale.set(1.4, 1.4, 1.4);
    towerGroup.position.set(x, tileTop, z);
    towerGroup.castShadow = true;
    towerGroup.receiveShadow = true;
    towerGroup.userData['towerType'] = towerType;

    // Add shadow casting to all children
    towerGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return towerGroup;
  }

  // ── Geometry shortcuts (registry-aware) ──────────────────────────────────

  private cyl(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    radialSegments: number,
  ): THREE.CylinderGeometry {
    return this.geometryRegistry
      ? this.geometryRegistry.getCylinder(radiusTop, radiusBottom, height, radialSegments)
      : new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
  }

  private cone(radius: number, height: number, radialSegments: number): THREE.ConeGeometry {
    return this.geometryRegistry
      ? this.geometryRegistry.getCone(radius, height, radialSegments)
      : new THREE.ConeGeometry(radius, height, radialSegments);
  }

  private sphere(radius: number, w: number, h: number): THREE.SphereGeometry {
    return this.geometryRegistry
      ? this.geometryRegistry.getSphere(radius, w, h)
      : new THREE.SphereGeometry(radius, w, h);
  }

  private oct(radius: number, detail: number): THREE.OctahedronGeometry {
    return this.geometryRegistry
      ? this.geometryRegistry.getOctahedron(radius, detail)
      : new THREE.OctahedronGeometry(radius, detail);
  }

  private dod(radius: number, detail: number): THREE.DodecahedronGeometry {
    return this.geometryRegistry
      ? this.geometryRegistry.getDodecahedron(radius, detail)
      : new THREE.DodecahedronGeometry(radius, detail);
  }

  private getTowerMaterial(towerType: TowerType): THREE.MeshStandardMaterial {
    const cfg = TOWER_MATERIAL_CONFIGS[towerType] ?? DEFAULT_TOWER_MATERIAL_CONFIG;
    if (this.materialRegistry) {
      return this.materialRegistry.getOrCreate(
        `tower:${towerType}`,
        () => makeTowerMaterialFromConfig(cfg),
      );
    }
    return makeTowerMaterialFromConfig(cfg);
  }
}
