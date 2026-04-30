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
  SPLASH_GEOM,
  SPLASH_Y,
  SPLASH_TUBE_Z,
  SPLASH_TUBE_GRID,
  SPLASH_TUBE_T2_EXTRA,
  SPLASH_TUBE_T3_EXTRA,
  SPLASH_DRUM_CONFIG,
  SPLASH_TUBE_EMIT_CONFIG,
  SLOW_GEOM,
  SLOW_BASE_Y,
  SLOW_COIL_Y,
  SLOW_COIL2_Y,
  SLOW_EMITTER_Y,
  SLOW_CRYSTAL_Y,
  SLOW_ACCENT_Y,
  SLOW_EMITTER_PULSE_CONFIG,
  CHAIN_GEOM,
  CHAIN_Y,
  CHAIN_IDLE_ARC_CONFIG,
  CHAIN_SPHERE_BOB_CONFIG,
  CHAIN_CHARGE_CONFIG,
  CHAIN_ELECTRODE_CONFIG,
  CHAIN_ORBIT_CONFIG,
  MORTAR_GEOM,
  MORTAR_CHASSIS_TOP_Y,
  MORTAR_HOUSING_Y,
  MORTAR_BARREL_PIVOT_Y,
  MORTAR_BARREL_ELEVATION_RAD,
  MORTAR_ACCENT_Y,
  MORTAR_RECOIL_CONFIG,
  MORTAR_BARREL_NAMES,
  MORTAR_IDLE_CONFIG,
  SNIPER_TRACK_CONFIG,
  SPLASH_CHARGE_CONFIG,
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

        // ── Idle animation: scope lens emissive pulse + phantom-target tracking ──
        // The scope lens pulses continuously (active optic read). Layered on top
        // is a slow ±2° barrel rotation drift — the sniper "tracking" a phantom
        // target off to one side. The drift is intentionally slower than the lens
        // pulse so the two gestures feel independent.
        towerGroup.userData['idleTick'] = (group: THREE.Group, t: number): void => {
          const lens = group.getObjectByName('scope') as THREE.Mesh | undefined;
          if (lens && lens.material instanceof THREE.MeshStandardMaterial) {
            const range = SNIPER_SCOPE_GLOW_CONFIG.max - SNIPER_SCOPE_GLOW_CONFIG.min;
            lens.material.emissiveIntensity =
              SNIPER_SCOPE_GLOW_CONFIG.min +
              range * (0.5 + 0.5 * Math.sin(t * SNIPER_SCOPE_GLOW_CONFIG.speed));
          }

          // Phantom-target tracking: whole tower group slowly yaws ±2° so the
          // barrel appears to drift toward an off-axis target. Uses group.rotation.y
          // directly so the drift is independent from fireTick (which slides the
          // barrel along local Y, not the group Y axis).
          group.rotation.y =
            Math.sin(t * SNIPER_TRACK_CONFIG.speedHz * Math.PI * 2)
            * SNIPER_TRACK_CONFIG.amplitudeRad;
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
        // Stubby armored base + rotating drum + 4-tube rocket cluster (AOE threat)

        // ── Armored chassis base ─────────────────────────────────────────────
        const chassisGeom = this.geometryRegistry
          ? this.geometryRegistry.getOrCreateCustom(
              'splash:chassis',
              () => new THREE.BoxGeometry(SPLASH_GEOM.baseW, SPLASH_GEOM.baseH, SPLASH_GEOM.baseD),
            )
          : new THREE.BoxGeometry(SPLASH_GEOM.baseW, SPLASH_GEOM.baseH, SPLASH_GEOM.baseD);
        const chassis = new THREE.Mesh(chassisGeom, mat);
        chassis.position.y = SPLASH_GEOM.baseH / 2;
        towerGroup.add(chassis);

        // Side fins (×4 — one per face, chamfered-look via thin boxes)
        const finGeom = this.geometryRegistry
          ? this.geometryRegistry.getOrCreateCustom(
              'splash:fin',
              () => new THREE.BoxGeometry(SPLASH_GEOM.finW, SPLASH_GEOM.finH, SPLASH_GEOM.finD),
            )
          : new THREE.BoxGeometry(SPLASH_GEOM.finW, SPLASH_GEOM.finH, SPLASH_GEOM.finD);

        // Fin arrangement: +X, -X, +Z, -Z faces
        const finOffsets: [number, number, number, number][] = [
          [ SPLASH_GEOM.finOffset, 0, 0,  0],
          [-SPLASH_GEOM.finOffset, 0, 0,  0],
          [0, 0,  SPLASH_GEOM.finOffset, Math.PI / 2],
          [0, 0, -SPLASH_GEOM.finOffset, Math.PI / 2],
        ];
        for (const [fx, , fz, ry] of finOffsets) {
          const fin = new THREE.Mesh(finGeom, mat);
          fin.position.set(fx, SPLASH_GEOM.baseH / 2, fz);
          fin.rotation.y = ry;
          towerGroup.add(fin);
        }

        // ── Rotating drum housing ────────────────────────────────────────────
        // Drum is a horizontal cylinder lying along +Z (faces forward).
        // It lives in a sub-group so rotation.z drives the barrel-roll spin
        // without disturbing the drum's world position.
        const drumGroup = new THREE.Group();
        drumGroup.name = 'drum';
        drumGroup.position.set(0, SPLASH_Y.drumCentre, 0);
        towerGroup.add(drumGroup);

        const drumGeom = this.cyl(
          SPLASH_GEOM.drumRadius, SPLASH_GEOM.drumRadius,
          SPLASH_GEOM.drumLength, SPLASH_GEOM.drumSegments,
        );
        // Rotate the drum body 90° around X so the cylinder faces +Z (forward)
        const drumBody = new THREE.Mesh(drumGeom, mat);
        drumBody.rotation.x = Math.PI / 2;
        drumGroup.add(drumBody);

        // Radial port-detail boxes on the drum (×4, evenly spaced)
        const portGeom = this.geometryRegistry
          ? this.geometryRegistry.getOrCreateCustom(
              'splash:drumPort',
              () => new THREE.BoxGeometry(SPLASH_GEOM.portW, SPLASH_GEOM.portH, SPLASH_GEOM.portD),
            )
          : new THREE.BoxGeometry(SPLASH_GEOM.portW, SPLASH_GEOM.portH, SPLASH_GEOM.portD);

        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          const port = new THREE.Mesh(portGeom, mat);
          port.position.set(
            Math.cos(angle) * SPLASH_GEOM.portRadial,
            Math.sin(angle) * SPLASH_GEOM.portRadial,
            0,
          );
          port.rotation.z = angle;
          drumGroup.add(port);
        }

        // ── 4-tube rocket cluster (T1 base; children of drumGroup so they spin with it) ──
        const tubeGeom = this.cyl(
          SPLASH_GEOM.tubeRadius, SPLASH_GEOM.tubeRadius,
          SPLASH_GEOM.tubeLength, SPLASH_GEOM.tubeSegments,
        );

        // Each tube gets its own material clone so tickTubeEmits can mutate
        // emissiveIntensity on the target tube without lighting ALL tubes (which
        // would happen if they shared the registry-cached material instance).
        SPLASH_TUBE_GRID.forEach(([tx, ty], idx) => {
          const tube = new THREE.Mesh(tubeGeom, mat.clone());
          tube.name = `tube${idx + 1}`;
          tube.userData['tubeIndex'] = idx;
          // Tubes face +Z (forward), so rotate cylinder to point along Z
          tube.rotation.x = Math.PI / 2;
          tube.position.set(tx, ty, SPLASH_TUBE_Z);
          drumGroup.add(tube);
        });

        // ── T2: 2 extra tubes (top and bottom) ──────────────────────────────
        SPLASH_TUBE_T2_EXTRA.forEach(([tx, ty], i) => {
          const tube = new THREE.Mesh(tubeGeom, mat.clone());
          tube.name = `tube${5 + i}`;
          tube.userData['tubeIndex'] = 4 + i;
          tube.userData['minTier'] = 2;
          tube.rotation.x = Math.PI / 2;
          tube.position.set(tx, ty, SPLASH_TUBE_Z);
          tube.visible = false;
          drumGroup.add(tube);
        });

        // ── T3: 2 more tubes (left and right) + heat-vent disk at drum rear ──
        SPLASH_TUBE_T3_EXTRA.forEach(([tx, ty], i) => {
          const tube = new THREE.Mesh(tubeGeom, mat.clone());
          tube.name = `tube${7 + i}`;
          tube.userData['tubeIndex'] = 6 + i;
          tube.userData['minTier'] = 3;
          tube.rotation.x = Math.PI / 2;
          tube.position.set(tx, ty, SPLASH_TUBE_Z);
          tube.visible = false;
          drumGroup.add(tube);
        });

        // Heat-vent emissive disk at the rear of the drum (T3 only)
        const heatVentGeom = this.cyl(
          SPLASH_GEOM.heatVentRadius, SPLASH_GEOM.heatVentRadius,
          SPLASH_GEOM.heatVentDepth, SPLASH_GEOM.heatVentSegments,
        );
        const splashCfg = TOWER_MATERIAL_CONFIGS[TowerType.SPLASH];
        const heatVentMat = this.materialRegistry
          ? this.materialRegistry.getOrCreate(
              'splash:heatVent',
              () => new THREE.MeshStandardMaterial({
                color:             splashCfg.color,
                emissive:          new THREE.Color(splashCfg.emissive),
                emissiveIntensity: 0.9,
                metalness:         splashCfg.metalness,
                roughness:         splashCfg.roughness,
              }),
            )
          : new THREE.MeshStandardMaterial({
              color:             splashCfg.color,
              emissive:          new THREE.Color(splashCfg.emissive),
              emissiveIntensity: 0.9,
              metalness:         splashCfg.metalness,
              roughness:         splashCfg.roughness,
            });
        const heatVent = new THREE.Mesh(heatVentGeom, heatVentMat);
        heatVent.name = 'heatVent';
        // Rear face of the drum along -Z; disk lies horizontal so rotate to face +Z
        heatVent.rotation.x = Math.PI / 2;
        heatVent.position.set(0, 0, -(SPLASH_GEOM.drumLength / 2 + SPLASH_GEOM.heatVentDepth / 2));
        heatVent.userData['minTier'] = 3;
        heatVent.visible = false;
        drumGroup.add(heatVent);

        // ── Ammo-belt side detail (left chassis face) ────────────────────────
        const beltGeom = this.geometryRegistry
          ? this.geometryRegistry.getOrCreateCustom(
              'splash:beltBox',
              () => new THREE.BoxGeometry(SPLASH_GEOM.beltW, SPLASH_GEOM.beltH, SPLASH_GEOM.beltD),
            )
          : new THREE.BoxGeometry(SPLASH_GEOM.beltW, SPLASH_GEOM.beltH, SPLASH_GEOM.beltD);
        const beltDetail = new THREE.Mesh(beltGeom, mat);
        beltDetail.position.set(
          SPLASH_GEOM.beltXOffset,
          SPLASH_GEOM.baseH / 2 + SPLASH_GEOM.beltYOffset,
          SPLASH_GEOM.beltZOffset,
        );
        towerGroup.add(beltDetail);

        // Ammo rounds decorating the belt (×3 spheres, evenly spaced along Z)
        const roundGeom = this.sphere(
          SPLASH_GEOM.roundRadius, SPLASH_GEOM.roundSegments, SPLASH_GEOM.roundSegments,
        );
        for (let i = 0; i < 3; i++) {
          const round = new THREE.Mesh(roundGeom, mat);
          round.position.set(
            SPLASH_GEOM.beltXOffset - SPLASH_GEOM.beltW / 2,
            SPLASH_GEOM.baseH / 2,
            (i - 1) * SPLASH_GEOM.roundSpacing,
          );
          towerGroup.add(round);
        }

        // ── Idle animation: drum rotates slowly around its forward axis (Z) ──
        // Uses delta-time accumulation (drumAngle stored in userData) so the
        // boost speed change from fireTick is seamless with no visual jump.
        // Tube-emit pulse state is advanced separately by tickTubeEmits() in
        // TowerAnimationService, called once per frame from the render loop.
        //
        // Charge-cycle signature gesture: every SPLASH_CHARGE_CONFIG.cycleIntervalSec,
        // the drum briefly spins faster even without a shot. This hints at the ammo
        // drum cycling through a reload phase and makes the tower feel active.
        towerGroup.userData['idleTick'] = (group: THREE.Group, t: number): void => {
          const drum = group.getObjectByName('drum');
          if (!drum) return;

          // NOTE: `t` comes from `time * msToSeconds` in updateTowerAnimations —
          // it is the same wall-clock source as `performance.now() / 1000` when the
          // game runs in real time. `drumSpinBoostUntil` is written by fireTick using
          // `performance.now() / 1000` for the same reason (fireTick does not receive
          // `t`). Both clocks track wall time and stay in sync during normal gameplay.
          const now = performance.now() / 1000;
          const prevT = group.userData['drumPrevT'] as number | undefined;
          const deltaT = prevT !== undefined ? Math.min(t - prevT, 0.1) : 0;
          group.userData['drumPrevT'] = t;

          const fireBoostUntil = group.userData['drumSpinBoostUntil'] as number | undefined;
          const isFireBoosted = fireBoostUntil !== undefined && now < fireBoostUntil;

          // Charge-cycle burst: compute whether we are inside the periodic burst window.
          // Use `t` (wall-clock seconds) to drive the cycle so it stays deterministic.
          const cyclePos = t % SPLASH_CHARGE_CONFIG.cycleIntervalSec;
          const isChargeBurst = cyclePos < SPLASH_CHARGE_CONFIG.burstDurationSec;

          const speed = isFireBoosted
            ? SPLASH_DRUM_CONFIG.fireSpeedRadPerSec
            : isChargeBurst
              ? SPLASH_DRUM_CONFIG.idleSpeedRadPerSec * SPLASH_CHARGE_CONFIG.burstSpeedMultiplier
              : SPLASH_DRUM_CONFIG.idleSpeedRadPerSec;

          const angle = (group.userData['drumAngle'] as number | undefined) ?? 0;
          const newAngle = angle + deltaT * speed;
          group.userData['drumAngle'] = newAngle;
          drum.rotation.z = newAngle;
        };

        // ── Firing animation: drum spins faster + selected tube pulses ────────
        towerGroup.userData['fireTick'] = (group: THREE.Group, duration: number): void => {
          const now = performance.now() / 1000;
          group.userData['drumSpinBoostUntil'] = now + duration;

          // Round-robin tube selection — scan forward (up to 8 steps) from the
          // current index until we land on a VISIBLE tube. This prevents the
          // counter from silently consuming "slots" on hidden T2/T3 tubes at lower
          // tiers, which would cause every other shot to produce no emit pulse at T1.
          const drum = group.getObjectByName('drum');
          const startIdx = ((group.userData['nextTubeIndex'] as number | undefined) ?? 0) % 8;
          let found = false;
          for (let step = 0; step < 8; step++) {
            const candidateIdx = (startIdx + step) % 8;
            const tubeName = `tube${candidateIdx + 1}`;
            const tubeMesh = drum?.getObjectByName(tubeName) as THREE.Mesh | undefined;
            if (tubeMesh?.visible) {
              // Advance the counter past this tube so next fire starts from the next one
              group.userData['nextTubeIndex'] = candidateIdx + 1;
              group.userData['emittingTubeIndex'] = candidateIdx;
              group.userData['tubeEmitStart'] = now;
              group.userData['tubeEmitDuration'] = SPLASH_TUBE_EMIT_CONFIG.duration;
              found = true;
              break;
            }
          }
          if (!found) {
            // No visible tube found (degenerate state); advance counter anyway
            group.userData['nextTubeIndex'] = startIdx + 1;
          }
        };

        // ── Accent point light ───────────────────────────────────────────────
        const isSplashLowEnd = typeof document !== 'undefined'
          && document.body.classList.contains('reduce-motion');
        this.attachAccentLight(towerGroup, TowerType.SPLASH, isSplashLowEnd);
        const splashLight = towerGroup.userData['accentLight'] as THREE.PointLight | undefined;
        if (splashLight) {
          splashLight.position.set(0, SPLASH_Y.accentLight, 0);
        }

        break;
      }

      case TowerType.SLOW: {
        // Crystalline cryo emitter on pulse-coil base (field-effect support tower)

        // ── Octahedron base (cut-gem, flattened on Y) ───────────────────────
        const baseGeom = this.oct(SLOW_GEOM.octRadius, SLOW_GEOM.octDetail);
        const base = new THREE.Mesh(baseGeom, mat);
        base.position.y = SLOW_BASE_Y;
        base.scale.y = SLOW_GEOM.octScaleY;
        towerGroup.add(base);

        // ── Support struts (×3, 120° offsets) ───────────────────────────────
        const strutGeom = this.cyl(
          SLOW_GEOM.strutRadius, SLOW_GEOM.strutRadius,
          SLOW_GEOM.strutHeight, SLOW_GEOM.strutSegments,
        );
        for (let i = 0; i < 3; i++) {
          const angle = (i / 3) * Math.PI * 2;
          const strut = new THREE.Mesh(strutGeom, mat);
          strut.position.set(
            Math.cos(angle) * SLOW_GEOM.strutRadial,
            SLOW_GEOM.strutHeight / 2,
            Math.sin(angle) * SLOW_GEOM.strutRadial,
          );
          towerGroup.add(strut);
        }

        // ── T1 pulse coil ring (horizontal torus, named 'coil') ─────────────
        const coilGeom = this.geometryRegistry
          ? this.geometryRegistry.getOrCreateCustom(
              'slow:coil',
              () => new THREE.TorusGeometry(
                SLOW_GEOM.coilRadius, SLOW_GEOM.coilTube,
                SLOW_GEOM.coilRadSeg, SLOW_GEOM.coilTubSeg,
              ),
            )
          : new THREE.TorusGeometry(
              SLOW_GEOM.coilRadius, SLOW_GEOM.coilTube,
              SLOW_GEOM.coilRadSeg, SLOW_GEOM.coilTubSeg,
            );
        const coilMesh = new THREE.Mesh(coilGeom, mat);
        coilMesh.name = 'coil';
        coilMesh.rotation.x = -Math.PI / 2; // lie horizontal
        coilMesh.position.y = SLOW_COIL_Y;
        towerGroup.add(coilMesh);

        // ── T2: second coil ring (hidden until T2, slightly smaller radius) ──
        const coil2Geom = this.geometryRegistry
          ? this.geometryRegistry.getOrCreateCustom(
              'slow:coil2',
              () => new THREE.TorusGeometry(
                SLOW_GEOM.coil2Radius, SLOW_GEOM.coilTube,
                SLOW_GEOM.coilRadSeg, SLOW_GEOM.coilTubSeg,
              ),
            )
          : new THREE.TorusGeometry(
              SLOW_GEOM.coil2Radius, SLOW_GEOM.coilTube,
              SLOW_GEOM.coilRadSeg, SLOW_GEOM.coilTubSeg,
            );
        const coil2Mesh = new THREE.Mesh(coil2Geom, mat);
        coil2Mesh.name = 'coil2';
        coil2Mesh.rotation.x = -Math.PI / 2;
        coil2Mesh.position.y = SLOW_COIL2_Y;
        coil2Mesh.visible = false;
        coil2Mesh.userData['minTier'] = 2;
        towerGroup.add(coil2Mesh);

        // ── Cryo emitter dish (concave bowl facing up, named 'emitter') ──────
        // SphereGeometry with thetaStart = Math.PI/2 so only the upper bowl renders
        const slowCfg = TOWER_MATERIAL_CONFIGS[TowerType.SLOW];
        const emitterGeom = this.geometryRegistry
          ? this.geometryRegistry.getOrCreateCustom(
              'slow:emitterDish',
              () => new THREE.SphereGeometry(
                SLOW_GEOM.emitterRadius,
                SLOW_GEOM.emitterWidSeg,
                SLOW_GEOM.emitterHeiSeg,
                0,
                Math.PI * 2,
                SLOW_GEOM.emitterThetaStart,
                SLOW_GEOM.emitterThetaLen,
              ),
            )
          : new THREE.SphereGeometry(
              SLOW_GEOM.emitterRadius,
              SLOW_GEOM.emitterWidSeg,
              SLOW_GEOM.emitterHeiSeg,
              0,
              Math.PI * 2,
              SLOW_GEOM.emitterThetaStart,
              SLOW_GEOM.emitterThetaLen,
            );
        // Per-instance material: the emitter's emissiveIntensity is mutated
        // every frame by idleTick (breathing) and saved/restored by
        // startMuzzleFlash per-tower. A shared registry material would cause
        // cross-tower contamination when two SLOW towers fire in the same
        // frame — tower B's muzzle-flash save captures tower A's already-spiked
        // intensity, and the restore sets the shared material to the wrong value.
        // Use the registry as a prototype and clone for each instance.
        const emitterMatBase = this.materialRegistry
          ? this.materialRegistry.getOrCreate(
              'slow:emitter',
              () => new THREE.MeshStandardMaterial({
                color:             slowCfg.color,
                emissive:          new THREE.Color(slowCfg.emissive),
                emissiveIntensity: SLOW_EMITTER_PULSE_CONFIG.min,
                metalness:         slowCfg.metalness,
                roughness:         slowCfg.roughness,
                transparent:       slowCfg.transparent,
                opacity:           slowCfg.opacity,
              }),
            )
          : new THREE.MeshStandardMaterial({
              color:             slowCfg.color,
              emissive:          new THREE.Color(slowCfg.emissive),
              emissiveIntensity: SLOW_EMITTER_PULSE_CONFIG.min,
              metalness:         slowCfg.metalness,
              roughness:         slowCfg.roughness,
              transparent:       slowCfg.transparent,
              opacity:           slowCfg.opacity,
            });
        const emitterMat = emitterMatBase.clone();
        const emitterMesh = new THREE.Mesh(emitterGeom, emitterMat);
        emitterMesh.name = 'emitter';
        // Flip 180° around X so the open bowl faces upward
        emitterMesh.rotation.x = Math.PI;
        emitterMesh.position.y = SLOW_EMITTER_Y;
        towerGroup.add(emitterMesh);

        // ── T3: floating crystal core (small octahedron, named 'crystalCore') ─
        const crystalGeom = this.oct(SLOW_GEOM.crystalRadius, SLOW_GEOM.crystalDetail);
        const crystalCore = new THREE.Mesh(crystalGeom, mat);
        crystalCore.name = 'crystalCore';
        crystalCore.position.y = SLOW_CRYSTAL_Y;
        crystalCore.visible = false;
        crystalCore.userData['minTier'] = 3;
        crystalCore.userData['floatBob'] = true;
        towerGroup.add(crystalCore);

        // ── Idle animation: emitter breathes + coil spins slowly ─────────────
        towerGroup.userData['idleTick'] = (group: THREE.Group, t: number): void => {
          // Emitter emissive intensity — sine breath
          const emitter = group.getObjectByName('emitter') as THREE.Mesh | undefined;
          if (emitter && emitter.material instanceof THREE.MeshStandardMaterial) {
            const range = SLOW_EMITTER_PULSE_CONFIG.max - SLOW_EMITTER_PULSE_CONFIG.min;
            const omega = (Math.PI * 2) / SLOW_EMITTER_PULSE_CONFIG.periodSec;
            emitter.material.emissiveIntensity =
              SLOW_EMITTER_PULSE_CONFIG.min + range * (0.5 + 0.5 * Math.sin(t * omega));
          }

          // Coil ring — slow rotation around its up-axis (the torus is already
          // lying flat, so world-Y rotation gives a "spinning ring" detail)
          const coil = group.getObjectByName('coil') as THREE.Mesh | undefined;
          if (coil) {
            coil.rotation.z = t * SLOW_EMITTER_PULSE_CONFIG.coilRotSpeed;
          }

          // T3 crystal core — slow Y bob.
          // Use getObjectByName (O(N) linear scan, same cost as traverse with
          // early-exit) so intent is explicit and the full scene-graph walk is
          // avoided when the crystal is absent (T1/T2 have no 'crystalCore' child).
          const crystal = group.getObjectByName('crystalCore') as THREE.Mesh | undefined;
          if (crystal) {
            const baseY = (crystal.userData['floatBobBaseY'] as number | undefined)
              ?? SLOW_CRYSTAL_Y;
            if (crystal.userData['floatBobBaseY'] === undefined) {
              crystal.userData['floatBobBaseY'] = baseY;
            }
            crystal.position.y = baseY
              + Math.sin(t * SLOW_EMITTER_PULSE_CONFIG.crystalBobSpeed)
              * SLOW_EMITTER_PULSE_CONFIG.crystalBobAmplitude;
          }
        };

        // ── Firing animation: emitter scale pulse ────────────────────────────
        // tickEmitterPulses reads emitterPulseStart to compute elapsed time and
        // compares against SLOW_EMITTER_PULSE_FIRE.durationSec directly — the
        // duration is not a per-fire variable, so storing it in userData is dead
        // weight. Only the start timestamp is needed.
        towerGroup.userData['fireTick'] = (group: THREE.Group, _duration: number): void => {
          group.userData['emitterPulseStart'] = performance.now() / 1000;
        };

        // ── Accent point light at emitter height ─────────────────────────────
        const isSlowLowEnd = typeof document !== 'undefined'
          && document.body.classList.contains('reduce-motion');
        this.attachAccentLight(towerGroup, TowerType.SLOW, isSlowLowEnd);
        const slowLight = towerGroup.userData['accentLight'] as THREE.PointLight | undefined;
        if (slowLight) {
          slowLight.position.set(0, SLOW_ACCENT_Y, 0);
        }

        break;
      }

      case TowerType.CHAIN: {
        // Tesla coil base + floating top sphere with arcing electrodes (spectacle tower)
        const chainCfg = TOWER_MATERIAL_CONFIGS[TowerType.CHAIN];

        // ── Central post (runs through all three coil rings) ────────────────
        const postGeom = this.cyl(
          CHAIN_GEOM.postRadius, CHAIN_GEOM.postRadius,
          CHAIN_GEOM.postHeight, CHAIN_GEOM.postSegments,
        );
        const post = new THREE.Mesh(postGeom, mat);
        post.position.y = CHAIN_Y.postCentre;
        towerGroup.add(post);

        // ── Three tapering horizontal coil tori (largest at bottom) ─────────
        const coil1Geom = this.geometryRegistry
          ? this.geometryRegistry.getTorus(
              CHAIN_GEOM.coil1Radius, CHAIN_GEOM.coil1Tube,
              CHAIN_GEOM.coilRadSeg, CHAIN_GEOM.coilTubSeg,
            )
          : new THREE.TorusGeometry(
              CHAIN_GEOM.coil1Radius, CHAIN_GEOM.coil1Tube,
              CHAIN_GEOM.coilRadSeg, CHAIN_GEOM.coilTubSeg,
            );
        const coil2Geom = this.geometryRegistry
          ? this.geometryRegistry.getTorus(
              CHAIN_GEOM.coil2Radius, CHAIN_GEOM.coil2Tube,
              CHAIN_GEOM.coilRadSeg, CHAIN_GEOM.coilTubSeg,
            )
          : new THREE.TorusGeometry(
              CHAIN_GEOM.coil2Radius, CHAIN_GEOM.coil2Tube,
              CHAIN_GEOM.coilRadSeg, CHAIN_GEOM.coilTubSeg,
            );
        const coil3Geom = this.geometryRegistry
          ? this.geometryRegistry.getTorus(
              CHAIN_GEOM.coil3Radius, CHAIN_GEOM.coil3Tube,
              CHAIN_GEOM.coilRadSeg, CHAIN_GEOM.coilTubSeg,
            )
          : new THREE.TorusGeometry(
              CHAIN_GEOM.coil3Radius, CHAIN_GEOM.coil3Tube,
              CHAIN_GEOM.coilRadSeg, CHAIN_GEOM.coilTubSeg,
            );

        for (const [geom, y] of [
          [coil1Geom, CHAIN_Y.coil1],
          [coil2Geom, CHAIN_Y.coil2],
          [coil3Geom, CHAIN_Y.coil3],
        ] as [THREE.TorusGeometry, number][]) {
          const coil = new THREE.Mesh(geom, mat);
          coil.rotation.x = -Math.PI / 2; // lie horizontal
          coil.position.y = y;
          towerGroup.add(coil);
        }

        // ── Floating sphere at top (named 'sphere') ──────────────────────────
        // Per-instance material: chargeTick and startMuzzleFlash both mutate
        // emissiveIntensity per-frame. A shared registry material would cause
        // cross-tower contamination when multiple CHAIN towers charge simultaneously.
        const sphereMatBase = this.materialRegistry
          ? this.materialRegistry.getOrCreate(
              'chain:sphere',
              () => new THREE.MeshStandardMaterial({
                color:             chainCfg.color,
                emissive:          new THREE.Color(chainCfg.emissive),
                emissiveIntensity: CHAIN_CHARGE_CONFIG.emissiveMin,
                metalness:         chainCfg.metalness,
                roughness:         chainCfg.roughness,
              }),
            )
          : new THREE.MeshStandardMaterial({
              color:             chainCfg.color,
              emissive:          new THREE.Color(chainCfg.emissive),
              emissiveIntensity: CHAIN_CHARGE_CONFIG.emissiveMin,
              metalness:         chainCfg.metalness,
              roughness:         chainCfg.roughness,
            });
        const sphereMat = sphereMatBase.clone(); // per-instance clone

        const sphereGeom = this.sphere(
          CHAIN_GEOM.sphereRadius, CHAIN_GEOM.sphereWidSeg, CHAIN_GEOM.sphereHeiSeg,
        );
        const sphereMesh = new THREE.Mesh(sphereGeom, sphereMat);
        sphereMesh.name = 'sphere';
        sphereMesh.position.y = CHAIN_Y.sphere;
        towerGroup.add(sphereMesh);

        // ── Four radial electrode cones around the sphere ────────────────────
        const electrodeGeom = this.cone(
          CHAIN_GEOM.electrodeRadius, CHAIN_GEOM.electrodeHeight, CHAIN_GEOM.electrodeSegs,
        );
        // Each electrode gets its own material clone so shimmer is independent
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          const elMat = this.materialRegistry
            ? this.materialRegistry.getOrCreate(
                'chain:electrode',
                () => new THREE.MeshStandardMaterial({
                  color:             chainCfg.color,
                  emissive:          new THREE.Color(chainCfg.emissive),
                  emissiveIntensity: CHAIN_ELECTRODE_CONFIG.emissiveBase,
                  metalness:         chainCfg.metalness,
                  roughness:         chainCfg.roughness,
                }),
              ).clone()
            : new THREE.MeshStandardMaterial({
                color:             chainCfg.color,
                emissive:          new THREE.Color(chainCfg.emissive),
                emissiveIntensity: CHAIN_ELECTRODE_CONFIG.emissiveBase,
                metalness:         chainCfg.metalness,
                roughness:         chainCfg.roughness,
              });
          const electrode = new THREE.Mesh(electrodeGeom, elMat);
          electrode.name = 'electrode';
          // Point outward: cone +Y axis points away from sphere centre.
          // Tilt the cone 90° and position at the equator of the sphere.
          electrode.rotation.z = Math.PI / 2;
          electrode.position.set(
            Math.cos(angle) * CHAIN_GEOM.electrodeRadial,
            CHAIN_Y.electrodes,
            Math.sin(angle) * CHAIN_GEOM.electrodeRadial,
          );
          electrode.rotation.y = -angle;
          towerGroup.add(electrode);
        }

        // ── Idle arc cylinder (thin flicker between post top and sphere) ─────
        // A thin emissive cylinder that toggles opacity to mimic an electric arc.
        // arcMat is intentionally NOT registered with materialRegistry: the arc's
        // opacity is mutated every frame by idleTick (per-instance animation state).
        // Pushing it through the registry would share one material across all CHAIN
        // towers, causing every arc to flicker in sync. disposeGroup's full-traverse
        // dispose handles it correctly because the protect predicate only skips
        // registry-owned resources; arcMat is unregistered and therefore disposed.
        const arcGeom = this.cyl(
          CHAIN_GEOM.arcRadius, CHAIN_GEOM.arcRadius,
          CHAIN_Y.arcLength, CHAIN_GEOM.arcSegments,
        );
        const arcMat = new THREE.MeshStandardMaterial({
          color:             chainCfg.color,
          emissive:          new THREE.Color(chainCfg.emissive),
          emissiveIntensity: 1.0,
          transparent:       true,
          opacity:           CHAIN_IDLE_ARC_CONFIG.opacityMax,
          metalness:         0.0,
          roughness:         1.0,
        });
        const arcMesh = new THREE.Mesh(arcGeom, arcMat);
        arcMesh.name = 'arc';
        arcMesh.position.y = CHAIN_Y.arc;
        towerGroup.add(arcMesh);

        // ── T2: second orbiting sphere (hidden until T2) ─────────────────────
        // Per-instance material clone so its charge state is independent.
        const orbitMat2Base = this.materialRegistry
          ? this.materialRegistry.getOrCreate(
              'chain:orbitSphere',
              () => new THREE.MeshStandardMaterial({
                color:             chainCfg.color,
                emissive:          new THREE.Color(chainCfg.emissive),
                emissiveIntensity: CHAIN_CHARGE_CONFIG.emissiveMin,
                metalness:         chainCfg.metalness,
                roughness:         chainCfg.roughness,
              }),
            )
          : new THREE.MeshStandardMaterial({
              color:             chainCfg.color,
              emissive:          new THREE.Color(chainCfg.emissive),
              emissiveIntensity: CHAIN_CHARGE_CONFIG.emissiveMin,
              metalness:         chainCfg.metalness,
              roughness:         chainCfg.roughness,
            });
        const orbitGeom2 = this.sphere(
          CHAIN_GEOM.orbitSphere2Radius,
          CHAIN_GEOM.orbitSphere2WidSeg,
          CHAIN_GEOM.orbitSphere2HeiSeg,
        );
        const orbitMesh2 = new THREE.Mesh(orbitGeom2, orbitMat2Base.clone());
        orbitMesh2.name = 'orbitSphere2';
        orbitMesh2.position.set(CHAIN_GEOM.orbitSphere2Radial, CHAIN_Y.orbitSpheres, 0);
        orbitMesh2.visible = false;
        orbitMesh2.userData['minTier'] = 2;
        orbitMesh2.userData['orbitRadius'] = CHAIN_GEOM.orbitSphere2Radial;
        orbitMesh2.userData['orbitY'] = CHAIN_Y.orbitSpheres;
        towerGroup.add(orbitMesh2);

        // ── T3: third orbiting sphere (hidden until T3) ──────────────────────
        const orbitGeom3 = this.sphere(
          CHAIN_GEOM.orbitSphere3Radius,
          CHAIN_GEOM.orbitSphere3WidSeg,
          CHAIN_GEOM.orbitSphere3HeiSeg,
        );
        const orbitMesh3 = new THREE.Mesh(orbitGeom3, orbitMat2Base.clone());
        orbitMesh3.name = 'orbitSphere3';
        orbitMesh3.position.set(CHAIN_GEOM.orbitSphere3Radial, CHAIN_Y.orbitSpheres, 0);
        orbitMesh3.visible = false;
        orbitMesh3.userData['minTier'] = 3;
        orbitMesh3.userData['orbitRadius'] = CHAIN_GEOM.orbitSphere3Radial;
        orbitMesh3.userData['orbitY'] = CHAIN_Y.orbitSpheres;
        towerGroup.add(orbitMesh3);

        // ── Charge-up animation (chargeTick) ─────────────────────────────────
        // Pulses the main sphere's emissiveIntensity on a slow sine that mimics
        // charge-discharge: peaks at "fire-ready" then dips after discharge.
        towerGroup.userData['chargeTick'] = (group: THREE.Group, t: number): void => {
          const sphere = group.getObjectByName('sphere') as THREE.Mesh | undefined;
          if (sphere && sphere.material instanceof THREE.MeshStandardMaterial) {
            const omega = (Math.PI * 2) / CHAIN_CHARGE_CONFIG.periodSec;
            const range = CHAIN_CHARGE_CONFIG.emissiveMax - CHAIN_CHARGE_CONFIG.emissiveMin;
            sphere.material.emissiveIntensity =
              CHAIN_CHARGE_CONFIG.emissiveMin + range * (0.5 + 0.5 * Math.sin(t * omega));
          }
        };

        // ── Idle animation: sphere bob + arc flicker + electrode shimmer ──────
        towerGroup.userData['idleTick'] = (group: THREE.Group, t: number): void => {
          // Sphere Y bob
          const sphereObj = group.getObjectByName('sphere') as THREE.Mesh | undefined;
          if (sphereObj) {
            const omega = (Math.PI * 2) / CHAIN_SPHERE_BOB_CONFIG.periodSec;
            sphereObj.position.y = CHAIN_Y.sphere
              + Math.sin(t * omega) * CHAIN_SPHERE_BOB_CONFIG.amplitude;
          }

          // Arc cylinder flicker: step opacity based on sine-driven threshold
          const arc = group.getObjectByName('arc') as THREE.Mesh | undefined;
          if (arc && arc.material instanceof THREE.MeshStandardMaterial) {
            const phase = Math.sin(t * CHAIN_IDLE_ARC_CONFIG.flickerHz * Math.PI * 2);
            const range = CHAIN_IDLE_ARC_CONFIG.opacityMax - CHAIN_IDLE_ARC_CONFIG.opacityMin;
            arc.material.opacity =
              CHAIN_IDLE_ARC_CONFIG.opacityMin + range * (0.5 + 0.5 * phase);
          }

          // Electrode shimmer — cycle emissiveIntensity for "live-wire" feel
          const shimmerOmega = (Math.PI * 2) / CHAIN_ELECTRODE_CONFIG.shimmerPeriod;
          const shimmerRange = CHAIN_ELECTRODE_CONFIG.emissivePeak - CHAIN_ELECTRODE_CONFIG.emissiveBase;
          group.traverse(child => {
            if (child.name !== 'electrode' || !(child instanceof THREE.Mesh)) return;
            if (!(child.material instanceof THREE.MeshStandardMaterial)) return;
            // Phase-offset per electrode using its world X position
            const phase = Math.sin(t * shimmerOmega + child.position.x * CHAIN_ELECTRODE_CONFIG.shimmerPhaseScale);
            child.material.emissiveIntensity =
              CHAIN_ELECTRODE_CONFIG.emissiveBase + shimmerRange * (0.5 + 0.5 * phase);
          });

          // T2 / T3 orbiting spheres — use wall-clock `t` directly so orbit
          // speed is frame-rate-independent. Angle = speed (rad/s) × t (s).
          // The `?.visible` guard checks the Mesh directly. If a parent group
          // were ever hidden instead of the mesh itself, `orbit2.visible` would
          // still be true and the orbit would advance while invisible. Not a
          // current bug (the CHAIN towerGroup is always visible when placed) —
          // revisit if group-level hide ever becomes a feature.
          const orbit2 = group.getObjectByName('orbitSphere2') as THREE.Mesh | undefined;
          if (orbit2?.visible) {
            const angle = CHAIN_GEOM.orbitSphere2InitPhase
              + CHAIN_ORBIT_CONFIG.t2SpeedRadPerSec * t;
            const r = orbit2.userData['orbitRadius'] as number;
            const y = orbit2.userData['orbitY'] as number;
            orbit2.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
          }

          const orbit3 = group.getObjectByName('orbitSphere3') as THREE.Mesh | undefined;
          if (orbit3?.visible) {
            const angle = CHAIN_GEOM.orbitSphere3InitPhase
              + CHAIN_ORBIT_CONFIG.t3SpeedRadPerSec * t;
            const r = orbit3.userData['orbitRadius'] as number;
            const y = orbit3.userData['orbitY'] as number;
            orbit3.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
          }
        };

        // ── Firing animation: muzzle flash only (no barrel recoil) ─────────
        // CHAIN has no mesh named 'barrel' — the central post and floating sphere
        // are not physical barrel geometries. tickRecoilAnimations defaults to
        // searching for 'barrel', which silently no-ops for CHAIN, so wiring
        // recoilStart here would document a "spark-kick" that never renders.
        // The muzzle-flash emissive spike from startMuzzleFlash is the sole
        // fire-animation signal. Recoil on the sphere/post is deferred to Phase J
        // once a dedicated CHAIN_BARREL_NAMES list is defined in the constants.
        // (Phase I red-team Finding I-4 — CHAIN recoil no-op.)
        towerGroup.userData['fireTick'] = (_group: THREE.Group, _duration: number): void => {
          // No-op: CHAIN fire animation is handled entirely by startMuzzleFlash.
        };

        // ── Accent point light at sphere height ─────────────────────────────
        const isChainLowEnd = typeof document !== 'undefined'
          && document.body.classList.contains('reduce-motion');
        this.attachAccentLight(towerGroup, TowerType.CHAIN, isChainLowEnd);
        const chainLight = towerGroup.userData['accentLight'] as THREE.PointLight | undefined;
        if (chainLight) {
          chainLight.position.set(0, CHAIN_Y.accentLight, 0);
        }

        break;
      }

      case TowerType.MORTAR: {
        // Heavy artillery cannon on armored chassis (slow-fire bruiser)
        // Distinct silhouette: wide rectangular chassis + angled barrel at 45°

        // Per-instance material clone: startMuzzleFlash mutates emissiveIntensity on
        // every mesh in the group. Since chassis, treads, vents, housing, and barrel
        // meshes all share the same MeshStandardMaterial by default, firing MORTAR-A
        // would spike MORTAR-B's body simultaneously. Clone so each instance owns its
        // own uniform slot and the save/restore path in startMuzzleFlash is isolated.
        const mortarMat = mat.clone();

        // ── Wide armored chassis ────────────────────────────────────────────
        const chassisGeom = this.geometryRegistry
          ? this.geometryRegistry.getOrCreateCustom(
              'mortar:chassis',
              () => new THREE.BoxGeometry(
                MORTAR_GEOM.chassisW, MORTAR_GEOM.chassisH, MORTAR_GEOM.chassisD,
              ),
            )
          : new THREE.BoxGeometry(MORTAR_GEOM.chassisW, MORTAR_GEOM.chassisH, MORTAR_GEOM.chassisD);
        const chassis = new THREE.Mesh(chassisGeom, mortarMat);
        chassis.position.y = MORTAR_GEOM.chassisH / 2;
        towerGroup.add(chassis);

        // Tread strips along ±X sides
        const treadGeom = this.geometryRegistry
          ? this.geometryRegistry.getOrCreateCustom(
              'mortar:tread',
              () => new THREE.BoxGeometry(
                MORTAR_GEOM.treadW, MORTAR_GEOM.treadH, MORTAR_GEOM.treadD,
              ),
            )
          : new THREE.BoxGeometry(MORTAR_GEOM.treadW, MORTAR_GEOM.treadH, MORTAR_GEOM.treadD);
        for (const side of [-1, 1] as const) {
          const tread = new THREE.Mesh(treadGeom, mortarMat);
          tread.position.set(
            side * MORTAR_GEOM.treadXOffset,
            MORTAR_GEOM.treadH / 2,
            0,
          );
          towerGroup.add(tread);
        }

        // Vent slats on top of chassis (×2)
        const ventGeom = this.geometryRegistry
          ? this.geometryRegistry.getOrCreateCustom(
              'mortar:vent',
              () => new THREE.BoxGeometry(
                MORTAR_GEOM.ventW, MORTAR_GEOM.ventH, MORTAR_GEOM.ventD,
              ),
            )
          : new THREE.BoxGeometry(MORTAR_GEOM.ventW, MORTAR_GEOM.ventH, MORTAR_GEOM.ventD);
        for (const side of [-1, 1] as const) {
          const vent = new THREE.Mesh(ventGeom, mortarMat);
          vent.position.set(
            side * MORTAR_GEOM.ventXOffset,
            MORTAR_CHASSIS_TOP_Y + MORTAR_GEOM.ventH / 2,
            0,
          );
          towerGroup.add(vent);
        }

        // ── Swivel housing (named 'mortarBase') ────────────────────────────
        const housingGeom = this.cyl(
          MORTAR_GEOM.housingRadiusTop, MORTAR_GEOM.housingRadiusBottom,
          MORTAR_GEOM.housingHeight, MORTAR_GEOM.housingSegments,
        );
        const housing = new THREE.Mesh(housingGeom, mortarMat);
        housing.name = 'mortarBase';
        housing.position.y = MORTAR_HOUSING_Y;
        towerGroup.add(housing);

        // ── Barrel pivot group (rotates so barrel points up-and-forward) ───
        // Pivot sits at the housing top face. The barrelPivot group is rotated
        // MORTAR_BARREL_ELEVATION_RAD around local X, so its +Y axis becomes
        // the barrel bore axis (pointing up-and-forward in world space).
        // Recoil slides the barrel along group-local +Y (= along the bore).
        const barrelPivot = new THREE.Group();
        barrelPivot.name = 'barrelPivot';
        barrelPivot.position.y = MORTAR_BARREL_PIVOT_Y;
        barrelPivot.rotation.x = MORTAR_BARREL_ELEVATION_RAD;
        towerGroup.add(barrelPivot);

        // ── T1 barrel (named 'barrelT1') ────────────────────────────────────
        const barrelT1Geom = this.cyl(
          MORTAR_GEOM.barrelT1RadiusTop, MORTAR_GEOM.barrelT1RadiusBottom,
          MORTAR_GEOM.barrelT1Length, MORTAR_GEOM.barrelT1Segments,
        );
        const barrelT1 = new THREE.Mesh(barrelT1Geom, mortarMat);
        barrelT1.name = 'barrelT1';
        // Cylinder origin is at its centre. Position so base rests at pivot origin.
        barrelT1.position.y = MORTAR_GEOM.barrelT1Length / 2;
        // Store neutral Y so tickRecoilAnimations can compute delta-based offset
        // and snap correctly — see Finding G-2.
        barrelT1.userData['recoilBaseY'] = MORTAR_GEOM.barrelT1Length / 2;
        barrelT1.userData['maxTier'] = 1;
        barrelPivot.add(barrelT1);

        // ── T2 barrel — reinforced, wider (named 'barrelT2') ───────────────
        const barrelT2Geom = this.cyl(
          MORTAR_GEOM.barrelT2RadiusTop, MORTAR_GEOM.barrelT2RadiusBottom,
          MORTAR_GEOM.barrelT2Length, MORTAR_GEOM.barrelT2Segments,
        );
        const barrelT2 = new THREE.Mesh(barrelT2Geom, mortarMat);
        barrelT2.name = 'barrelT2';
        barrelT2.position.y = MORTAR_GEOM.barrelT2Length / 2;
        barrelT2.userData['recoilBaseY'] = MORTAR_GEOM.barrelT2Length / 2;
        barrelT2.visible = false;
        barrelT2.userData['minTier'] = 2;
        barrelPivot.add(barrelT2);

        // ── T3 dual barrel — second barrel beside the first (named 'dualBarrel') ─
        // Both barrelT2 and dualBarrel are visible at T3; they fire as one unit.
        // Offset along barrelPivot local X so the two barrels appear side-by-side
        // (X = left/right across the chassis front) rather than stacking in depth (Z).
        const dualBarrelGeom = barrelT2Geom; // same geometry as T2 barrel
        const dualBarrel = new THREE.Mesh(dualBarrelGeom, mortarMat);
        dualBarrel.name = 'dualBarrel';
        dualBarrel.position.set(MORTAR_GEOM.dualBarrelXOffset, MORTAR_GEOM.barrelT2Length / 2, 0);
        dualBarrel.userData['recoilBaseY'] = MORTAR_GEOM.barrelT2Length / 2;
        dualBarrel.visible = false;
        dualBarrel.userData['minTier'] = 3;
        barrelPivot.add(dualBarrel);

        // ── Recoil cradle (collar at barrel base — static decoration) ───────
        const cradleGeom = this.geometryRegistry
          ? this.geometryRegistry.getOrCreateCustom(
              'mortar:cradle',
              () => new THREE.BoxGeometry(
                MORTAR_GEOM.cradleW, MORTAR_GEOM.cradleH, MORTAR_GEOM.cradleD,
              ),
            )
          : new THREE.BoxGeometry(MORTAR_GEOM.cradleW, MORTAR_GEOM.cradleH, MORTAR_GEOM.cradleD);
        const cradle = new THREE.Mesh(cradleGeom, mortarMat);
        cradle.name = 'cradle';
        // Sits at the base of the barrel (pivot origin), centred on housing top
        cradle.position.y = MORTAR_GEOM.cradleH / 2;
        barrelPivot.add(cradle);

        // ── Ammo crate (left/+X side of chassis) ────────────────────────────
        const crateGeom = this.geometryRegistry
          ? this.geometryRegistry.getOrCreateCustom(
              'mortar:ammoCrate',
              () => new THREE.BoxGeometry(
                MORTAR_GEOM.crateW, MORTAR_GEOM.crateH, MORTAR_GEOM.crateD,
              ),
            )
          : new THREE.BoxGeometry(MORTAR_GEOM.crateW, MORTAR_GEOM.crateH, MORTAR_GEOM.crateD);
        const ammoCrate = new THREE.Mesh(crateGeom, mortarMat);
        ammoCrate.position.set(
          MORTAR_GEOM.crateXOffset,
          MORTAR_GEOM.crateYOffset + MORTAR_GEOM.crateH / 2,
          0,
        );
        towerGroup.add(ammoCrate);

        // Shell decorations protruding from crate top (×2 spheres)
        const shellGeom = this.sphere(
          MORTAR_GEOM.shellRadius,
          MORTAR_GEOM.shellSegments, MORTAR_GEOM.shellSegments,
        );
        for (const side of [-1, 1] as const) {
          const shell = new THREE.Mesh(shellGeom, mortarMat);
          shell.position.set(
            MORTAR_GEOM.crateXOffset,
            MORTAR_GEOM.crateYOffset + MORTAR_GEOM.crateH + MORTAR_GEOM.shellYOffset,
            side * MORTAR_GEOM.shellZSpacing,
          );
          towerGroup.add(shell);
        }

        // ── Idle animation: barrel elevate gesture every ~4 s ───────────────
        // The barrelPivot is raised by MORTAR_IDLE_CONFIG.peakExtraRadians on
        // top of its rest angle (MORTAR_BARREL_ELEVATION_RAD) for a brief window,
        // then eases back. This "loading gesture" makes the mortar feel like it
        // is chambering a round between shots.
        towerGroup.userData['idleTick'] = (group: THREE.Group, t: number): void => {
          const pivot = group.getObjectByName('barrelPivot') as THREE.Group | undefined;
          if (!pivot) return;

          const cyclePos = t % MORTAR_IDLE_CONFIG.cycleIntervalSec;
          const totalGestureSec = MORTAR_IDLE_CONFIG.raiseDurationSec + MORTAR_IDLE_CONFIG.returnDurationSec;

          let extraRad = 0;
          if (cyclePos < MORTAR_IDLE_CONFIG.raiseDurationSec) {
            // Raise phase: easeOutCubic from 0 → peakExtraRadians
            const raw = cyclePos / MORTAR_IDLE_CONFIG.raiseDurationSec;
            const eased = 1 - Math.pow(1 - raw, 3);
            extraRad = MORTAR_IDLE_CONFIG.peakExtraRadians * eased;
          } else if (cyclePos < totalGestureSec) {
            // Return phase: easeOutCubic from peakExtraRadians → 0
            const raw = (cyclePos - MORTAR_IDLE_CONFIG.raiseDurationSec) / MORTAR_IDLE_CONFIG.returnDurationSec;
            const eased = 1 - Math.pow(1 - raw, 3);
            extraRad = MORTAR_IDLE_CONFIG.peakExtraRadians * (1 - eased);
          }
          // Rest of cycle: extraRad = 0, barrel at neutral elevation
          pivot.rotation.x = MORTAR_BARREL_ELEVATION_RAD + extraRad;
        };

        // ── Firing animation: exaggerated recoil (3× BASIC) ─────────────────
        // Barrel slides back along its local +Y axis (the bore axis after the
        // pivot rotation). MORTAR_BARREL_NAMES lists all three barrel names;
        // tickMortarRecoil in TowerAnimationService applies the offset to
        // whichever barrels are currently visible.
        towerGroup.userData['fireTick'] = (group: THREE.Group, duration: number): void => {
          group.userData['recoilStart'] = performance.now() / 1000;
          group.userData['recoilDuration'] = duration;
          group.userData['recoilDistance'] = MORTAR_RECOIL_CONFIG.distance;
          group.userData['mortarBarrelNames'] = MORTAR_BARREL_NAMES;
        };

        // ── Accent point light ───────────────────────────────────────────────
        const isMortarLowEnd = typeof document !== 'undefined'
          && document.body.classList.contains('reduce-motion');
        this.attachAccentLight(towerGroup, TowerType.MORTAR, isMortarLowEnd);
        const mortarLight = towerGroup.userData['accentLight'] as THREE.PointLight | undefined;
        if (mortarLight) {
          mortarLight.position.set(0, MORTAR_ACCENT_Y, 0);
        }

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

    // Snapshot canonical emissive baselines immediately after construction so
    // startMuzzleFlash can always restore to the true baseline rather than the
    // current (possibly spiked) material value. This prevents shared-material
    // ratchet when multiple same-type towers fire in the same combat turn.
    TowerMeshFactoryService.snapshotEmissiveBaselines(towerGroup);

    return towerGroup;
  }

  // ── Emissive baseline utilities ───────────────────────────────────────────

  /**
   * Record the current emissiveIntensity of every non-animated mesh in the
   * group into `group.userData['emissiveBaselines']`.
   *
   * Call once immediately after construction and again after any call to
   * `applyUpgradeVisuals` so the stored baselines reflect the post-upgrade
   * material state.
   *
   * The skip-set mirrors `startMuzzleFlash`: 'tip', 'sphere', and any mesh
   * whose name starts with 'tube' are excluded because their emissive is
   * driven by per-frame animation ticks (chargeTick / tickTubeEmits) and
   * must not be locked to a snapshot. Including 'tubeN' meshes would cause
   * muzzle-flash restore to zero out an in-progress SPLASH tube-emit on the
   * same frame that the flash expires.
   */
  static snapshotEmissiveBaselines(group: THREE.Group): void {
    const baselines = new Map<string, number>();
    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (child.name === 'tip' || child.name === 'sphere') return;
      if (child.name.startsWith('tube')) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        const mat = m as THREE.MeshStandardMaterial;
        if (mat.emissiveIntensity !== undefined) {
          baselines.set(child.uuid + '_' + mat.uuid, mat.emissiveIntensity);
        }
      }
    });
    group.userData['emissiveBaselines'] = baselines;
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
