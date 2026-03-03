import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { GameBoardService } from './game-board.service';
import { EnemyService } from './services/enemy.service';
import { MapBridgeService } from './services/map-bridge.service';
import { GameStateService } from './services/game-state.service';
import { WaveService } from './services/wave.service';
import { TowerCombatService } from './services/tower-combat.service';
import { AudioService } from './services/audio.service';
import { ParticleService } from './services/particle.service';
import { ScreenShakeService } from './services/screen-shake.service';
import { GoldPopupService } from './services/gold-popup.service';
import { TowerPreviewService } from './services/tower-preview.service';
import { FpsCounterService } from './services/fps-counter.service';
import { disposeMaterial } from './utils/three-utils';
import { TowerType, TOWER_CONFIGS, PlacedTower, MAX_TOWER_LEVEL, getUpgradeCost, getSellValue, getEffectiveStats } from './models/tower.model';
import { BlockType } from './models/game-board-tile';
import { DifficultyLevel, DIFFICULTY_PRESETS, GamePhase, GameState } from './models/game-state.model';
import { calculateScoreBreakdown, ScoreBreakdown } from './models/score.model';
import { SCENE_CONFIG, POST_PROCESSING_CONFIG, SKYBOX_CONFIG } from './constants/rendering.constants';
import { AMBIENT_LIGHT, DIRECTIONAL_LIGHT, UNDER_LIGHT, POINT_LIGHTS } from './constants/lighting.constants';
import { CAMERA_CONFIG, CONTROLS_CONFIG } from './constants/camera.constants';
import { PARTICLE_CONFIG, PARTICLE_COLORS } from './constants/particle.constants';
import { TOWER_VISUAL_CONFIG, RANGE_PREVIEW_CONFIG, TILE_EMISSIVE } from './constants/ui.constants';
import { SCREEN_SHAKE_CONFIG } from './constants/effects.constants';
import { ENEMY_STATS } from './models/enemy.model';
import { WavePreviewEntry, getWavePreview } from './models/wave-preview.model';

const CAMERA_PAN_SPEED = 0.5;
const VALID_SPEED_VALUES = [1, 2, 3];

const TOWER_HOTKEYS: Record<string, TowerType> = {
  '1': TowerType.BASIC,
  '2': TowerType.SNIPER,
  '3': TowerType.SPLASH,
  '4': TowerType.SLOW,
  '5': TowerType.CHAIN,
  '6': TowerType.MORTAR,
};

@Component({
  selector: 'app-game-board',
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss'],
  providers: [EnemyService, GameStateService, WaveService, TowerCombatService, AudioService, ParticleService, ScreenShakeService, GoldPopupService, TowerPreviewService, FpsCounterService]
})
export class GameBoardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;


  // Scene objects
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private particles: THREE.Points | null = null;
  private skybox?: THREE.Mesh;
  private bloomPass?: UnrealBloomPass;
  private vignettePass?: ShaderPass;
  private composer!: EffectComposer;

  // Interaction
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private tileMeshes: Map<string, THREE.Mesh> = new Map();
  private hoveredTile: THREE.Mesh | null = null;
  private selectedTile: { row: number, col: number } | null = null;

  // Tower management
  private towerMeshes: Map<string, THREE.Group> = new Map();
  private gridLines: THREE.Group | null = null;
  private rangePreviewMesh: THREE.Mesh | null = null;
  selectedTowerType: TowerType = TowerType.BASIC;

  // Tower info panel state (exposed to template)
  selectedTowerInfo: PlacedTower | null = null;
  selectedTowerStats: { damage: number; range: number; fireRate: number } | null = null;
  selectedTowerUpgradeCost: number = 0;
  selectedTowerSellValue: number = 0;
  MAX_TOWER_LEVEL = MAX_TOWER_LEVEL;

  // Game state exposed to template
  gameState: GameState;
  towerConfigs = TOWER_CONFIGS;
  TowerType = TowerType;
  GamePhase = GamePhase;
  DifficultyLevel = DifficultyLevel;
  difficultyPresets = DIFFICULTY_PRESETS;
  difficultyLevels = Object.values(DifficultyLevel);

  // Score breakdown — populated when game ends (VICTORY or DEFEAT)
  scoreBreakdown: ScoreBreakdown | null = null;

  // Wave preview — shown during SETUP and INTERMISSION
  wavePreview: WavePreviewEntry[] = [];

  // Animation
  private lastTime = 0;
  private defeatSoundPlayed = false;
  private victorySoundPlayed = false;
  private keyboardHandler: (event: KeyboardEvent) => void;
  private mousemoveHandler: (event: MouseEvent) => void = () => {};
  private clickHandler: (event: MouseEvent) => void = () => {};
  private animationFrameId = 0;
  private resizeHandler: () => void = () => {};
  private stateSubscription: Subscription | null = null;

  // Audio state exposed to template
  get audioMuted(): boolean { return this.audioService.isMuted; }

  /** Returns a 3-element array of 'filled' | 'empty' for the star rating display. */
  get starArray(): Array<'filled' | 'empty'> {
    const stars = this.scoreBreakdown?.stars ?? 0;
    return [0, 1, 2].map(i => (i < stars ? 'filled' : 'empty')) as Array<'filled' | 'empty'>;
  }

  // FPS exposed to template
  get fps(): number { return this.fpsCounterService.getFps(); }

  // Camera pan state (tracks which keys are currently held)
  private panKeys = new Set<string>();
  private keydownPanHandler: (e: KeyboardEvent) => void = () => {};
  private keyupPanHandler: (e: KeyboardEvent) => void = () => {};

  constructor(
    private router: Router,
    private gameBoardService: GameBoardService,
    private enemyService: EnemyService,
    private mapBridge: MapBridgeService,
    private gameStateService: GameStateService,
    private waveService: WaveService,
    private towerCombatService: TowerCombatService,
    private audioService: AudioService,
    private particleService: ParticleService,
    private screenShakeService: ScreenShakeService,
    private goldPopupService: GoldPopupService,
    private towerPreviewService: TowerPreviewService,
    private fpsCounterService: FpsCounterService
  ) {
    this.keyboardHandler = this.handleKeyboard.bind(this);
    this.gameState = this.gameStateService.getState();
  }

  ngOnInit(): void {
    // Subscribe to game state changes
    this.stateSubscription = this.gameStateService.getState$().subscribe(state => {
      const prevPhase = this.gameState.phase;
      const prevWave = this.gameState.wave;
      this.gameState = state;

      // Compute score breakdown the first time we enter a terminal phase
      if (
        (state.phase === GamePhase.VICTORY || state.phase === GamePhase.DEFEAT) &&
        prevPhase !== GamePhase.VICTORY &&
        prevPhase !== GamePhase.DEFEAT
      ) {
        const livesTotal = DIFFICULTY_PRESETS[state.difficulty].lives;
        this.scoreBreakdown = calculateScoreBreakdown(
          state.score,
          state.lives,
          livesTotal,
          state.difficulty,
          state.wave,
          state.phase === GamePhase.VICTORY
        );
      }

      // Refresh wave preview when entering SETUP/INTERMISSION or when the wave number changes
      const isPreviewPhase =
        state.phase === GamePhase.SETUP || state.phase === GamePhase.INTERMISSION;
      const waveChanged = state.wave !== prevWave;
      const phaseChanged = state.phase !== prevPhase;
      if (isPreviewPhase && (waveChanged || phaseChanged)) {
        // Preview shows the NEXT wave that is about to start (wave + 1)
        const nextWave = state.wave + 1;
        this.wavePreview = getWavePreview(nextWave, state.isEndless);
      }
    });

    // Import editor map if it has spawn and exit points; otherwise use default board
    if (this.mapBridge.hasEditorMap()) {
      const state = this.mapBridge.getEditorMapState()!;
      if (state.spawnPoint && state.exitPoint) {
        const { board, width, height } = this.mapBridge.convertToGameBoard(state);
        this.gameBoardService.importBoard(board, width, height);
      } else {
        this.gameBoardService.resetBoard();
      }
    } else {
      this.gameBoardService.resetBoard();
    }

    this.initializeScene();
    this.initializeCamera();
    this.initializeLights();
    this.addSkybox();
    this.initializeParticles();
    this.renderGameBoard();
    this.addGridLines();

    // Seed initial wave preview for the first wave
    const initialState = this.gameStateService.getState();
    this.wavePreview = getWavePreview(initialState.wave + 1, initialState.isEndless);
  }

  ngAfterViewInit(): void {
    this.initializeRenderer();
    this.initializePostProcessing();
    this.initializeControls();
    this.setupMouseInteraction();
    this.setupKeyboardControls();
    this.animate();
  }

  // --- Public methods for template ---

  levelStars(count: number): number[] {
    return Array(Math.max(0, count)).fill(0);
  }

  toggleAudio(): void {
    this.audioService.toggleMute();
  }

  selectDifficulty(difficulty: DifficultyLevel): void {
    this.gameStateService.setDifficulty(difficulty);
  }

  selectTowerType(type: TowerType): void {
    this.selectedTowerType = type;
    this.deselectTower();
  }

  upgradeTower(): void {
    if (!this.selectedTowerInfo) return;
    const phase = this.gameStateService.getState().phase;
    if (phase === GamePhase.VICTORY || phase === GamePhase.DEFEAT) return;
    if (this.selectedTowerInfo.level >= MAX_TOWER_LEVEL) return;

    const cost = getUpgradeCost(this.selectedTowerInfo.type, this.selectedTowerInfo.level);
    if (!this.gameStateService.canAfford(cost)) return;

    // Confirm upgrade succeeds BEFORE spending gold — prevents gold loss on service rejection
    if (!this.towerCombatService.upgradeTower(this.selectedTowerInfo.id)) return;
    this.gameStateService.spendGold(cost);
    this.audioService.playTowerUpgrade();

    // Scale tower mesh to reflect upgrade level
    const towerMesh = this.towerMeshes.get(this.selectedTowerInfo.id);
    if (towerMesh) {
      const newLevel = this.selectedTowerInfo.level;
      const scale = TOWER_VISUAL_CONFIG.scaleBase + (newLevel - 1) * TOWER_VISUAL_CONFIG.scaleIncrement;
      towerMesh.scale.set(scale, scale, scale);

      // Boost emissive intensity on upgrade
      towerMesh.traverse(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.emissiveIntensity = TOWER_VISUAL_CONFIG.emissiveBase + (newLevel - 1) * TOWER_VISUAL_CONFIG.emissiveIncrement;
        }
      });
    }

    // Refresh info panel
    this.refreshTowerInfoPanel();
    this.showRangePreview(this.selectedTowerInfo);
  }

  sellTower(): void {
    if (!this.selectedTowerInfo) return;
    const phase = this.gameStateService.getState().phase;
    if (phase === GamePhase.VICTORY || phase === GamePhase.DEFEAT) return;

    // Confirm unregistration succeeds BEFORE refunding gold — prevents free gold on stale reference
    const soldTower = this.towerCombatService.unregisterTower(this.selectedTowerInfo.id);
    if (!soldTower) return;

    const refund = getSellValue(soldTower.totalInvested);
    this.gameStateService.addGold(refund);
    this.audioService.playTowerSell();

    // Remove mesh from scene
    const towerMesh = this.towerMeshes.get(this.selectedTowerInfo.id);
    if (towerMesh) {
      this.scene.remove(towerMesh);
      towerMesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          disposeMaterial(child.material);
        }
      });
      this.towerMeshes.delete(this.selectedTowerInfo.id);
    }

    // Restore tile to BASE
    this.gameBoardService.removeTower(this.selectedTowerInfo.row, this.selectedTowerInfo.col);

    // Clear path cache since board changed
    this.enemyService.clearPathCache();

    this.deselectTower();
  }

  deselectTower(): void {
    this.selectedTowerInfo = null;
    this.selectedTowerStats = null;
    this.removeRangePreview();
  }

  private selectPlacedTower(key: string): void {
    // Toggle: clicking the same tower deselects it
    if (this.selectedTowerInfo?.id === key) {
      this.deselectTower();
      return;
    }

    const tower = this.towerCombatService.getTower(key);
    if (!tower) return;

    this.selectedTowerInfo = tower;
    this.refreshTowerInfoPanel();
    this.showRangePreview(tower);
  }

  private refreshTowerInfoPanel(): void {
    if (!this.selectedTowerInfo) return;
    const tower = this.selectedTowerInfo;
    const stats = getEffectiveStats(tower.type, tower.level);
    this.selectedTowerStats = { damage: stats.damage, range: stats.range, fireRate: stats.fireRate };
    this.selectedTowerUpgradeCost = getUpgradeCost(tower.type, tower.level);
    this.selectedTowerSellValue = getSellValue(tower.totalInvested);
  }

  private showRangePreview(tower: PlacedTower): void {
    this.removeRangePreview();

    const stats = getEffectiveStats(tower.type, tower.level);
    const radius = stats.range;

    const geometry = new THREE.RingGeometry(radius - RANGE_PREVIEW_CONFIG.ringThickness, radius, RANGE_PREVIEW_CONFIG.segments);
    geometry.rotateX(-Math.PI / 2); // Lay flat on XZ plane
    const material = new THREE.MeshBasicMaterial({
      color: stats.color,
      transparent: true,
      opacity: RANGE_PREVIEW_CONFIG.opacity,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.rangePreviewMesh = new THREE.Mesh(geometry, material);

    const boardWidth = this.gameBoardService.getBoardWidth();
    const boardHeight = this.gameBoardService.getBoardHeight();
    const tileSize = this.gameBoardService.getTileSize();
    const x = (tower.col - boardWidth / 2) * tileSize;
    const z = (tower.row - boardHeight / 2) * tileSize;

    this.rangePreviewMesh.position.set(x, RANGE_PREVIEW_CONFIG.yPosition, z);
    this.scene.add(this.rangePreviewMesh);
  }

  private removeRangePreview(): void {
    if (this.rangePreviewMesh) {
      this.scene.remove(this.rangePreviewMesh);
      this.rangePreviewMesh.geometry.dispose();
      disposeMaterial(this.rangePreviewMesh.material);
      this.rangePreviewMesh = null;
    }
  }

  goToEditor(): void {
    this.router.navigate(['/edit']);
  }

  startWave(): void {
    const state = this.gameStateService.getState();
    if (state.phase === GamePhase.COMBAT) return;
    if (state.phase === GamePhase.VICTORY || state.phase === GamePhase.DEFEAT) return;

    this.gameStateService.startWave();
    this.waveService.startWave(this.gameStateService.getState().wave, this.scene);
    this.audioService.playWaveStart();
  }

  restartGame(): void {
    // Reset interaction state — old references point to disposed meshes
    this.hoveredTile = null;
    this.selectedTile = null;

    this.cleanupGameObjects();

    // Reset services
    this.waveService.reset();
    this.gameStateService.reset();
    this.scoreBreakdown = null;
    this.defeatSoundPlayed = false;
    this.victorySoundPlayed = false;

    if (this.mapBridge.hasEditorMap()) {
      const state = this.mapBridge.getEditorMapState()!;
      if (state.spawnPoint && state.exitPoint) {
        const { board, width, height } = this.mapBridge.convertToGameBoard(state);
        this.gameBoardService.importBoard(board, width, height);
      } else {
        this.gameBoardService.resetBoard();
      }
    } else {
      this.gameBoardService.resetBoard();
    }
    this.renderGameBoard();
    this.addGridLines();
    this.enemyService.clearPathCache();
    this.lastTime = 0;
  }


  /** Shared cleanup for game objects — used by both restartGame() and ngOnDestroy(). */
  private cleanupGameObjects(): void {
    // Clean up enemies — snapshot keys to avoid mutating Map during iteration
    for (const id of Array.from(this.enemyService.getEnemies().keys())) {
      this.enemyService.removeEnemy(id, this.scene);
    }

    // Clean up tower combat state (projectiles)
    this.towerCombatService.cleanup(this.scene);

    // Clean up range preview
    this.removeRangePreview();
    this.selectedTowerInfo = null;
    this.selectedTowerStats = null;

    // Clean up tower meshes
    this.towerMeshes.forEach(group => {
      this.scene.remove(group);
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          disposeMaterial(child.material);
        }
      });
    });
    this.towerMeshes.clear();

    // Clean up tile meshes
    this.tileMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      disposeMaterial(mesh.material);
    });
    this.tileMeshes.clear();

    // Clean up grid lines
    if (this.gridLines) {
      this.scene.remove(this.gridLines);
      this.gridLines.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
          disposeMaterial(child.material);
        }
      });
      this.gridLines = null;
    }

    // Clean up particles
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      disposeMaterial(this.particles.material);
      this.particles = null;
    }

    // Clean up skybox
    if (this.skybox) {
      this.scene.remove(this.skybox);
      this.skybox.geometry.dispose();
      disposeMaterial(this.skybox.material);
      this.skybox = undefined;
    }
  }

  // --- Scene setup ---

  private initializeScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SCENE_CONFIG.backgroundColor);
    this.scene.fog = new THREE.FogExp2(SCENE_CONFIG.fogColor, SCENE_CONFIG.fogDensity);
  }

  private initializeCamera(): void {
    const aspectRatio = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.fov,
      aspectRatio,
      CAMERA_CONFIG.near,
      CAMERA_CONFIG.far
    );
    this.camera.position.set(0, CAMERA_CONFIG.distance, CAMERA_CONFIG.distance * CAMERA_CONFIG.zOffsetFactor);
    this.camera.lookAt(0, 0, 0);
  }

  private initializeRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = SCENE_CONFIG.toneMappingExposure;

    this.canvasContainer.nativeElement.appendChild(this.renderer.domElement);

    this.resizeHandler = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      if (this.composer) {
        this.composer.setSize(width, height);
      }
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  private initializePostProcessing(): void {
    this.composer = new EffectComposer(this.renderer);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      POST_PROCESSING_CONFIG.bloom.strength,
      POST_PROCESSING_CONFIG.bloom.radius,
      POST_PROCESSING_CONFIG.bloom.threshold
    );
    this.composer.addPass(this.bloomPass);

    const vignetteShader = {
      uniforms: {
        tDiffuse: { value: null },
        offset: { value: POST_PROCESSING_CONFIG.vignette.offset },
        darkness: { value: POST_PROCESSING_CONFIG.vignette.darkness }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float darkness;
        varying vec2 vUv;

        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
          float vignette = clamp(1.0 - dot(uv, uv), 0.0, 1.0);
          vignette = pow(vignette, darkness);
          texel.rgb *= vignette;
          gl_FragColor = texel;
        }
      `
    };

    this.vignettePass = new ShaderPass(vignetteShader);
    this.composer.addPass(this.vignettePass);
  }

  private initializeLights(): void {
    const ambientLight = new THREE.AmbientLight(AMBIENT_LIGHT.color, AMBIENT_LIGHT.intensity);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(DIRECTIONAL_LIGHT.color, DIRECTIONAL_LIGHT.intensity);
    directionalLight.position.set(...DIRECTIONAL_LIGHT.position!);
    directionalLight.castShadow = DIRECTIONAL_LIGHT.castShadow!;
    directionalLight.shadow.camera.left = -DIRECTIONAL_LIGHT.shadow.bounds;
    directionalLight.shadow.camera.right = DIRECTIONAL_LIGHT.shadow.bounds;
    directionalLight.shadow.camera.top = DIRECTIONAL_LIGHT.shadow.bounds;
    directionalLight.shadow.camera.bottom = -DIRECTIONAL_LIGHT.shadow.bounds;
    directionalLight.shadow.mapSize.width = DIRECTIONAL_LIGHT.shadow.mapSize;
    directionalLight.shadow.mapSize.height = DIRECTIONAL_LIGHT.shadow.mapSize;
    directionalLight.shadow.bias = DIRECTIONAL_LIGHT.shadow.bias;
    this.scene.add(directionalLight);

    const underLight = new THREE.PointLight(UNDER_LIGHT.color, UNDER_LIGHT.intensity, UNDER_LIGHT.range);
    underLight.position.set(...UNDER_LIGHT.position!);
    this.scene.add(underLight);

    for (const cfg of POINT_LIGHTS) {
      const light = new THREE.PointLight(cfg.color, cfg.intensity, cfg.range);
      light.position.set(...cfg.position!);
      this.scene.add(light);
    }
  }

  private renderGameBoard(): void {
    const boardTiles = this.gameBoardService.getGameBoard();

    boardTiles.forEach((row, rowIndex) => {
      row.forEach((tile, colIndex) => {
        const mesh = this.gameBoardService.createTileMesh(rowIndex, colIndex, tile.type);
        mesh.userData = { row: rowIndex, col: colIndex, tile: tile };
        this.tileMeshes.set(`${rowIndex}-${colIndex}`, mesh);
        this.scene.add(mesh);
      });
    });
  }

  private addGridLines(): void {
    if (this.gridLines) {
      this.scene.remove(this.gridLines);
      this.gridLines.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
    }
    this.gridLines = this.gameBoardService.createGridLines();
    this.scene.add(this.gridLines);
  }

  private addSkybox(): void {
    const starfieldGeometry = new THREE.SphereGeometry(SKYBOX_CONFIG.radius, SKYBOX_CONFIG.widthSegments, SKYBOX_CONFIG.heightSegments);

    const starfieldMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        uniform float time;

        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }

        void main() {
          vec3 deepPurple = vec3(0.04, 0.02, 0.08);
          vec3 darkBlue = vec3(0.06, 0.04, 0.12);
          vec3 color = mix(deepPurple, darkBlue, vUv.y * 0.5);

          vec2 starPos = vUv * 150.0;
          float star = random(floor(starPos));
          if (star > 0.992) {
            float brightness = random(floor(starPos) + 1.0) * 0.5;
            color += vec3(brightness * 0.4, brightness * 0.3, brightness * 0.5);
          }

          float vein1 = random(floor(vUv * 40.0 + vec2(0.0, vUv.x * 10.0)));
          if (vein1 > 0.97) {
            color += vec3(0.25, 0.15, 0.3) * vein1;
          }

          float bio = random(floor(vUv * 25.0)) * 0.12;
          color += vec3(bio * 0.3, bio * 0.5, bio * 0.7);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false
    });

    this.skybox = new THREE.Mesh(starfieldGeometry, starfieldMaterial);
    this.scene.add(this.skybox);
  }

  private initializeParticles(): void {
    const particleCount = PARTICLE_CONFIG.count;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * PARTICLE_CONFIG.spread;
      positions[i * 3 + 1] = Math.random() * PARTICLE_CONFIG.heightRange + PARTICLE_CONFIG.heightMin;
      positions[i * 3 + 2] = (Math.random() - 0.5) * PARTICLE_CONFIG.spread;

      const colorChoice = Math.random();
      let colorEntry = PARTICLE_COLORS[PARTICLE_COLORS.length - 1];
      for (const entry of PARTICLE_COLORS) {
        if (colorChoice < entry.threshold) { colorEntry = entry; break; }
      }
      colors[i * 3] = colorEntry.r;
      colors[i * 3 + 1] = colorEntry.g;
      colors[i * 3 + 2] = colorEntry.b;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: PARTICLE_CONFIG.size,
      vertexColors: true,
      transparent: true,
      opacity: PARTICLE_CONFIG.opacity,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(this.particles);
  }

  private initializeControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = CONTROLS_CONFIG.dampingFactor;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = CAMERA_CONFIG.distance * CONTROLS_CONFIG.minDistanceFactor;
    this.controls.maxDistance = CAMERA_CONFIG.distance * CONTROLS_CONFIG.maxDistanceFactor;
    this.controls.minPolarAngle = CONTROLS_CONFIG.minPolarAngle;
    this.controls.maxPolarAngle = CONTROLS_CONFIG.maxPolarAngle;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  // --- Interaction ---

  private setupMouseInteraction(): void {
    const canvas = this.renderer.domElement;

    this.mousemoveHandler = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(Array.from(this.tileMeshes.values()));

      if (this.hoveredTile && this.hoveredTile !== this.getSelectedTileMesh()) {
        const material = this.hoveredTile.material as THREE.MeshStandardMaterial;
        const tileType = this.hoveredTile.userData['tile'].type;
        material.emissiveIntensity = tileType === BlockType.BASE ? TILE_EMISSIVE.base : tileType === BlockType.WALL ? TILE_EMISSIVE.wall : TILE_EMISSIVE.special;
      }

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        if (mesh !== this.getSelectedTileMesh()) {
          this.hoveredTile = mesh;
          const material = mesh.material as THREE.MeshStandardMaterial;
          material.emissiveIntensity = TILE_EMISSIVE.hover;
          canvas.style.cursor = 'pointer';
        }
      } else {
        this.hoveredTile = null;
        canvas.style.cursor = 'default';
      }
    };

    this.clickHandler = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);

      // Check for tower mesh clicks first
      const towerGroups = Array.from(this.towerMeshes.values());
      const towerChildren: THREE.Object3D[] = [];
      towerGroups.forEach(g => g.traverse(child => { if (child instanceof THREE.Mesh) towerChildren.push(child); }));
      const towerHits = this.raycaster.intersectObjects(towerChildren);

      if (towerHits.length > 0) {
        // Walk up to find the tower group and its key
        let hitObj: THREE.Object3D | null = towerHits[0].object;
        let foundKey: string | null = null;
        while (hitObj) {
          for (const [key, group] of this.towerMeshes) {
            if (group === hitObj) { foundKey = key; break; }
          }
          if (foundKey) break;
          hitObj = hitObj.parent;
        }
        if (foundKey) {
          this.selectPlacedTower(foundKey);
          return;
        }
      }

      // Check tile clicks
      const intersects = this.raycaster.intersectObjects(Array.from(this.tileMeshes.values()));

      const prevSelected = this.getSelectedTileMesh();
      if (prevSelected) {
        const material = prevSelected.material as THREE.MeshStandardMaterial;
        const tileType = prevSelected.userData['tile'].type;
        material.emissiveIntensity = tileType === BlockType.BASE ? TILE_EMISSIVE.base : tileType === BlockType.WALL ? TILE_EMISSIVE.wall : TILE_EMISSIVE.special;
      }

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const row = mesh.userData['row'];
        const col = mesh.userData['col'];

        this.selectedTile = { row, col };

        const material = mesh.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = TILE_EMISSIVE.selected;

        this.deselectTower();
        this.tryPlaceTower(row, col);
      } else {
        this.selectedTile = null;
        this.deselectTower();
      }
    };

    canvas.addEventListener('mousemove', this.mousemoveHandler);
    canvas.addEventListener('click', this.clickHandler);
  }

  private tryPlaceTower(row: number, col: number): void {
    const phase = this.gameStateService.getState().phase;
    if (phase === GamePhase.VICTORY || phase === GamePhase.DEFEAT) return;

    if (!this.gameBoardService.canPlaceTower(row, col)) return;

    const towerStats = TOWER_CONFIGS[this.selectedTowerType];

    // Check if player can afford tower
    if (!this.gameStateService.canAfford(towerStats.cost)) return;

    if (this.gameBoardService.placeTower(row, col, this.selectedTowerType)) {
      // Deduct gold
      this.gameStateService.spendGold(towerStats.cost);

      // Create tower mesh
      const towerMesh = this.gameBoardService.createTowerMesh(row, col, this.selectedTowerType);
      const key = `${row}-${col}`;
      this.towerMeshes.set(key, towerMesh);
      this.scene.add(towerMesh);

      // Register tower with combat service
      this.towerCombatService.registerTower(row, col, this.selectedTowerType, towerMesh);
      this.audioService.playTowerPlace();

      // Clear enemy path cache since board layout changed
      this.enemyService.clearPathCache();
    }
  }

  private getSelectedTileMesh(): THREE.Mesh | null {
    if (!this.selectedTile) return null;
    return this.tileMeshes.get(`${this.selectedTile.row}-${this.selectedTile.col}`) || null;
  }

  togglePause(): void {
    this.gameStateService.togglePause();
  }

  setSpeed(speed: number): void {
    if (speed === 1 || speed === 2 || speed === 3) {
      this.gameStateService.setSpeed(speed);
    }
  }

  get isPaused(): boolean {
    return this.gameState.isPaused;
  }

  get gameSpeed(): number {
    return this.gameState.gameSpeed;
  }

  private handleKeyboard(event: KeyboardEvent): void {
    const phase = this.gameStateService.getState().phase;
    if (phase === GamePhase.VICTORY || phase === GamePhase.DEFEAT) return;

    // Tower hotkeys: 1-6 select tower types
    if (TOWER_HOTKEYS[event.key]) {
      event.preventDefault();
      this.selectTowerType(TOWER_HOTKEYS[event.key]);
      return;
    }

    switch (event.key) {
      case ' ':
        // Spacebar starts the next wave
        event.preventDefault();
        this.startWave();
        break;
      case 'p':
      case 'P':
        // P key toggles pause
        event.preventDefault();
        this.togglePause();
        break;
      case 'Escape':
        // Escape deselects tower type and closes tower info panel
        event.preventDefault();
        this.selectedTowerType = TowerType.BASIC;
        this.deselectTower();
        break;
    }
  }

  private setupKeyboardControls(): void {
    window.addEventListener('keydown', this.keyboardHandler);

    // Camera pan: WASD / arrow keys — track held keys
    this.keydownPanHandler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        this.panKeys.add(key);
      }
    };
    this.keyupPanHandler = (e: KeyboardEvent) => {
      this.panKeys.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', this.keydownPanHandler);
    window.addEventListener('keyup', this.keyupPanHandler);
  }

  private updateCameraPan(): void {
    if (this.panKeys.size === 0 || !this.controls) return;

    let dx = 0;
    let dz = 0;
    if (this.panKeys.has('w') || this.panKeys.has('arrowup')) dz -= CAMERA_PAN_SPEED;
    if (this.panKeys.has('s') || this.panKeys.has('arrowdown')) dz += CAMERA_PAN_SPEED;
    if (this.panKeys.has('a') || this.panKeys.has('arrowleft')) dx -= CAMERA_PAN_SPEED;
    if (this.panKeys.has('d') || this.panKeys.has('arrowright')) dx += CAMERA_PAN_SPEED;

    this.camera.position.x += dx;
    this.camera.position.z += dz;
    this.controls.target.x += dx;
    this.controls.target.z += dz;
  }

  // --- Game loop ---

  private animate = (time: number = 0): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const rawDelta = this.lastTime === 0 ? 0 : (time - this.lastTime) / 1000;
    const deltaTime = Math.min(rawDelta, 0.1); // Cap at 100ms to prevent tab-switch physics burst
    this.lastTime = time;

    // FPS tracking
    this.fpsCounterService.tick(time);

    // Camera pan (WASD / arrows)
    this.updateCameraPan();

    if (this.controls) {
      this.controls.update();
    }

    // Animate ambient particles
    if (this.particles) {
      const positionAttribute = this.particles.geometry.attributes['position'] as THREE.BufferAttribute;
      const positions = positionAttribute.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(time * PARTICLE_CONFIG.animSpeedTime + i) * PARTICLE_CONFIG.animSpeedWave;
      }
      positionAttribute.needsUpdate = true;
      this.particles.rotation.y += PARTICLE_CONFIG.rotationSpeed;
    }

    // Gameplay tick
    if (deltaTime > 0) {
      const state = this.gameStateService.getState();

      if (state.phase === GamePhase.COMBAT && !state.isPaused) {
        const scaledDelta = deltaTime * state.gameSpeed;
        // Wave spawning
        this.waveService.update(scaledDelta, this.scene);

        // Tower combat — returns IDs of enemies killed, tower types that fired, and hit count
        const { killed: killedByTowers, fired: firedTowerTypes, hitCount } = this.towerCombatService.update(scaledDelta, this.scene);

        // Play tower fire sounds
        for (const towerType of firedTowerTypes) {
          this.audioService.playTowerFire(towerType);
        }

        // Play enemy hit sound (throttled inside AudioService)
        if (hitCount > 0) {
          this.audioService.playEnemyHit();
        }

        // Collect gold from tower kills and remove dead enemies
        for (const enemyId of killedByTowers) {
          const enemy = this.enemyService.getEnemies().get(enemyId);
          if (enemy) {
            this.gameStateService.addGold(enemy.value);
            this.audioService.playGoldEarned();
            this.audioService.playEnemyDeath();

            // Visual effects on kill
            const enemyColor = ENEMY_STATS[enemy.type]?.color ?? 0xff0000;
            this.particleService.spawnDeathBurst(enemy.position, enemyColor);
            this.goldPopupService.spawn(enemy.value, enemy.position, this.scene);

            this.enemyService.removeEnemy(enemyId, this.scene);
          }
        }

        // Move enemies along paths
        const reachedExit = this.enemyService.updateEnemies(scaledDelta);

        // Enemies reaching the exit cost lives
        for (const enemyId of reachedExit) {
          this.gameStateService.loseLife(1);
          this.screenShakeService.trigger(SCREEN_SHAKE_CONFIG.lifeLossIntensity, SCREEN_SHAKE_CONFIG.lifeLossDuration);
          this.enemyService.removeEnemy(enemyId, this.scene);
        }

        // Update health bars
        this.enemyService.updateHealthBars();

        // Check wave completion: no spawning and no enemies alive
        // Re-read phase — loseLife() above may have set DEFEAT mid-frame
        const currentPhase = this.gameStateService.getState().phase;
        if (currentPhase === GamePhase.DEFEAT && !this.defeatSoundPlayed) {
          this.defeatSoundPlayed = true;
          this.audioService.playDefeat();
        }
        if (currentPhase === GamePhase.COMBAT &&
            !this.waveService.isSpawning() &&
            this.enemyService.getEnemies().size === 0) {
          const reward = this.waveService.getWaveReward(state.wave);
          this.gameStateService.completeWave(reward);
          // Check if completeWave triggered VICTORY
          const postWavePhase = this.gameStateService.getState().phase;
          if (postWavePhase === GamePhase.VICTORY && !this.victorySoundPlayed) {
            this.victorySoundPlayed = true;
            this.audioService.playVictory();
          } else if (postWavePhase === GamePhase.INTERMISSION) {
            this.audioService.playWaveClear();
          }
        }
      }
    }

    // Update visual effects (run every frame regardless of pause)
    if (deltaTime > 0) {
      this.particleService.addPendingToScene(this.scene);
      this.particleService.update(deltaTime, this.scene);
      this.goldPopupService.update(deltaTime);
      this.screenShakeService.update(deltaTime, this.camera);
    }

    // Render
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // --- Cleanup ---

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrameId);

    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }

    window.removeEventListener('keydown', this.keyboardHandler);
    window.removeEventListener('keydown', this.keydownPanHandler);
    window.removeEventListener('keyup', this.keyupPanHandler);
    window.removeEventListener('resize', this.resizeHandler);

    // Remove canvas event listeners (stored as named references)
    if (this.renderer) {
      const canvas = this.renderer.domElement;
      canvas.removeEventListener('mousemove', this.mousemoveHandler);
      canvas.removeEventListener('click', this.clickHandler);
    }

    if (this.controls) {
      this.controls.dispose();
    }

    if (this.scene) {
      this.cleanupGameObjects();
    }

    if (this.vignettePass) {
      this.vignettePass.dispose();
    }

    if (this.bloomPass) {
      this.bloomPass.dispose();
    }

    if (this.composer) {
      this.composer.renderTarget1.dispose();
      this.composer.renderTarget2.dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    this.audioService.cleanup();
    this.particleService.cleanup(this.scene);
    this.goldPopupService.cleanup(this.scene);
    this.screenShakeService.cleanup(this.camera);
    this.towerPreviewService.cleanup();
    this.fpsCounterService.reset();
  }
}
