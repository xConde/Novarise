import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
import { TowerType, TOWER_CONFIGS } from './models/tower.model';
import { BlockType } from './models/game-board-tile';
import { GamePhase, GameState } from './models/game-state.model';

@Component({
  selector: 'app-game-board',
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss'],
  providers: [EnemyService, GameStateService, WaveService, TowerCombatService]
})
export class GameBoardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;

  // Camera configuration constants - Top-down view
  private readonly cameraDistance = 35;
  private readonly cameraFov = 45;
  private readonly cameraNear = 0.1;
  private readonly cameraFar = 1000;

  // Control configuration constants
  private readonly controlsDampingFactor = 0.05;
  private readonly minPolarAngle = 0;
  private readonly maxPolarAngle = Math.PI / 2.5;

  // Scene objects
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private particles!: THREE.Points;
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
  selectedTowerType: TowerType = TowerType.BASIC;

  // Game state exposed to template
  gameState: GameState;
  towerConfigs = TOWER_CONFIGS;
  TowerType = TowerType;
  GamePhase = GamePhase;

  // Animation
  private lastTime = 0;
  private keyboardHandler: (event: KeyboardEvent) => void;
  private mousemoveHandler: (event: MouseEvent) => void = () => {};
  private clickHandler: (event: MouseEvent) => void = () => {};
  private animationFrameId = 0;
  private resizeHandler: () => void = () => {};
  private stateSubscription: Subscription | null = null;

  constructor(
    private gameBoardService: GameBoardService,
    private enemyService: EnemyService,
    private mapBridge: MapBridgeService,
    private gameStateService: GameStateService,
    private waveService: WaveService,
    private towerCombatService: TowerCombatService
  ) {
    this.keyboardHandler = this.handleKeyboard.bind(this);
    this.gameState = this.gameStateService.getState();
  }

  ngOnInit(): void {
    // Subscribe to game state changes
    this.stateSubscription = this.gameStateService.getState$().subscribe(state => {
      this.gameState = state;
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

  selectTowerType(type: TowerType): void {
    this.selectedTowerType = type;
  }

  startWave(): void {
    const state = this.gameStateService.getState();
    if (state.phase === GamePhase.COMBAT) return;
    if (state.phase === GamePhase.VICTORY || state.phase === GamePhase.DEFEAT) return;

    this.gameStateService.startWave();
    this.waveService.startWave(this.gameStateService.getState().wave, this.scene);
  }

  restartGame(): void {
    // Reset interaction state — old references point to disposed meshes
    this.hoveredTile = null;
    this.selectedTile = null;

    // Clean up enemies — snapshot keys to avoid mutating Map during iteration
    for (const id of Array.from(this.enemyService.getEnemies().keys())) {
      this.enemyService.removeEnemy(id, this.scene);
    }
    // Clean up tower combat state (projectiles)
    this.towerCombatService.cleanup(this.scene);
    // Clean up tower meshes
    this.towerMeshes.forEach(group => {
      this.scene.remove(group);
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    });
    this.towerMeshes.clear();
    // Reset services
    this.waveService.reset();
    this.gameStateService.reset();
    // Reset board
    this.tileMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    this.tileMeshes.clear();

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
  }

  // --- Scene setup ---

  private initializeScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.FogExp2(0x0a0515, 0.015);
  }

  private initializeCamera(): void {
    const aspectRatio = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      this.cameraFov,
      aspectRatio,
      this.cameraNear,
      this.cameraFar
    );
    this.camera.position.set(0, this.cameraDistance, this.cameraDistance * 0.5);
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
    this.renderer.toneMappingExposure = 1.2;

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
      0.4, 0.6, 0.9
    );
    this.composer.addPass(this.bloomPass);

    const vignetteShader = {
      uniforms: {
        tDiffuse: { value: null },
        offset: { value: 0.9 },
        darkness: { value: 1.5 }
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
    const ambientLight = new THREE.AmbientLight(0x3a2a4a, 0.3);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0x9a8ab0, 0.6);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.bias = -0.0001;
    this.scene.add(directionalLight);

    const underLight = new THREE.PointLight(0x4a3a6a, 0.5, 50);
    underLight.position.set(0, -5, 0);
    this.scene.add(underLight);

    const accent1 = new THREE.PointLight(0x6a4a8a, 0.4, 30);
    accent1.position.set(-15, 5, -10);
    this.scene.add(accent1);

    const accent2 = new THREE.PointLight(0x4a6a8a, 0.4, 30);
    accent2.position.set(15, 5, 10);
    this.scene.add(accent2);
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
    const starfieldGeometry = new THREE.SphereGeometry(500, 32, 32);

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
          vec3 deepPurple = vec3(0.02, 0.01, 0.05);
          vec3 darkBlue = vec3(0.03, 0.02, 0.08);
          vec3 color = mix(deepPurple, darkBlue, vUv.y * 0.5);

          vec2 starPos = vUv * 150.0;
          float star = random(floor(starPos));
          if (star > 0.992) {
            float brightness = random(floor(starPos) + 1.0) * 0.3;
            color += vec3(brightness * 0.4, brightness * 0.3, brightness * 0.5);
          }

          float vein1 = random(floor(vUv * 40.0 + vec2(0.0, vUv.x * 10.0)));
          if (vein1 > 0.97) {
            color += vec3(0.15, 0.08, 0.2) * vein1;
          }

          float bio = random(floor(vUv * 25.0)) * 0.08;
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
    const particleCount = 400;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 30 + 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;

      const colorChoice = Math.random();
      if (colorChoice < 0.4) {
        colors[i * 3] = 0.4; colors[i * 3 + 1] = 0.5; colors[i * 3 + 2] = 0.7;
      } else if (colorChoice < 0.7) {
        colors[i * 3] = 0.5; colors[i * 3 + 1] = 0.3; colors[i * 3 + 2] = 0.6;
      } else {
        colors[i * 3] = 0.3; colors[i * 3 + 1] = 0.6; colors[i * 3 + 2] = 0.5;
      }
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(this.particles);
  }

  private initializeControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = this.controlsDampingFactor;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = this.cameraDistance / 2;
    this.controls.maxDistance = this.cameraDistance * 3;
    this.controls.minPolarAngle = this.minPolarAngle;
    this.controls.maxPolarAngle = this.maxPolarAngle;
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
        const isBase = this.hoveredTile.userData['tile'].type === BlockType.BASE;
        material.emissiveIntensity = isBase ? 0.05 : 0.2;
      }

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        if (mesh !== this.getSelectedTileMesh()) {
          this.hoveredTile = mesh;
          const material = mesh.material as THREE.MeshStandardMaterial;
          material.emissiveIntensity = 0.5;
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
      const intersects = this.raycaster.intersectObjects(Array.from(this.tileMeshes.values()));

      const prevSelected = this.getSelectedTileMesh();
      if (prevSelected) {
        const material = prevSelected.material as THREE.MeshStandardMaterial;
        const isBase = prevSelected.userData['tile'].type === BlockType.BASE;
        material.emissiveIntensity = isBase ? 0.05 : 0.2;
      }

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const row = mesh.userData['row'];
        const col = mesh.userData['col'];

        this.selectedTile = { row, col };

        const material = mesh.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = 0.8;

        this.tryPlaceTower(row, col);
      } else {
        this.selectedTile = null;
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

      // Clear enemy path cache since board layout changed
      this.enemyService.clearPathCache();
    }
  }

  private getSelectedTileMesh(): THREE.Mesh | null {
    if (!this.selectedTile) return null;
    return this.tileMeshes.get(`${this.selectedTile.row}-${this.selectedTile.col}`) || null;
  }

  private handleKeyboard(event: KeyboardEvent): void {
    const phase = this.gameStateService.getState().phase;
    if (phase === GamePhase.VICTORY || phase === GamePhase.DEFEAT) return;

    switch (event.key.toLowerCase()) {
      case ' ':
        // Spacebar starts the next wave
        event.preventDefault();
        this.startWave();
        break;
    }
  }

  private setupKeyboardControls(): void {
    window.addEventListener('keydown', this.keyboardHandler);
  }

  // --- Game loop ---

  private animate = (time: number = 0): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const rawDelta = this.lastTime === 0 ? 0 : (time - this.lastTime) / 1000;
    const deltaTime = Math.min(rawDelta, 0.1); // Cap at 100ms to prevent tab-switch physics burst
    this.lastTime = time;

    if (this.controls) {
      this.controls.update();
    }

    // Animate particles
    if (this.particles) {
      const positionAttribute = this.particles.geometry.attributes['position'] as THREE.BufferAttribute;
      const positions = positionAttribute.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(time * 0.001 + i) * 0.002;
      }
      positionAttribute.needsUpdate = true;
      this.particles.rotation.y += 0.0002;
    }

    // Gameplay tick
    if (deltaTime > 0) {
      const state = this.gameStateService.getState();

      if (state.phase === GamePhase.COMBAT) {
        // Wave spawning
        this.waveService.update(deltaTime, this.scene);

        // Tower combat — returns IDs of enemies killed by towers
        const killedByTowers = this.towerCombatService.update(deltaTime, this.scene);

        // Collect gold from tower kills and remove dead enemies
        for (const enemyId of killedByTowers) {
          const enemy = this.enemyService.getEnemies().get(enemyId);
          if (enemy) {
            this.gameStateService.addGold(enemy.value);
            this.enemyService.removeEnemy(enemyId, this.scene);
          }
        }

        // Move enemies along paths
        const reachedExit = this.enemyService.updateEnemies(deltaTime);

        // Enemies reaching the exit cost lives
        for (const enemyId of reachedExit) {
          this.gameStateService.loseLife(1);
          this.enemyService.removeEnemy(enemyId, this.scene);
        }

        // Update health bars
        this.enemyService.updateHealthBars();

        // Check wave completion: no spawning and no enemies alive
        // Re-read phase — loseLife() above may have set DEFEAT mid-frame
        const currentPhase = this.gameStateService.getState().phase;
        if (currentPhase === GamePhase.COMBAT &&
            !this.waveService.isSpawning() &&
            this.enemyService.getEnemies().size === 0) {
          const reward = this.waveService.getWaveReward(state.wave);
          this.gameStateService.completeWave(reward);
        }
      }
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
      this.tileMeshes.forEach(mesh => {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
      this.tileMeshes.clear();

      this.towerMeshes.forEach(group => {
        this.scene.remove(group);
        group.traverse(child => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
      });
      this.towerMeshes.clear();

      // Cleanup combat projectiles
      this.towerCombatService.cleanup(this.scene);

      // Cleanup enemies — snapshot keys to avoid mutating Map during iteration
      for (const id of Array.from(this.enemyService.getEnemies().keys())) {
        this.enemyService.removeEnemy(id, this.scene);
      }

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

      if (this.particles) {
        this.scene.remove(this.particles);
        this.particles.geometry.dispose();
        (this.particles.material as THREE.Material).dispose();
      }

      if (this.skybox) {
        this.scene.remove(this.skybox);
        this.skybox.geometry.dispose();
        (this.skybox.material as THREE.Material).dispose();
      }
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
  }
}
