import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { GameBoardService } from './game-board.service';
import { EnemyService } from './services/enemy.service';
import { EnemyType } from './models/enemy.model';

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

  constructor(
    private gameBoardService: GameBoardService,
    private enemyService: EnemyService
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

  private initializeScene(): void {
    this.scene = new THREE.Scene();
    // Dark cave atmosphere
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

    // Position camera above the board looking down
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
    // Dim ambient light - cave atmosphere
    const ambientLight = new THREE.AmbientLight(0x3a2a4a, 0.3);
    this.scene.add(ambientLight);

    // Main light from above - like light filtering through cave opening
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

    // Mysterious glow from below - bioluminescent cave floor effect
    const underLight = new THREE.PointLight(0x4a3a6a, 0.5, 50);
    underLight.position.set(0, -5, 0);
    this.scene.add(underLight);

    // Accent lights for cave crystals effect
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
    const gridLines = this.gameBoardService.createGridLines();
    this.scene.add(gridLines);
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
    this.controls.dampingFactor = this.controlsDampingFactor;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = this.cameraDistance / 2;
    this.controls.maxDistance = this.cameraDistance * 3;
    this.controls.minPolarAngle = this.minPolarAngle;
    this.controls.maxPolarAngle = this.maxPolarAngle;
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

        // Try to place a tower
        if (this.gameBoardService.canPlaceTower(row, col)) {
          if (this.gameBoardService.placeTower(row, col, this.selectedTowerType)) {
            this.spawnTower(row, col, this.selectedTowerType);
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

  private getSelectedTileMesh(): THREE.Mesh | null {
    if (!this.selectedTile) return null;
    return this.tileMeshes.get(`${this.selectedTile.row}-${this.selectedTile.col}`) || null;
  }

  private handleKeyboard(event: KeyboardEvent): void {
    switch (event.key.toLowerCase()) {
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

  ngOnDestroy(): void {
    // Clean up event listeners
    window.removeEventListener('keydown', this.keyboardHandler);

    // Clean up Three.js resources
    this.renderer.dispose();
  }
}
