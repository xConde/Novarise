import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { TowerType } from '../models/tower.model';
import { BOARD_CONFIG } from '../constants/board.constants';
import { gridToWorld } from '../utils/coordinate-utils';

function makeTowerMaterial(
  color: number,
  emissive: number,
  emissiveIntensity: number,
  metalness: number,
  roughness: number,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    metalness,
    roughness,
  });
}

@Injectable()
export class TowerMeshFactoryService {
  private readonly tileSize = BOARD_CONFIG.tileSize;
  private readonly tileHeight = BOARD_CONFIG.tileHeight;

  /**
   * Create a tower mesh group positioned at the given board coordinates.
   * @param row Board row
   * @param col Board column
   * @param towerType Tower type to create
   * @param boardWidth Board width in tiles
   * @param boardHeight Board height in tiles
   */
  createTowerMesh(
    row: number,
    col: number,
    towerType: TowerType,
    boardWidth: number,
    boardHeight: number
  ): THREE.Group {
    const towerGroup = new THREE.Group();
    let color: number;
    const tileTop = this.tileHeight; // Towers sit on top of tile

    // Different organic tower designs
    switch (towerType) {
      case TowerType.BASIC: {
        // Ancient crystal obelisk - jagged and organic
        const obeliskBase = new THREE.CylinderGeometry(0.35, 0.42, 0.25, 6);
        const obeliskMid1 = new THREE.CylinderGeometry(0.32, 0.35, 0.35, 6);
        const obeliskMid2 = new THREE.CylinderGeometry(0.28, 0.32, 0.3, 6);
        const obeliskTop = new THREE.ConeGeometry(0.28, 0.4, 6);
        const crystal = new THREE.OctahedronGeometry(0.15, 0);

        color = 0xd47a3a; // Warm amber
        const basicMat = makeTowerMaterial(color, 0xaa6a2a, 0.7, 0.3, 0.6);

        const oBase = new THREE.Mesh(obeliskBase, basicMat);
        oBase.position.y = 0.125;
        oBase.rotation.y = Math.PI / 6;

        const oMid1 = new THREE.Mesh(obeliskMid1, basicMat);
        oMid1.position.y = 0.425;
        oMid1.rotation.y = -Math.PI / 6;

        const oMid2 = new THREE.Mesh(obeliskMid2, basicMat);
        oMid2.position.y = 0.75;

        const oTop = new THREE.Mesh(obeliskTop, basicMat);
        oTop.position.y = 1.1;
        oTop.rotation.y = Math.PI / 6;

        const oCrystal = new THREE.Mesh(crystal, basicMat);
        oCrystal.name = 'crystal';
        oCrystal.position.y = 1.35;

        towerGroup.add(oBase, oMid1, oMid2, oTop, oCrystal);
        break;
      }

      case TowerType.SNIPER: {
        // Tall crystalline spike - elegant and sharp
        const spikeBase = new THREE.DodecahedronGeometry(0.3, 0);
        const spikeShaft1 = new THREE.CylinderGeometry(0.22, 0.26, 0.5, 8);
        const spikeShaft2 = new THREE.CylinderGeometry(0.18, 0.22, 0.5, 7);
        const spikeTip = new THREE.ConeGeometry(0.18, 0.7, 6);
        const spikePoint = new THREE.ConeGeometry(0.08, 0.3, 4);

        color = 0x7a5ac4; // Deep purple
        const sniperMat = makeTowerMaterial(color, 0x6a4a9a, 0.8, 0.4, 0.4);

        const snBase = new THREE.Mesh(spikeBase, sniperMat);
        snBase.position.y = 0.2;
        snBase.rotation.y = Math.PI / 5;

        const snShaft1 = new THREE.Mesh(spikeShaft1, sniperMat);
        snShaft1.position.y = 0.55;

        const snShaft2 = new THREE.Mesh(spikeShaft2, sniperMat);
        snShaft2.position.y = 1.05;
        snShaft2.rotation.y = Math.PI / 7;

        const snTip = new THREE.Mesh(spikeTip, sniperMat);
        snTip.position.y = 1.55;

        const snPoint = new THREE.Mesh(spikePoint, sniperMat);
        snPoint.name = 'tip';
        snPoint.position.y = 2.0;

        towerGroup.add(snBase, snShaft1, snShaft2, snTip, snPoint);
        break;
      }

      case TowerType.SPLASH: {
        // Mushroom-like spore launcher - organic and bulbous
        const stemBase = new THREE.CylinderGeometry(0.28, 0.35, 0.3, 8);
        const stemMid = new THREE.CylinderGeometry(0.24, 0.28, 0.35, 8);
        const capBase = new THREE.CylinderGeometry(0.4, 0.3, 0.2, 12);
        const capTop = new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const spore1 = new THREE.SphereGeometry(0.08, 6, 6);
        const spore2 = new THREE.SphereGeometry(0.06, 6, 6);
        const spore3 = new THREE.SphereGeometry(0.07, 6, 6);

        color = 0x4ac47a; // Vibrant green
        const splashMat = makeTowerMaterial(color, 0x4a9a6a, 0.7, 0.25, 0.7);

        const spStemBase = new THREE.Mesh(stemBase, splashMat);
        spStemBase.position.y = 0.15;

        const spStemMid = new THREE.Mesh(stemMid, splashMat);
        spStemMid.position.y = 0.475;

        const spCapBase = new THREE.Mesh(capBase, splashMat);
        spCapBase.position.y = 0.75;

        const spCapTop = new THREE.Mesh(capTop, splashMat);
        spCapTop.position.y = 0.85;

        const spSpore1 = new THREE.Mesh(spore1, splashMat);
        spSpore1.name = 'spore';
        spSpore1.position.set(0.15, 0.95, 0.1);

        const spSpore2 = new THREE.Mesh(spore2, splashMat);
        spSpore2.name = 'spore';
        spSpore2.position.set(-0.12, 0.9, -0.08);

        const spSpore3 = new THREE.Mesh(spore3, splashMat);
        spSpore3.name = 'spore';
        spSpore3.position.set(0.08, 1.0, -0.15);

        towerGroup.add(spStemBase, spStemMid, spCapBase, spCapTop, spSpore1, spSpore2, spSpore3);
        break;
      }

      case TowerType.SLOW: {
        // Ice/freeze pad — flat wide cylinder base with a raised ring on top
        const iceBase = new THREE.CylinderGeometry(0.4, 0.45, 0.15, 12);
        const icePillar = new THREE.CylinderGeometry(0.18, 0.22, 0.45, 8);
        const iceRingOuter = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24);
        const iceRingInner = new THREE.CylinderGeometry(0.32, 0.32, 0.09, 24);
        const iceCrystal = new THREE.OctahedronGeometry(0.14, 0);

        color = 0x4488ff; // Blue/ice
        const slowMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: 0x2255cc,
          emissiveIntensity: 0.8,
          metalness: 0.5,
          roughness: 0.3,
          transparent: true,
          opacity: 0.9
        });

        const slBase = new THREE.Mesh(iceBase, slowMat);
        slBase.position.y = 0.075;

        const slPillar = new THREE.Mesh(icePillar, slowMat);
        slPillar.position.y = 0.375;

        const slRingOuter = new THREE.Mesh(iceRingOuter, slowMat);
        slRingOuter.position.y = 0.64;

        const slRingInner = new THREE.Mesh(iceRingInner, slowMat);
        slRingInner.position.y = 0.645;

        const slCrystal = new THREE.Mesh(iceCrystal, slowMat);
        slCrystal.name = 'crystal';
        slCrystal.position.y = 0.82;

        towerGroup.add(slBase, slPillar, slRingOuter, slRingInner, slCrystal);
        break;
      }

      case TowerType.CHAIN: {
        // Electric antenna — thin tall cylinder with sphere on top
        const chainBase = new THREE.CylinderGeometry(0.3, 0.38, 0.2, 8);
        const chainShaft = new THREE.CylinderGeometry(0.1, 0.14, 0.8, 6);
        const chainOrb = new THREE.SphereGeometry(0.18, 10, 8);
        const chainSpark1 = new THREE.SphereGeometry(0.06, 6, 6);
        const chainSpark2 = new THREE.SphereGeometry(0.05, 6, 6);

        color = 0xffdd00; // Yellow/electric
        const chainMat = makeTowerMaterial(color, 0xddaa00, 1.0, 0.6, 0.2);

        const chBase = new THREE.Mesh(chainBase, chainMat);
        chBase.position.y = 0.1;

        const chShaft = new THREE.Mesh(chainShaft, chainMat);
        chShaft.position.y = 0.6;

        const chOrb = new THREE.Mesh(chainOrb, chainMat);
        chOrb.name = 'orb';
        chOrb.position.y = 1.18;

        const chSpark1 = new THREE.Mesh(chainSpark1, chainMat);
        chSpark1.name = 'spark';
        chSpark1.position.set(0.22, 1.25, 0);

        const chSpark2 = new THREE.Mesh(chainSpark2, chainMat);
        chSpark2.name = 'spark';
        chSpark2.position.set(-0.18, 1.3, 0.14);

        towerGroup.add(chBase, chShaft, chOrb, chSpark1, chSpark2);
        break;
      }

      case TowerType.MORTAR: {
        // Dark cannon — wide squat cylinder base with angled barrel
        const mortarBase = new THREE.CylinderGeometry(0.42, 0.48, 0.3, 10);
        const mortarRing = new THREE.CylinderGeometry(0.36, 0.4, 0.15, 10);
        const mortarBarrel = new THREE.CylinderGeometry(0.1, 0.15, 0.5, 8);
        const mortarMuzzle = new THREE.CylinderGeometry(0.12, 0.1, 0.12, 8);

        color = 0x664422; // Dark brown cannon
        const mortarMat = makeTowerMaterial(color, 0x442200, 0.4, 0.7, 0.5);

        const moBase = new THREE.Mesh(mortarBase, mortarMat);
        moBase.position.y = 0.15;

        const moRing = new THREE.Mesh(mortarRing, mortarMat);
        moRing.position.y = 0.375;

        // Angled barrel tilted ~40 degrees
        const moBarrel = new THREE.Mesh(mortarBarrel, mortarMat);
        moBarrel.position.set(0.1, 0.72, 0);
        moBarrel.rotation.z = -Math.PI / 4.5;

        const moMuzzle = new THREE.Mesh(mortarMuzzle, mortarMat);
        moMuzzle.position.set(0.25, 0.98, 0);
        moMuzzle.rotation.z = -Math.PI / 4.5;

        towerGroup.add(moBase, moRing, moBarrel, moMuzzle);
        break;
      }

      default: {
        const defaultGeom = new THREE.CylinderGeometry(0.3, 0.35, 0.6, 6);
        color = 0xd47a3a;
        const defaultMat = makeTowerMaterial(color, 0x8a4a1a, 0.3, 0.2, 0.6);
        const defaultMesh = new THREE.Mesh(defaultGeom, defaultMat);
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
}
