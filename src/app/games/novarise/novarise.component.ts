import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { TerrainGrid } from './features/terrain-editor/terrain-grid.class';
import { TerrainType } from './models/terrain-types.enum';

export type EditMode = 'paint' | 'height';

@Component({
  selector: 'app-novarise',
  templateUrl: './novarise.component.html',
  styleUrls: ['./novarise.component.scss']
})
export class NovariseComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;

  // Edit state
  public editMode: EditMode = 'paint';
  public selectedTerrainType: TerrainType = TerrainType.BEDROCK;
  public brushSize = 1;

  // Camera configuration
  private readonly cameraDistance = 35;
  private readonly cameraFov = 45;

  // Scene objects
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private composer!: EffectComposer;
  private particles!: THREE.Points;

  // Terrain
  private terrainGrid!: TerrainGrid;

  // Interaction
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private hoveredTile: THREE.Mesh | null = null;
  private isMouseDown = false;

  // Camera movement
  private cameraVelocity = { x: 0, y: 0, z: 0 };
  private moveSpeed = 0.5;
  private keysPressed = new Set<string>();

  // Event handlers
  private keyboardHandler: (event: KeyboardEvent) => void;
  private keyUpHandler: (event: KeyboardEvent) => void;
  private mouseDownHandler: (event: MouseEvent) => void;
  private mouseUpHandler: (event: MouseEvent) => void;

  constructor() {
    this.keyboardHandler = this.handleKeyDown.bind(this);
    this.keyUpHandler = this.handleKeyUp.bind(this);
    this.mouseDownHandler = this.handleMouseDown.bind(this);
    this.mouseUpHandler = this.handleMouseUp.bind(this);
  }

  ngAfterViewInit(): void {
    this.initializeScene();
    this.initializeCamera();
    this.initializeLights();
    this.addSkybox();
    this.initializeParticles();
    this.initializeRenderer();
    this.initializePostProcessing();
    this.initializeControls();

    // Initialize terrain grid
    this.terrainGrid = new TerrainGrid(this.scene, 25);

    // Add helpers for spatial reference
    this.addHelpers();

    this.setupInteraction();
    this.setupKeyboardControls();
    this.animate();
  }

  private initializeScene(): void {
    this.scene = new THREE.Scene();
    // Lighter background for better visibility
    this.scene.background = new THREE.Color(0x1a1a2e);
    // Reduce fog for better visibility
    this.scene.fog = new THREE.FogExp2(0x1a1a2e, 0.005);
  }

  private initializeCamera(): void {
    const aspectRatio = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      this.cameraFov,
      aspectRatio,
      0.1,
      1000
    );
    this.camera.position.set(0, this.cameraDistance, this.cameraDistance * 0.5);
    this.camera.lookAt(0, 0, 0);
  }

  private initializeRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.8; // Increased from 1.2 for brightness
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.canvasContainer.nativeElement.appendChild(this.renderer.domElement);

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
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Reduced bloom for better visibility
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.3,  // Reduced strength
      0.4,  // Reduced radius
      0.95  // Higher threshold - only brightest elements
    );
    this.composer.addPass(bloomPass);

    // Lighter vignette for better edge visibility
    const vignetteShader = {
      uniforms: {
        tDiffuse: { value: null },
        offset: { value: 1.2 },      // Increased offset = less vignette
        darkness: { value: 0.8 }     // Reduced darkness
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
    // VERY BRIGHT ambient light for full visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    this.scene.add(ambientLight);

    // Multiple strong directional lights for even coverage
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight1.position.set(10, 40, 10);
    directionalLight1.castShadow = true;
    directionalLight1.shadow.camera.left = -30;
    directionalLight1.shadow.camera.right = 30;
    directionalLight1.shadow.camera.top = 30;
    directionalLight1.shadow.camera.bottom = -30;
    directionalLight1.shadow.mapSize.width = 2048;
    directionalLight1.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight1);

    // Second directional light from opposite angle
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight2.position.set(-10, 30, -10);
    this.scene.add(directionalLight2);

    // Bright light from below for complete visibility
    const bottomLight = new THREE.DirectionalLight(0xffffff, 1.0);
    bottomLight.position.set(0, -20, 0);
    bottomLight.lookAt(0, 0, 0);
    this.scene.add(bottomLight);

    // Hemisphere light for natural fill
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 1.0);
    this.scene.add(hemiLight);

    // Point lights for extra brightness at key positions
    const pointLight1 = new THREE.PointLight(0xffffff, 1.0, 50);
    pointLight1.position.set(0, 20, 0);
    this.scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xffffff, 0.8, 50);
    pointLight2.position.set(15, 15, 15);
    this.scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0xffffff, 0.8, 50);
    pointLight3.position.set(-15, 15, -15);
    this.scene.add(pointLight3);
  }

  private addSkybox(): void {
    const starfieldGeometry = new THREE.SphereGeometry(500, 32, 32);
    const starfieldMaterial = new THREE.ShaderMaterial({
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

    const starfield = new THREE.Mesh(starfieldGeometry, starfieldMaterial);
    this.scene.add(starfield);
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

    // Disable all mouse controls - mouse is reserved for terrain editing
    this.controls.enabled = false;
    this.controls.enableRotate = false;
    this.controls.enablePan = false;
    this.controls.enableZoom = false;

    // Keep damping for smooth WASD movement
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;

    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private setupInteraction(): void {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const tileMeshes = this.terrainGrid.getTileMeshes();
      const intersects = this.raycaster.intersectObjects(tileMeshes);

      // Reset previous hover
      if (this.hoveredTile) {
        const material = this.hoveredTile.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = 0.2;
      }

      if (intersects.length > 0) {
        this.hoveredTile = intersects[0].object as THREE.Mesh;
        const material = this.hoveredTile.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = 0.6;
        canvas.style.cursor = 'pointer';

        // Apply edit if mouse is down
        if (this.isMouseDown) {
          this.applyEdit(this.hoveredTile);
        }
      } else {
        this.hoveredTile = null;
        canvas.style.cursor = 'default';
      }
    });

    canvas.addEventListener('mousedown', this.mouseDownHandler);
    canvas.addEventListener('mouseup', this.mouseUpHandler);
    canvas.addEventListener('mouseleave', this.mouseUpHandler);
  }

  private handleMouseDown(event: MouseEvent): void {
    if (event.button === 0) { // Left click
      this.isMouseDown = true;
      if (this.hoveredTile) {
        this.applyEdit(this.hoveredTile);
      }
    }
  }

  private handleMouseUp(): void {
    this.isMouseDown = false;
  }

  private applyEdit(mesh: THREE.Mesh): void {
    const x = mesh.userData['gridX'];
    const z = mesh.userData['gridZ'];

    if (this.editMode === 'paint') {
      this.terrainGrid.paintTile(x, z, this.selectedTerrainType);
    } else if (this.editMode === 'height') {
      const delta = 0.2;
      this.terrainGrid.adjustHeight(x, z, delta);
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    this.keysPressed.add(key);

    // Mode and terrain shortcuts
    switch (key) {
      case 't':
        this.setEditMode('paint');
        break;
      case 'h':
        this.setEditMode('height');
        break;
      case '1':
        this.setTerrainType(TerrainType.BEDROCK);
        break;
      case '2':
        this.setTerrainType(TerrainType.CRYSTAL);
        break;
      case '3':
        this.setTerrainType(TerrainType.MOSS);
        break;
      case '4':
        this.setTerrainType(TerrainType.ABYSS);
        break;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.keysPressed.delete(event.key.toLowerCase());
  }

  private setupKeyboardControls(): void {
    window.addEventListener('keydown', this.keyboardHandler);
    window.addEventListener('keyup', this.keyUpHandler);
  }

  private updateCameraMovement(): void {
    // Check if any movement keys are pressed
    const isMoving = this.keysPressed.has('w') || this.keysPressed.has('s') ||
                     this.keysPressed.has('a') || this.keysPressed.has('d') ||
                     this.keysPressed.has('q') || this.keysPressed.has('e');

    // Only process movement if keys are actually pressed
    if (!isMoving) {
      return;
    }

    // Get camera forward and right vectors
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0; // Keep movement horizontal
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    // Reset velocity
    this.cameraVelocity.x = 0;
    this.cameraVelocity.z = 0;
    this.cameraVelocity.y = 0;

    // WASD movement
    if (this.keysPressed.has('w')) {
      this.cameraVelocity.x += forward.x * this.moveSpeed;
      this.cameraVelocity.z += forward.z * this.moveSpeed;
    }
    if (this.keysPressed.has('s')) {
      this.cameraVelocity.x -= forward.x * this.moveSpeed;
      this.cameraVelocity.z -= forward.z * this.moveSpeed;
    }
    if (this.keysPressed.has('a')) {
      this.cameraVelocity.x -= right.x * this.moveSpeed;
      this.cameraVelocity.z -= right.z * this.moveSpeed;
    }
    if (this.keysPressed.has('d')) {
      this.cameraVelocity.x += right.x * this.moveSpeed;
      this.cameraVelocity.z += right.z * this.moveSpeed;
    }

    // Q/E for up/down
    if (this.keysPressed.has('q')) {
      this.cameraVelocity.y -= this.moveSpeed;
    }
    if (this.keysPressed.has('e')) {
      this.cameraVelocity.y += this.moveSpeed;
    }

    // Apply movement
    this.camera.position.x += this.cameraVelocity.x;
    this.camera.position.y += this.cameraVelocity.y;
    this.camera.position.z += this.cameraVelocity.z;

    // Update orbit controls target to follow camera ONLY when moving
    if (this.controls) {
      this.controls.target.set(
        this.camera.position.x + forward.x * 10,
        this.camera.position.y - 5,
        this.camera.position.z + forward.z * 10
      );
    }
  }

  private addHelpers(): void {
    // Add grid helper for spatial reference
    const gridHelper = new THREE.GridHelper(30, 30, 0x666666, 0x333333);
    gridHelper.position.y = -0.5;
    this.scene.add(gridHelper);

    // Add axis helper
    const axesHelper = new THREE.AxesHelper(5);
    this.scene.add(axesHelper);
  }

  public setEditMode(mode: EditMode): void {
    this.editMode = mode;
  }

  public setTerrainType(type: TerrainType): void {
    this.selectedTerrainType = type;
    if (this.editMode !== 'paint') {
      this.editMode = 'paint';
    }
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    // Update camera movement
    this.updateCameraMovement();

    if (this.controls) {
      this.controls.update();
    }

    if (this.particles) {
      const positionAttribute = this.particles.geometry.attributes['position'] as THREE.BufferAttribute;
      const positions = positionAttribute.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(Date.now() * 0.001 + i) * 0.002;
      }
      positionAttribute.needsUpdate = true;
      this.particles.rotation.y += 0.0002;
    }

    if (this.composer) {
      this.composer.render();
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.keyboardHandler);
    window.removeEventListener('keyup', this.keyUpHandler);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('mousedown', this.mouseDownHandler);
    canvas.removeEventListener('mouseup', this.mouseUpHandler);
    canvas.removeEventListener('mouseleave', this.mouseUpHandler);

    if (this.terrainGrid) {
      this.terrainGrid.dispose();
    }
    this.renderer.dispose();
  }
}
