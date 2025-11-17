import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { GameBoardService } from './game-board.service';

@Component({
  selector: 'app-game-board',
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss']
})
export class GameBoardComponent implements OnInit, AfterViewInit {
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

  constructor(private gameBoardService: GameBoardService) { }

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
    this.animate();
  }

  private initializeScene(): void {
    this.scene = new THREE.Scene();
    // Remove solid background - skybox will provide the background
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.Fog(0x000814, 50, 200);
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

    // Add bloom pass for glowing effects
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.6,  // strength
      0.4,  // radius
      0.85  // threshold
    );
    this.composer.addPass(bloomPass);

    // Add vignette effect using custom shader
    const vignetteShader = {
      uniforms: {
        tDiffuse: { value: null },
        offset: { value: 0.95 },
        darkness: { value: 1.2 }
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
    // Ambient light for overall illumination - slightly cooler tone for space feel
    const ambientLight = new THREE.AmbientLight(0xccddff, 0.4);
    this.scene.add(ambientLight);

    // Main directional light for shadows and definition
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    // Fill light from opposite side - warmer tone
    const fillLight = new THREE.DirectionalLight(0xffddaa, 0.2);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);

    // Accent rim light for visual depth
    const rimLight = new THREE.DirectionalLight(0x6688ff, 0.3);
    rimLight.position.set(0, 5, -15);
    this.scene.add(rimLight);
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
          // Create a deep space gradient
          vec3 deepBlue = vec3(0.0, 0.02, 0.1);
          vec3 purple = vec3(0.05, 0.0, 0.15);
          vec3 color = mix(deepBlue, purple, vUv.y);

          // Add stars
          vec2 starPos = vUv * 100.0;
          float star = random(floor(starPos));
          if (star > 0.985) {
            float brightness = random(floor(starPos) + 1.0);
            color += vec3(brightness * 0.8);
          }

          // Add some nebula-like clouds
          float nebula = random(floor(vUv * 20.0)) * 0.1;
          color += vec3(nebula * 0.2, nebula * 0.1, nebula * 0.3);

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
    // Create floating ambient particles
    const particleCount = 500;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      // Distribute particles in a large area around the board
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 40 + 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;

      // Random colors - cyan, purple, blue tints
      const colorChoice = Math.random();
      if (colorChoice < 0.33) {
        colors[i * 3] = 0.3; colors[i * 3 + 1] = 0.8; colors[i * 3 + 2] = 1.0; // Cyan
      } else if (colorChoice < 0.66) {
        colors[i * 3] = 0.6; colors[i * 3 + 1] = 0.3; colors[i * 3 + 2] = 1.0; // Purple
      } else {
        colors[i * 3] = 0.8; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 1.0; // Blue-white
      }
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
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
        material.emissiveIntensity = this.hoveredTile.userData['tile'].type === 0 ? 0.1 : 0.3;
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
        material.emissiveIntensity = prevSelected.userData['tile'].type === 0 ? 0.1 : 0.3;
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
  }

  public selectTowerType(type: string): void {
    this.selectedTowerType = type;
  }

  private getSelectedTileMesh(): THREE.Mesh | null {
    if (!this.selectedTile) return null;
    return this.tileMeshes.get(`${this.selectedTile.row}-${this.selectedTile.col}`) || null;
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

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

    // Use composer for post-processing instead of direct render
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
