import { Injectable, Optional } from '@angular/core';
import * as THREE from 'three';
import { TowerType } from '../models/tower.model';
import { BOARD_CONFIG } from '../constants/board.constants';
import { TOWER_ACCENT_LIGHT_CONFIG } from '../constants/lighting.constants';
import { gridToWorld } from '../utils/coordinate-utils';
import { GeometryRegistryService } from './geometry-registry.service';
import { MaterialRegistryService } from './material-registry.service';
import {
  TOWER_MATERIAL_CONFIGS,
  DEFAULT_TOWER_MATERIAL_CONFIG,
  createTowerMaterial,
} from './tower-material.factory';
import {
  BASIC_IDLE_CONFIG,
  BASIC_GEOM,
  BASIC_BARREL_Y,
  BASIC_TURRET_Y,
  BASIC_ACCENT_Y,
  SNIPER_GEOM,
  SNIPER_SCOPE_Y,
  SNIPER_LENS_Z,
  SNIPER_BARREL_Y,
  SNIPER_BARREL_MID_Y,
  SNIPER_MUZZLE_Z,
  SNIPER_ACCENT_Y,
  SNIPER_SCOPE_GLOW_CONFIG,
  SNIPER_RECOIL_CONFIG,
} from '../constants/tower-anim.constants';

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
        // Squat hex base + swivel turret + segmented barrel (workhorse rifleman)

        // ── Hex pad base ────────────────────────────────────────────────────
        const padGeom = this.cyl(
          BASIC_GEOM.baseRadiusTop, BASIC_GEOM.baseRadiusBottom,
          BASIC_GEOM.baseHeight, BASIC_GEOM.baseSegments,
        );
        const pad = new THREE.Mesh(padGeom, mat);
        pad.position.y = BASIC_GEOM.baseHeight / 2;
        towerGroup.add(pad);

        // Recessed bolt-heads at four cardinal positions on the pad top
        const boltGeom = this.cyl(
          BASIC_GEOM.boltRadius, BASIC_GEOM.boltRadius,
          BASIC_GEOM.boltHeight, BASIC_GEOM.boltSegments,
        );
        const boltOffsets: [number, number][] = [
          [ BASIC_GEOM.boltInset, 0],
          [-BASIC_GEOM.boltInset, 0],
          [0,  BASIC_GEOM.boltInset],
          [0, -BASIC_GEOM.boltInset],
        ];
        for (const [bx, bz] of boltOffsets) {
          const bolt = new THREE.Mesh(boltGeom, mat);
          bolt.position.set(
            bx,
            BASIC_GEOM.baseHeight - BASIC_GEOM.boltSinkDepth + BASIC_GEOM.boltHeight / 2,
            bz,
          );
          towerGroup.add(bolt);
        }

        // ── Turret swivel housing ───────────────────────────────────────────
        const turretGroup = new THREE.Group();
        turretGroup.name = 'turret';
        turretGroup.position.y = BASIC_TURRET_Y;
        towerGroup.add(turretGroup);

        const turretGeom = this.cyl(
          BASIC_GEOM.turretRadius, BASIC_GEOM.turretRadius,
          BASIC_GEOM.turretHeight, BASIC_GEOM.turretSegments,
        );
        const turretBody = new THREE.Mesh(turretGeom, mat);
        turretGroup.add(turretBody);

        // Side vents around the turret (4 boxes, evenly spaced radially)
        const ventGeom = this.geometryRegistry
          ? this.geometryRegistry.getOrCreateCustom(
              'basic:turretVent',
              () => new THREE.BoxGeometry(BASIC_GEOM.ventW, BASIC_GEOM.ventH, BASIC_GEOM.ventD),
            )
          : new THREE.BoxGeometry(BASIC_GEOM.ventW, BASIC_GEOM.ventH, BASIC_GEOM.ventD);

        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          const vent = new THREE.Mesh(ventGeom, mat);
          vent.position.set(
            Math.cos(angle) * BASIC_GEOM.ventRadial,
            0,
            Math.sin(angle) * BASIC_GEOM.ventRadial,
          );
          vent.rotation.y = -angle;
          turretGroup.add(vent);
        }

        // ── Segmented barrel sub-group ──────────────────────────────────────
        // Sub-group sits at the front face of the turret, rotated so its +Y
        // points forward (+Z in turret space) — this lets recoil slide along Y.
        const barrelGroup = new THREE.Group();
        // Position at the front edge of the turret (z = turretRadius), at turret midplane
        barrelGroup.position.set(0, 0, BASIC_GEOM.turretRadius);
        // Rotate -90° around X so group-local +Y points along world +Z (forward)
        barrelGroup.rotation.x = -Math.PI / 2;
        turretGroup.add(barrelGroup);

        const seg1Geom = this.cyl(
          BASIC_GEOM.barrel1Radius, BASIC_GEOM.barrel1Radius,
          BASIC_GEOM.barrel1Length, 8,
        );
        const seg2Geom = this.cyl(
          BASIC_GEOM.barrel2Radius, BASIC_GEOM.barrel2Radius,
          BASIC_GEOM.barrel2Length, 8,
        );
        const seg3Geom = this.cyl(
          BASIC_GEOM.barrel3Radius, BASIC_GEOM.barrel3Radius,
          BASIC_GEOM.barrel3Length, 8,
        );
        const finGeom = this.geometryRegistry
          ? this.geometryRegistry.getOrCreateCustom(
              'basic:coolingFin',
              () => new THREE.CylinderGeometry(
                BASIC_GEOM.finRadiusOuter, BASIC_GEOM.finRadiusOuter,
                BASIC_GEOM.finHeight, BASIC_GEOM.finSegments,
              ),
            )
          : new THREE.CylinderGeometry(
              BASIC_GEOM.finRadiusOuter, BASIC_GEOM.finRadiusOuter,
              BASIC_GEOM.finHeight, BASIC_GEOM.finSegments,
            );

        const bSeg1 = new THREE.Mesh(seg1Geom, mat);
        bSeg1.position.y = BASIC_BARREL_Y.seg1;
        barrelGroup.add(bSeg1);

        const bSeg2 = new THREE.Mesh(seg2Geom, mat);
        bSeg2.position.y = BASIC_BARREL_Y.seg2;
        barrelGroup.add(bSeg2);

        const bFin = new THREE.Mesh(finGeom, mat);
        bFin.position.y = BASIC_BARREL_Y.fin;
        barrelGroup.add(bFin);

        const bSeg3 = new THREE.Mesh(seg3Geom, mat);
        bSeg3.name = 'barrel';
        bSeg3.position.y = BASIC_BARREL_Y.seg3;
        barrelGroup.add(bSeg3);

        // ── Accent indicator light (rear of turret) ─────────────────────────
        const accentGeom = this.sphere(
          BASIC_GEOM.accentRadius,
          BASIC_GEOM.accentSegments, BASIC_GEOM.accentSegments,
        );
        const accentMat = this.materialRegistry
          ? this.materialRegistry.getOrCreate(
              'basic:accentSphere',
              () => {
                const cfg = TOWER_MATERIAL_CONFIGS[TowerType.BASIC];
                return new THREE.MeshStandardMaterial({
                  color: cfg.emissive,
                  emissive: cfg.emissive,
                  emissiveIntensity: 1.2,
                });
              },
            )
          : (() => {
              const cfg = TOWER_MATERIAL_CONFIGS[TowerType.BASIC];
              return new THREE.MeshStandardMaterial({
                color: cfg.emissive,
                emissive: cfg.emissive,
                emissiveIntensity: 1.2,
              });
            })();
        const accentMesh = new THREE.Mesh(accentGeom, accentMat);
        accentMesh.name = 'accent';
        accentMesh.position.set(0, 0, BASIC_GEOM.accentZOffset);
        turretGroup.add(accentMesh);

        // ── T2: barrel cap (built at creation, hidden until T2) ─────────────
        const capGeom = this.cyl(
          BASIC_GEOM.capRadius, BASIC_GEOM.capRadius,
          BASIC_GEOM.capHeight, BASIC_GEOM.capSegments,
        );
        const barrelCap = new THREE.Mesh(capGeom, mat);
        barrelCap.name = 'barrelCap';
        barrelCap.position.y = BASIC_BARREL_Y.cap + BASIC_GEOM.capHeight / 2;
        barrelCap.visible = false;
        barrelCap.userData['minTier'] = 2;
        barrelGroup.add(barrelCap);

        // ── T3: shoulder pauldrons (built at creation, hidden until T3) ─────
        const pauldronGeom = this.geometryRegistry
          ? this.geometryRegistry.getOrCreateCustom(
              'basic:pauldron',
              () => new THREE.BoxGeometry(
                BASIC_GEOM.pauldronW, BASIC_GEOM.pauldronH, BASIC_GEOM.pauldronD,
              ),
            )
          : new THREE.BoxGeometry(
              BASIC_GEOM.pauldronW, BASIC_GEOM.pauldronH, BASIC_GEOM.pauldronD,
            );

        for (const side of [-1, 1] as const) {
          const pauldron = new THREE.Mesh(pauldronGeom, mat);
          pauldron.name = 'pauldron';
          pauldron.position.set(side * BASIC_GEOM.pauldronX, 0, 0);
          pauldron.visible = false;
          pauldron.userData['minTier'] = 3;
          turretGroup.add(pauldron);
        }

        // ── Idle animation: turret swivel ────────────────────────────────────
        towerGroup.userData['idleTick'] = (group: THREE.Group, t: number): void => {
          const tGroup = group.getObjectByName('turret');
          if (tGroup) {
            tGroup.rotation.y =
              Math.sin(t * BASIC_IDLE_CONFIG.swivelSpeed) * BASIC_IDLE_CONFIG.swivelAmplitudeRad;
          }
        };

        // ── Firing animation: barrel recoil ──────────────────────────────────
        towerGroup.userData['fireTick'] = (group: THREE.Group, duration: number): void => {
          group.userData['recoilStart'] = performance.now() / 1000;
          group.userData['recoilDuration'] = duration;
        };

        // ── Accent point light ───────────────────────────────────────────────
        const isLowEnd = typeof document !== 'undefined'
          && document.body.classList.contains('reduce-motion');
        this.attachAccentLight(towerGroup, TowerType.BASIC, isLowEnd);
        // Override light position to sit at the accent sphere location
        const accentLight = towerGroup.userData['accentLight'] as THREE.PointLight | undefined;
        if (accentLight) {
          accentLight.position.set(0, BASIC_ACCENT_Y, 0);
        }

        break;
      }

      case TowerType.SNIPER: {
        // Tripod base + optical scope + long barrel + muzzle brake (precision long-range)
        const strutTiltRad = THREE.MathUtils.degToRad(SNIPER_GEOM.strutTiltDeg);

        // ── Central post ────────────────────────────────────────────────────
        const postGeom = this.cyl(
          SNIPER_GEOM.postRadiusTop, SNIPER_GEOM.postRadiusBottom,
          SNIPER_GEOM.postHeight, SNIPER_GEOM.postSegments,
        );
        const post = new THREE.Mesh(postGeom, mat);
        post.position.y = SNIPER_GEOM.postHeight / 2;
        towerGroup.add(post);

        // ── Tripod struts (×3, 120° apart, splayed outward) ─────────────────
        const strutGeom = this.cyl(
          SNIPER_GEOM.strutRadiusTop, SNIPER_GEOM.strutRadiusBottom,
          SNIPER_GEOM.strutHeight, SNIPER_GEOM.strutSegments,
        );
        for (let i = 0; i < 3; i++) {
          const angle = (i / 3) * Math.PI * 2;
          const strut = new THREE.Mesh(strutGeom, mat);
          // Position strut origin at the base of the post, then tilt outward.
          // Rotation order: tilt around X (outward), then spin around Y (angular spread).
          strut.rotation.order = 'YXZ';
          strut.rotation.y = angle;
          strut.rotation.x = strutTiltRad;
          // Offset so struts radiate from the post base centre
          strut.position.set(
            Math.sin(angle) * SNIPER_GEOM.strutHeight * 0.18,
            SNIPER_GEOM.strutHeight / 2 * Math.cos(strutTiltRad),
            Math.cos(angle) * SNIPER_GEOM.strutHeight * 0.18,
          );
          towerGroup.add(strut);
        }

        // ── Scope housing (horizontal cylinder, lies along +Z) ──────────────
        const scopeGeom = this.cyl(
          SNIPER_GEOM.scopeRadiusTop, SNIPER_GEOM.scopeRadiusBottom,
          SNIPER_GEOM.scopeLength, SNIPER_GEOM.scopeSegments,
        );
        const scopeMesh = new THREE.Mesh(scopeGeom, mat);
        // Rotate 90° around X so local +Y points along world +Z (horizontal)
        scopeMesh.rotation.x = Math.PI / 2;
        scopeMesh.position.set(0, SNIPER_SCOPE_Y, 0);
        scopeMesh.userData['maxTier'] = 1;
        towerGroup.add(scopeMesh);

        // Scope lens disk — slightly higher emissive so it reads as an active optic
        const lensGeom = this.cyl(
          SNIPER_GEOM.lensRadius, SNIPER_GEOM.lensRadius,
          SNIPER_GEOM.lensDepth, SNIPER_GEOM.lensSegments,
        );
        const lensMat = this.materialRegistry
          ? this.materialRegistry.getOrCreate(
              'sniper:scopeLens',
              () => {
                const cfg = TOWER_MATERIAL_CONFIGS[TowerType.SNIPER];
                return new THREE.MeshStandardMaterial({
                  color:             cfg.color,
                  emissive:          new THREE.Color(cfg.emissive),
                  emissiveIntensity: SNIPER_SCOPE_GLOW_CONFIG.min,
                  metalness:         cfg.metalness,
                  roughness:         cfg.roughness,
                });
              },
            )
          : (() => {
              const cfg = TOWER_MATERIAL_CONFIGS[TowerType.SNIPER];
              return new THREE.MeshStandardMaterial({
                color:             cfg.color,
                emissive:          new THREE.Color(cfg.emissive),
                emissiveIntensity: SNIPER_SCOPE_GLOW_CONFIG.min,
                metalness:         cfg.metalness,
                roughness:         cfg.roughness,
              });
            })();
        const lensMesh = new THREE.Mesh(lensGeom, lensMat);
        lensMesh.name = 'scope';
        // Lens faces forward (+Z direction from the scope housing)
        lensMesh.rotation.x = Math.PI / 2;
        lensMesh.position.set(0, SNIPER_SCOPE_Y, SNIPER_LENS_Z);
        // T1 lens disappears at T2 together with the scope housing (maxTier=1 mirrors scopeMesh)
        lensMesh.userData['maxTier'] = 1;
        towerGroup.add(lensMesh);

        // ── T2: longer scope (hidden until T2; T1 scope hidden above T1) ────
        const scopeLongGeom = this.cyl(
          SNIPER_GEOM.scopeRadiusTop, SNIPER_GEOM.scopeRadiusBottom,
          SNIPER_GEOM.scopeLongLength, SNIPER_GEOM.scopeSegments,
        );
        const scopeLongMesh = new THREE.Mesh(scopeLongGeom, mat);
        scopeLongMesh.name = 'scopeLong';
        scopeLongMesh.rotation.x = Math.PI / 2;
        scopeLongMesh.position.set(0, SNIPER_SCOPE_Y, 0);
        scopeLongMesh.visible = false;
        scopeLongMesh.userData['minTier'] = 2;
        towerGroup.add(scopeLongMesh);

        // ── Long barrel ──────────────────────────────────────────────────────
        const barrelGeom = this.cyl(
          SNIPER_GEOM.barrelRadius, SNIPER_GEOM.barrelRadius,
          SNIPER_GEOM.barrelLength, SNIPER_GEOM.barrelSegments,
        );
        const barrelMesh = new THREE.Mesh(barrelGeom, mat);
        barrelMesh.name = 'barrel';
        // Barrel lies along +Z (horizontal) like the scope
        barrelMesh.rotation.x = Math.PI / 2;
        barrelMesh.position.set(0, SNIPER_BARREL_Y, 0);
        towerGroup.add(barrelMesh);

        // ── Bipod (×2 struts flanking the barrel mid-point) ─────────────────
        const bipodTiltRad = THREE.MathUtils.degToRad(SNIPER_GEOM.bipodTiltDeg);
        const bipodGeom = this.cyl(
          SNIPER_GEOM.bipodRadius, SNIPER_GEOM.bipodRadius,
          SNIPER_GEOM.bipodLength, SNIPER_GEOM.bipodSegments,
        );
        for (const side of [-1, 1] as const) {
          const bipod = new THREE.Mesh(bipodGeom, mat);
          bipod.name = 'bipod';
          // Splay forward (along +Z) and outward (±X)
          bipod.rotation.order = 'YXZ';
          bipod.rotation.z = side * bipodTiltRad;
          bipod.position.set(
            side * SNIPER_GEOM.bipodXOffset,
            SNIPER_BARREL_MID_Y - SNIPER_GEOM.bipodLength * 0.3,
            SNIPER_GEOM.barrelLength * 0.15,
          );
          bipod.userData['maxTier'] = 2;
          towerGroup.add(bipod);
        }

        // ── Muzzle brake ─────────────────────────────────────────────────────
        const muzzleGeom = this.cyl(
          SNIPER_GEOM.muzzleRadius, SNIPER_GEOM.muzzleRadius,
          SNIPER_GEOM.muzzleLength, SNIPER_GEOM.muzzleSegments,
        );
        const muzzleMesh = new THREE.Mesh(muzzleGeom, mat);
        muzzleMesh.name = 'muzzle';
        muzzleMesh.rotation.x = Math.PI / 2;
        muzzleMesh.position.set(0, SNIPER_BARREL_Y, SNIPER_MUZZLE_Z);
        towerGroup.add(muzzleMesh);

        // Vent slits on the muzzle brake (×2 radial)
        const ventGeom = this.materialRegistry
          ? this.geometryRegistry?.getOrCreateCustom(
              'sniper:muzzleVent',
              () => new THREE.BoxGeometry(
                SNIPER_GEOM.muzzleVentW, SNIPER_GEOM.muzzleVentH, SNIPER_GEOM.muzzleVentD,
              ),
            ) ?? new THREE.BoxGeometry(
              SNIPER_GEOM.muzzleVentW, SNIPER_GEOM.muzzleVentH, SNIPER_GEOM.muzzleVentD,
            )
          : new THREE.BoxGeometry(
              SNIPER_GEOM.muzzleVentW, SNIPER_GEOM.muzzleVentH, SNIPER_GEOM.muzzleVentD,
            );
        for (const side of [-1, 1] as const) {
          const vent = new THREE.Mesh(ventGeom, mat);
          vent.position.set(
            side * SNIPER_GEOM.muzzleVentOffset,
            SNIPER_BARREL_Y,
            SNIPER_MUZZLE_Z,
          );
          towerGroup.add(vent);
        }

        // ── T3: hover stabilizer disk (hidden until T3; bipods hidden above T2) ──
        const stabGeom = this.cyl(
          SNIPER_GEOM.stabilizerRadius, SNIPER_GEOM.stabilizerRadius,
          SNIPER_GEOM.stabilizerHeight, SNIPER_GEOM.stabilizerSegments,
        );
        const stabMesh = new THREE.Mesh(stabGeom, mat);
        stabMesh.name = 'stabilizer';
        stabMesh.position.set(
          0,
          SNIPER_BARREL_MID_Y + SNIPER_GEOM.stabilizerYOffset,
          SNIPER_GEOM.barrelLength * 0.15,
        );
        stabMesh.visible = false;
        stabMesh.userData['minTier'] = 3;
        towerGroup.add(stabMesh);

        // ── Idle animation: scope lens emissive pulse ────────────────────────
        towerGroup.userData['idleTick'] = (group: THREE.Group, t: number): void => {
          const lens = group.getObjectByName('scope') as THREE.Mesh | undefined;
          if (lens && lens.material instanceof THREE.MeshStandardMaterial) {
            const range = SNIPER_SCOPE_GLOW_CONFIG.max - SNIPER_SCOPE_GLOW_CONFIG.min;
            lens.material.emissiveIntensity =
              SNIPER_SCOPE_GLOW_CONFIG.min +
              range * (0.5 + 0.5 * Math.sin(t * SNIPER_SCOPE_GLOW_CONFIG.speed));
          }
        };

        // Charge-tick: same as idleTick — always pulses to indicate active optic.
        // A future phase may wire this to real target-lock state.
        towerGroup.userData['chargeTick'] = towerGroup.userData['idleTick'];

        // ── Firing animation: sharp barrel recoil ────────────────────────────
        towerGroup.userData['fireTick'] = (group: THREE.Group, duration: number): void => {
          group.userData['recoilStart'] = performance.now() / 1000;
          group.userData['recoilDuration'] = duration;
          group.userData['recoilDistance'] = SNIPER_RECOIL_CONFIG.distance;
        };

        // ── Accent point light at scope height ───────────────────────────────
        const isSniperLowEnd = typeof document !== 'undefined'
          && document.body.classList.contains('reduce-motion');
        this.attachAccentLight(towerGroup, TowerType.SNIPER, isSniperLowEnd);
        const sniperLight = towerGroup.userData['accentLight'] as THREE.PointLight | undefined;
        if (sniperLight) {
          sniperLight.position.set(0, SNIPER_ACCENT_Y, 0);
        }

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

  /**
   * Attaches a small accent PointLight near the tower's tip so its emissive
   * glow reads in shadowed areas. The light color is drawn from the tower's
   * body emissive so it reinforces the per-type brand color.
   *
   * Returns early without adding a light when `isLowEnd` is true — point
   * lights are expensive on mobile; the caller should pass
   * `document.body.classList.contains('reduce-motion')` for this flag, which
   * mirrors the pattern used by ScreenShakeService.
   *
   * The light reference is stored on `group.userData['accentLight']` so that
   * disposal code can traverse and dispose it alongside the mesh.
   *
   * Phases B–G will call this for individual tower types once their redesigned
   * geometry ships.
   */
  attachAccentLight(
    group: THREE.Group,
    towerType: TowerType,
    isLowEnd: boolean,
  ): void {
    if (isLowEnd) return;

    const cfg = TOWER_MATERIAL_CONFIGS[towerType] ?? DEFAULT_TOWER_MATERIAL_CONFIG;
    const light = new THREE.PointLight(
      cfg.emissive,
      TOWER_ACCENT_LIGHT_CONFIG.intensity,
      TOWER_ACCENT_LIGHT_CONFIG.distance,
      TOWER_ACCENT_LIGHT_CONFIG.decay,
    );

    // Position at approximate tower tip — groups vary by type but ~1.4u is a
    // reasonable default before per-tower overrides land in Phases B–G.
    light.position.set(0, 1.4, 0);

    group.userData['accentLight'] = light;
    group.add(light);
  }

  private getTowerMaterial(towerType: TowerType): THREE.MeshStandardMaterial {
    return createTowerMaterial(towerType, this.materialRegistry);
  }
}
