import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { Subscription } from 'rxjs';
import { GameBoardService } from './game-board.service';
import { EnemyService } from './services/enemy.service';
import { TerrainService } from './services/terrain.service';
import { ThemeService } from './services/theme.service';
import { EnemyType } from './models/enemy.model';
import { TerrainType, TerrainHeight } from './models/terrain.model';
import { ThemeConfig } from './models/theme.model';

@Component({
  selector: 'app-game-board',
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss'],
  providers: [EnemyService]
})
export class GameBoardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;

  // Camera configuration constants - Top-down view
  private readonly cameraDistance = 35;
  private readonly cameraFov = 45;
  private readonly cameraNear = 0.1;
  private readonly cameraFar = 1000;

  // Lighting configuration constants
  private readonly ambientLightColor = 0xffffff;
  private readonly ambientLightIntensity = 0.6;
  private readonly directionalLightColor = 0xffffff;
  private readonly directionalLightIntensity = 0.8;

  // Control configuration constants
  private readonly controlsDampingFactor = 0.05;
  private readonly minPolarAngle = 0;
  private readonly maxPolarAngle = Math.PI / 2.5; // Limit to mostly top-down

  // Scene objects
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private particles!: THREE.Points;
  private composer!: EffectComposer;

  // Interaction
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private tileMeshes: Map<string, THREE.Mesh> = new Map();
  private hoveredTile: THREE.Mesh | null = null;
  private selectedTile: { row: number, col: number } | null = null;

  // Tower management
  private towerMeshes: Map<string, THREE.Group> = new Map();
  public selectedTowerType: string = 'basic';

  // Enemy management
  private lastTime = 0;
  private keyboardHandler: (event: KeyboardEvent) => void;

  // Terrain management
  private terrainLayoutSubscription?: Subscription;
  private themeSubscription?: Subscription;
  public terrainEditMode: 'none' | 'paint' | 'height' = 'none';
  public selectedTerrainType: TerrainType = TerrainType.BEDROCK;
  private terrainLights: THREE.PointLight[] = [];

  // Light references for theme updates
  private ambientLight?: THREE.AmbientLight;
  private mainLight?: THREE.DirectionalLight;
  private fillLight?: THREE.DirectionalLight;
  private rimLight?: THREE.DirectionalLight;

  constructor(
    private gameBoardService: GameBoardService,
    private enemyService: EnemyService,
    private terrainService: TerrainService,
    private themeService: ThemeService
  ) {
    // Store bound handler for cleanup
    this.keyboardHandler = this.handleKeyboard.bind(this);
  }

  ngOnInit(): void {
    this.initializeScene();
    this.initializeCamera();
    this.initializeLights();
    this.addSkybox();
    this.initializeParticles();
    this.initializeTerrain();
    this.renderGameBoard();
    this.updateTerrainLights();  // Add dynamic point lights for terrain
    this.addGridLines();
    this.subscribeToTerrainChanges();
    this.subscribeToThemeChanges();
  }

  ngAfterViewInit(): void {
    this.initializeRenderer();
    this.initializePostProcessing();
    this.initializeControls();
    this.setupMouseInteraction();
    this.setupKeyboardControls();
    this.animate();
  }

  private initializeScene(): void {
    this.scene = new THREE.Scene();
    // Dark cave atmosphere
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.FogExp2(0x0a0515, 0.015);
  }

  private initializeCamera(): void {
    const aspectRatio = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      60,  // Wider FOV for better perspective (was 45)
      aspectRatio,
      this.cameraNear,
      this.cameraFar
    );

    // CRITICAL: Better 3D perspective angle - higher and further back
    this.camera.position.set(20, 25, 30);
    this.camera.lookAt(0, 0, 0);
  }

  private initializeRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Enable high-quality shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Enhanced tone mapping for better lighting
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.canvasContainer.nativeElement.appendChild(this.renderer.domElement);

    // Handle window resize
    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      if (this.composer) {
        this.composer.setSize(width, height);
      }
    });
  }

  private initializePostProcessing(): void {
    // Create composer for post-processing effects
    this.composer = new EffectComposer(this.renderer);

    // Add render pass
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Subtle bloom for bioluminescent glow
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.4,  // strength - reduced for organic feel
      0.6,  // radius
      0.9   // threshold - higher to only affect brightest elements
    );
    this.composer.addPass(bloomPass);

    // Add vignette effect using custom shader
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

    const vignettePass = new ShaderPass(vignetteShader);
    this.composer.addPass(vignettePass);
  }

  private initializeLights(): void {
    // 1. Ambient light for base visibility
    this.ambientLight = new THREE.AmbientLight(0x505060, 0.5);  // Slightly blue tint, brighter
    this.scene.add(this.ambientLight);

    // 2. Main directional light with high-quality shadows
    this.mainLight = new THREE.DirectionalLight(0xffffff, 1.0);  // Brighter, white light
    this.mainLight.position.set(15, 30, 15);
    this.mainLight.castShadow = true;
    this.mainLight.shadow.mapSize.width = 4096;  // High quality shadows
    this.mainLight.shadow.mapSize.height = 4096;
    this.mainLight.shadow.camera.near = 0.5;
    this.mainLight.shadow.camera.far = 60;
    this.mainLight.shadow.camera.left = -40;
    this.mainLight.shadow.camera.right = 40;
    this.mainLight.shadow.camera.top = 40;
    this.mainLight.shadow.camera.bottom = -40;
    this.mainLight.shadow.bias = -0.0005;  // Reduce shadow acne (adjusted for better visibility)
    this.scene.add(this.mainLight);

    // 3. Fill light to soften shadows
    this.fillLight = new THREE.DirectionalLight(0x8090ff, 0.4);  // Blue tint
    this.fillLight.position.set(-10, 15, -10);
    this.scene.add(this.fillLight);

    // 4. Rim light for edge definition
    this.rimLight = new THREE.DirectionalLight(0xffa040, 0.3);  // Warm orange
    this.rimLight.position.set(0, 10, -25);
    this.scene.add(this.rimLight);
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
    const width = this.gameBoardService.getBoardWidth();
    const height = this.gameBoardService.getBoardHeight();
    const tileSize = this.gameBoardService.getTileSize();

    // Create a more visible grid
    const gridHelper = new THREE.GridHelper(
      Math.max(width, height) * tileSize,
      Math.max(width, height),
      0x606060,  // Lighter center lines
      0x404040   // Lighter grid lines
    );
    gridHelper.position.y = 0.02;  // Slightly above ground to avoid z-fighting
    this.scene.add(gridHelper);

    // Add coordinate axes for debugging (optional - remove if not needed)
    const axesHelper = new THREE.AxesHelper(10);
    axesHelper.position.y = 0.1;
    this.scene.add(axesHelper);
  }

  /**
   * Update dynamic point lights for glowing terrain types.
   * Removes old lights and creates new ones based on current terrain.
   */
  private updateTerrainLights(): void {
    // Remove all existing terrain lights
    this.terrainLights.forEach(light => {
      this.scene.remove(light);
    });
    this.terrainLights = [];

    // Create new lights based on current terrain
    const tiles = this.gameBoardService.getGameBoard();
    const tileSize = this.gameBoardService.getTileSize();

    // Sample every other row/col to avoid too many lights
    for (let row = 0; row < tiles.length; row += 2) {
      for (let col = 0; col < tiles[row].length; col += 2) {
        const tile = tiles[row][col];

        if (tile.terrainType === TerrainType.MITHRIL_CRYSTAL) {
          // Purple point light for crystals - BOOSTED intensity
          const light = new THREE.PointLight(0x9060ff, 1.5, 6);  // Increased from 0.8/5
          const x = (col - tiles[0].length / 2) * tileSize;
          const z = (row - tiles.length / 2) * tileSize;
          const y = tile.terrainHeight === TerrainHeight.ELEVATED ? 2 : 1;
          light.position.set(x, y, z);
          this.scene.add(light);
          this.terrainLights.push(light);
        } else if (tile.terrainType === TerrainType.LUMINOUS_MOSS) {
          // Green point light for moss - BOOSTED intensity
          const light = new THREE.PointLight(0x60ff60, 1.0, 5);  // Increased from 0.5/4
          const x = (col - tiles[0].length / 2) * tileSize;
          const z = (row - tiles.length / 2) * tileSize;
          const y = tile.terrainHeight === TerrainHeight.SUNKEN ? 0.5 : 1;
          light.position.set(x, y, z);
          this.scene.add(light);
          this.terrainLights.push(light);
        }
      }
    }
  }

  private addSkybox(): void {
    // Create a starfield using a sphere geometry
    const starfieldGeometry = new THREE.SphereGeometry(500, 32, 32);

    // Create a custom shader material for procedural starfield
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

        // Simple noise function for stars
        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }

        void main() {
          // Dark cave rock texture gradient
          vec3 deepPurple = vec3(0.02, 0.01, 0.05);
          vec3 darkBlue = vec3(0.03, 0.02, 0.08);
          vec3 color = mix(deepPurple, darkBlue, vUv.y * 0.5);

          // Distant stars - sparse and dim
          vec2 starPos = vUv * 150.0;
          float star = random(floor(starPos));
          if (star > 0.992) {
            float brightness = random(floor(starPos) + 1.0) * 0.3;
            color += vec3(brightness * 0.4, brightness * 0.3, brightness * 0.5);
          }

          // Cave crystal veins - organic patterns
          float vein1 = random(floor(vUv * 40.0 + vec2(0.0, vUv.x * 10.0)));
          if (vein1 > 0.97) {
            color += vec3(0.15, 0.08, 0.2) * vein1;
          }

          // Subtle bioluminescent patches
          float bio = random(floor(vUv * 25.0)) * 0.08;
          color += vec3(bio * 0.3, bio * 0.5, bio * 0.7);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false
    });

    const starfield = new THREE.Mesh(starfieldGeometry, starfieldMaterial);
    this.scene.add(starfield);
  }

  private initializeParticles(): void {
    // Create floating spores/dust particles - cave atmosphere
    const particleCount = 400;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      // Distribute particles closer to the board - cave enclosed feeling
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 30 + 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;

      // Bioluminescent spore colors - organic and mysterious
      const colorChoice = Math.random();
      if (colorChoice < 0.4) {
        colors[i * 3] = 0.4; colors[i * 3 + 1] = 0.5; colors[i * 3 + 2] = 0.7; // Dim blue
      } else if (colorChoice < 0.7) {
        colors[i * 3] = 0.5; colors[i * 3 + 1] = 0.3; colors[i * 3 + 2] = 0.6; // Purple spores
      } else {
        colors[i * 3] = 0.3; colors[i * 3 + 1] = 0.6; colors[i * 3 + 2] = 0.5; // Greenish glow
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
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;

    // Better distance range for new camera position
    this.controls.minDistance = 15;
    this.controls.maxDistance = 60;

    // Better angle range for 3D perspective
    this.controls.minPolarAngle = Math.PI / 8;  // 22.5 degrees min
    this.controls.maxPolarAngle = Math.PI / 2.5;  // 72 degrees max

    this.controls.rotateSpeed = 0.8;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private setupMouseInteraction(): void {
    const canvas = this.renderer.domElement;

    // Mouse move for hover effect
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(Array.from(this.tileMeshes.values()));

      // Reset previous hover
      if (this.hoveredTile && this.hoveredTile !== this.getSelectedTileMesh()) {
        const material = this.hoveredTile.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = this.hoveredTile.userData['tile'].type === 0 ? 0.05 : 0.2;
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
    });

    // Mouse click for selection
    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(Array.from(this.tileMeshes.values()));

      // Reset previous selection
      const prevSelected = this.getSelectedTileMesh();
      if (prevSelected) {
        const material = prevSelected.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = prevSelected.userData['tile'].type === 0 ? 0.05 : 0.2;
      }

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const row = mesh.userData['row'];
        const col = mesh.userData['col'];

        this.selectedTile = { row, col };

        // Highlight selected tile
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = 0.8;

        // Check if in terrain edit mode
        if (this.terrainEditMode !== 'none') {
          this.handleTerrainEdit(row, col);
        } else {
          // Try to place a tower
          if (this.gameBoardService.canPlaceTower(row, col)) {
            if (this.gameBoardService.placeTower(row, col, this.selectedTowerType)) {
              this.spawnTower(row, col, this.selectedTowerType);
            }
          }
        }
      } else {
        this.selectedTile = null;
      }
    });
  }

  private spawnTower(row: number, col: number, towerType: string): void {
    const key = `${row}-${col}`;

    // Don't place if tower already exists
    if (this.towerMeshes.has(key)) {
      return;
    }

    const towerMesh = this.gameBoardService.createTowerMesh(row, col, towerType);
    this.towerMeshes.set(key, towerMesh);
    this.scene.add(towerMesh);

    // Clear enemy path cache since board layout changed
    this.enemyService.clearPathCache();
  }

  public selectTowerType(type: string): void {
    this.selectedTowerType = type;
  }

  /**
   * Toggle terrain paint mode on/off
   */
  public togglePaintMode(): void {
    this.terrainEditMode = this.terrainEditMode === 'paint' ? 'none' : 'paint';
    console.log(`Terrain paint mode: ${this.terrainEditMode}`);
  }

  /**
   * Toggle terrain height edit mode on/off
   */
  public toggleHeightMode(): void {
    this.terrainEditMode = this.terrainEditMode === 'height' ? 'none' : 'height';
    console.log(`Height edit mode: ${this.terrainEditMode}`);
  }

  /**
   * Select terrain type for painting
   */
  public selectTerrainType(type: string): void {
    // Convert string to TerrainType enum
    switch (type) {
      case 'bedrock':
        this.selectedTerrainType = TerrainType.BEDROCK;
        break;
      case 'mithril_crystal':
        this.selectedTerrainType = TerrainType.MITHRIL_CRYSTAL;
        break;
      case 'luminous_moss':
        this.selectedTerrainType = TerrainType.LUMINOUS_MOSS;
        break;
      case 'abyss':
        this.selectedTerrainType = TerrainType.ABYSS;
        break;
      default:
        console.warn(`Unknown terrain type: ${type}`);
    }
    console.log(`Selected terrain: ${this.selectedTerrainType}`);
  }

  /**
   * Generate new procedural terrain
   */
  public generateNewTerrain(): void {
    const layout = this.terrainService.generateProceduralTerrain({
      width: this.gameBoardService.getBoardWidth(),
      height: this.gameBoardService.getBoardHeight()
    });
    this.gameBoardService.applyTerrainLayout(layout);
    this.refreshBoard();
    console.log('Generated new procedural terrain');
  }

  /**
   * Save current terrain layout
   */
  public saveTerrain(): void {
    const result = this.terrainService.saveLayout();
    if (result.success) {
      console.log(result.message);
      alert(`✓ ${result.message}`);
    } else {
      console.error(result.error);
      alert(`✗ ${result.error}`);
    }
  }

  private getSelectedTileMesh(): THREE.Mesh | null {
    if (!this.selectedTile) return null;
    return this.tileMeshes.get(`${this.selectedTile.row}-${this.selectedTile.col}`) || null;
  }

  private handleKeyboard(event: KeyboardEvent): void {
    switch (event.key.toLowerCase()) {
      // Enemy spawning
      case 'e':
        // Spawn basic enemy
        this.enemyService.spawnEnemy(EnemyType.BASIC, this.scene);
        break;
      case '1':
        this.enemyService.spawnEnemy(EnemyType.BASIC, this.scene);
        break;
      case '2':
        this.enemyService.spawnEnemy(EnemyType.FAST, this.scene);
        break;
      case '3':
        this.enemyService.spawnEnemy(EnemyType.HEAVY, this.scene);
        break;
      case '4':
        this.enemyService.spawnEnemy(EnemyType.FLYING, this.scene);
        break;
      case '5':
        this.enemyService.spawnEnemy(EnemyType.BOSS, this.scene);
        break;

      // Terrain editing controls
      case 't':
        // Toggle terrain paint mode
        this.terrainEditMode = this.terrainEditMode === 'paint' ? 'none' : 'paint';
        console.log(`Terrain paint mode: ${this.terrainEditMode}`);
        break;
      case 'h':
        // Toggle height edit mode
        this.terrainEditMode = this.terrainEditMode === 'height' ? 'none' : 'height';
        console.log(`Height edit mode: ${this.terrainEditMode}`);
        break;
      case 'b':
        // Select Bedrock terrain
        this.selectedTerrainType = TerrainType.BEDROCK;
        console.log('Selected terrain: Bedrock');
        break;
      case 'c':
        // Select Crystal terrain
        this.selectedTerrainType = TerrainType.MITHRIL_CRYSTAL;
        console.log('Selected terrain: Mithril Crystal');
        break;
      case 'm':
        // Select Moss terrain
        this.selectedTerrainType = TerrainType.LUMINOUS_MOSS;
        console.log('Selected terrain: Luminous Moss');
        break;
      case 'a':
        // Select Abyss terrain
        this.selectedTerrainType = TerrainType.ABYSS;
        console.log('Selected terrain: Abyss');
        break;
      case 's':
        // Save current terrain layout
        if (event.ctrlKey || event.metaKey) {
          const result = this.terrainService.saveLayout();
          console.log(result.success ? result.message : result.error);
        }
        break;
      case 'g':
        // Generate new procedural terrain
        if (event.ctrlKey || event.metaKey) {
          const layout = this.terrainService.generateProceduralTerrain({
            width: this.gameBoardService.getBoardWidth(),
            height: this.gameBoardService.getBoardHeight()
          });
          this.gameBoardService.applyTerrainLayout(layout);
          this.refreshBoard();
          console.log('Generated new procedural terrain');
        }
        break;
    }
  }

  private setupKeyboardControls(): void {
    window.addEventListener('keydown', this.keyboardHandler);
  }

  private animate = (time: number = 0): void => {
    requestAnimationFrame(this.animate);

    // Calculate delta time in seconds
    const deltaTime = this.lastTime === 0 ? 0 : (time - this.lastTime) / 1000;
    this.lastTime = time;

    // Update controls if they exist
    if (this.controls) {
      this.controls.update();
    }

    // Animate particles - gentle floating motion
    if (this.particles) {
      const positionAttribute = this.particles.geometry.attributes['position'] as THREE.BufferAttribute;
      const positions = positionAttribute.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(Date.now() * 0.001 + i) * 0.002;
      }
      positionAttribute.needsUpdate = true;
      this.particles.rotation.y += 0.0002;
    }

    // Update enemies
    if (deltaTime > 0) {
      const reachedExit = this.enemyService.updateEnemies(deltaTime);
      // Remove enemies that reached the exit
      reachedExit.forEach(enemyId => {
        this.enemyService.removeEnemy(enemyId, this.scene);
      });
    }

    // Use composer for post-processing instead of direct render
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Initialize terrain system - generate or load terrain layout
   */
  private initializeTerrain(): void {
    let layout = this.terrainService.getCurrentLayout();

    // If no terrain layout exists, generate a procedural one
    if (!layout) {
      layout = this.terrainService.generateProceduralTerrain({
        width: this.gameBoardService.getBoardWidth(),
        height: this.gameBoardService.getBoardHeight(),
        elevatedChance: 0.15,
        sunkenChance: 0.1,
        crystalChance: 0.12,
        mossChance: 0.15,
        abyssChance: 0.03
      });
    }

    // Apply terrain to game board
    this.gameBoardService.applyTerrainLayout(layout);
  }

  /**
   * Subscribe to terrain layout changes
   */
  private subscribeToTerrainChanges(): void {
    this.terrainLayoutSubscription = this.terrainService.currentLayout$.subscribe(layout => {
      if (layout) {
        // Refresh the entire board when terrain changes
        this.refreshBoard();
      }
    });
  }

  /**
   * Subscribe to theme changes
   */
  private subscribeToThemeChanges(): void {
    this.themeSubscription = this.themeService.currentTheme$.subscribe(theme => {
      // Update scene colors and lighting based on theme
      this.applyThemeToScene(theme);
      // Refresh board to update terrain colors
      this.refreshBoard();
    });
  }

  /**
   * Apply theme configuration to the scene
   */
  private applyThemeToScene(theme: ThemeConfig): void {
    // Update background and fog
    if (this.scene) {
      this.scene.background = new THREE.Color(theme.backgroundColor);
      this.scene.fog = new THREE.FogExp2(theme.fogColor, theme.fogDensity);
    }

    // Update lights based on theme
    if (this.ambientLight) {
      this.ambientLight.color.setHex(theme.ambientLightColor);
      this.ambientLight.intensity = theme.ambientLightIntensity;
    }

    if (this.mainLight) {
      this.mainLight.color.setHex(theme.directionalLightColor);
      this.mainLight.intensity = theme.directionalLightIntensity;
    }
  }

  /**
   * Refresh the entire game board (re-render all tiles)
   */
  private refreshBoard(): void {
    // Remove existing tile meshes
    this.tileMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    this.tileMeshes.clear();

    // Re-render board with updated terrain
    this.renderGameBoard();

    // Update terrain lights to match new terrain
    this.updateTerrainLights();
  }

  /**
   * Handle terrain painting on tile click
   */
  private handleTerrainEdit(row: number, col: number): void {
    if (this.terrainEditMode === 'paint') {
      // Paint terrain type
      const result = this.terrainService.paintTerrain(row, col, this.selectedTerrainType);
      if (result.success) {
        // Update the tile mesh
        this.updateTileMesh(row, col);
        // Clear path cache since terrain changed
        this.enemyService.clearPathCache();
      }
    } else if (this.terrainEditMode === 'height') {
      // Adjust height (raise on left click, will add lower on right click later)
      const result = this.terrainService.adjustHeight(row, col, 1);
      if (result.success) {
        // Update the tile mesh
        this.updateTileMesh(row, col);
        // Clear path cache since terrain changed
        this.enemyService.clearPathCache();
      }
    }
  }

  /**
   * Update a single tile mesh (for terrain editing)
   */
  private updateTileMesh(row: number, col: number): void {
    const key = `${row}-${col}`;
    const oldMesh = this.tileMeshes.get(key);

    if (oldMesh) {
      // Remove old mesh
      this.scene.remove(oldMesh);
      oldMesh.geometry.dispose();
      if (Array.isArray(oldMesh.material)) {
        oldMesh.material.forEach(mat => mat.dispose());
      } else {
        oldMesh.material.dispose();
      }

      // Create new mesh with updated terrain
      const tile = this.gameBoardService.getGameBoard()[row][col];
      const newMesh = this.gameBoardService.createTileMesh(row, col, tile.type);
      newMesh.userData = { row, col, tile };

      // Add to scene and update map
      this.scene.add(newMesh);
      this.tileMeshes.set(key, newMesh);

      // Update terrain lights to reflect new terrain
      // NOTE: This updates ALL lights (not optimal but correct)
      // TODO: Optimize to update only affected lights
      this.updateTerrainLights();
    }
  }

  ngOnDestroy(): void {
    // Clean up event listeners
    window.removeEventListener('keydown', this.keyboardHandler);

    // Clean up subscriptions
    this.terrainLayoutSubscription?.unsubscribe();
    this.themeSubscription?.unsubscribe();

    // Clean up Three.js resources
    this.renderer.dispose();
  }
}
