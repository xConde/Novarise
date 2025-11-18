import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { TerrainGrid } from './features/terrain-editor/terrain-grid.class';
import { TerrainType } from './models/terrain-types.enum';

export type EditMode = 'paint' | 'height' | 'spawn' | 'exit';

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
  private brushIndicator!: THREE.Mesh;
  private lastEditedTiles = new Set<THREE.Mesh>();
  private lastEditTime = 0;
  private editThrottleMs = 50; // Throttle edits during drag to 20fps max

  // Visual markers
  private spawnMarker!: THREE.Mesh;
  private exitMarker!: THREE.Mesh;

  // Camera movement
  private cameraVelocity = { x: 0, y: 0, z: 0 };
  private targetVelocity = { x: 0, y: 0, z: 0 };  // For smooth acceleration
  private moveSpeed = 0.25;  // Reduced from 0.4 for gentler movement
  private fastSpeed = 0.6;   // Reduced from 1.0 for smoother fast movement
  private acceleration = 0.15;  // Smooth acceleration/deceleration
  private rotationSpeed = 0.005;  // Controlled rotation
  private keysPressed = new Set<string>();

  // Camera rotation
  private cameraRotation = { yaw: 0, pitch: 0 };
  private targetRotation = { yaw: 0, pitch: 0 };  // Target rotation for smooth acceleration
  private rotationAcceleration = 0.15;  // Smooth rotation acceleration (matches movement)

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

    // Create brush indicator for crisp visual feedback
    this.createBrushIndicator();

    // Create spawn/exit markers for tower defense
    this.createSpawnExitMarkers();

    // Initialize camera rotation to match initial camera view
    this.initializeCameraRotation();

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

  private initializeCameraRotation(): void {
    // Calculate initial rotation based on camera's current position and lookAt point
    const lookAtPoint = new THREE.Vector3(0, 0, 0);
    const direction = new THREE.Vector3().subVectors(lookAtPoint, this.camera.position);

    // Calculate yaw (horizontal rotation) from X and Z components
    const initialYaw = Math.atan2(direction.x, direction.z);
    this.cameraRotation.yaw = initialYaw;
    this.targetRotation.yaw = initialYaw;

    // Calculate pitch (vertical rotation) from Y component and horizontal distance
    const horizontalDistance = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    const initialPitch = Math.atan2(direction.y, horizontalDistance);
    this.cameraRotation.pitch = initialPitch;
    this.targetRotation.pitch = initialPitch;
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
    // EXTREMELY BRIGHT ambient light for maximum visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    this.scene.add(ambientLight);

    // Multiple strong directional lights for even coverage
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 2.5);
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
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight2.position.set(-10, 30, -10);
    this.scene.add(directionalLight2);

    // Third directional light from side
    const directionalLight3 = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight3.position.set(20, 25, 0);
    this.scene.add(directionalLight3);

    // Fourth directional light from opposite side
    const directionalLight4 = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight4.position.set(-20, 25, 0);
    this.scene.add(directionalLight4);

    // Bright light from below for complete visibility
    const bottomLight = new THREE.DirectionalLight(0xffffff, 1.5);
    bottomLight.position.set(0, -20, 0);
    bottomLight.lookAt(0, 0, 0);
    this.scene.add(bottomLight);

    // Hemisphere light for natural fill
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xaaaaaa, 1.5);
    this.scene.add(hemiLight);

    // Point lights for extra brightness at key positions
    const pointLight1 = new THREE.PointLight(0xffffff, 1.5, 50);
    pointLight1.position.set(0, 20, 0);
    this.scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xffffff, 1.2, 50);
    pointLight2.position.set(15, 15, 15);
    this.scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0xffffff, 1.2, 50);
    pointLight3.position.set(-15, 15, -15);
    this.scene.add(pointLight3);

    const pointLight4 = new THREE.PointLight(0xffffff, 1.2, 50);
    pointLight4.position.set(15, 15, -15);
    this.scene.add(pointLight4);

    const pointLight5 = new THREE.PointLight(0xffffff, 1.2, 50);
    pointLight5.position.set(-15, 15, 15);
    this.scene.add(pointLight5);
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

    // Disable damping - we handle our own smoothing
    this.controls.enableDamping = false;

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

      // Reset previous hover with crisp transition
      if (this.hoveredTile && !this.lastEditedTiles.has(this.hoveredTile)) {
        const material = this.hoveredTile.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = 0.2;
      }

      if (intersects.length > 0) {
        this.hoveredTile = intersects[0].object as THREE.Mesh;
        const material = this.hoveredTile.material as THREE.MeshStandardMaterial;

        // Crisp, bright hover state for clear feedback
        material.emissiveIntensity = 0.9;

        // Position brush indicator at tile location
        this.brushIndicator.position.copy(this.hoveredTile.position);
        this.brushIndicator.position.y = this.hoveredTile.position.y + 0.15;
        this.brushIndicator.visible = true;

        // Update brush color based on mode for instant visual feedback
        const brushMaterial = this.brushIndicator.material as THREE.MeshBasicMaterial;
        const modeColors = {
          'paint': 0x6a9aff,
          'height': 0xff6a9a,
          'spawn': 0x50ff50,
          'exit': 0xff5050
        };
        brushMaterial.color.setHex(modeColors[this.editMode]);

        // Crisp cursor change for mode indication
        const modeCursors = {
          'paint': 'cell',
          'height': 'ns-resize',
          'spawn': 'crosshair',
          'exit': 'crosshair'
        };
        canvas.style.cursor = modeCursors[this.editMode];

        // Apply edit if mouse is down (with throttling for performance)
        if (this.isMouseDown) {
          const now = Date.now();
          if (now - this.lastEditTime >= this.editThrottleMs) {
            this.applyEdit(this.hoveredTile);
            this.lastEditTime = now;
          }
        }
      } else {
        this.hoveredTile = null;
        this.brushIndicator.visible = false;
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
      // Crisp visual feedback: brief flash on edit
      this.flashTileEdit(mesh);
    } else if (this.editMode === 'height') {
      const delta = 0.2;
      this.terrainGrid.adjustHeight(x, z, delta);
      // Get the updated mesh after height change
      const tile = this.terrainGrid.getTileAt(x, z);
      if (tile) {
        this.flashTileEdit(tile.mesh);
      }
    } else if (this.editMode === 'spawn') {
      this.terrainGrid.setSpawnPoint(x, z);
      this.updateSpawnMarker();
      this.flashTileEdit(mesh);
    } else if (this.editMode === 'exit') {
      this.terrainGrid.setExitPoint(x, z);
      this.updateExitMarker();
      this.flashTileEdit(mesh);
    }
  }

  private flashTileEdit(mesh: THREE.Mesh): void {
    // Crisp flash animation for immediate feedback
    const material = mesh.material as THREE.MeshStandardMaterial;
    const originalIntensity = material.emissiveIntensity;

    // Add to edited tiles set
    this.lastEditedTiles.add(mesh);

    // Instant bright flash
    material.emissiveIntensity = 1.5;

    // Quick fade back for crisp feel
    setTimeout(() => {
      material.emissiveIntensity = 0.9; // Hover state
      setTimeout(() => {
        this.lastEditedTiles.delete(mesh);
        if (this.hoveredTile !== mesh) {
          material.emissiveIntensity = originalIntensity;
        }
      }, 100);
    }, 50);
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
      case 's':
        if (!event.shiftKey) { // Only if not shift (which is for speed)
          this.setEditMode('spawn');
        }
        break;
      case 'x':
        this.setEditMode('exit');
        break;
      case 'g':
        this.saveGridState();
        break;
      case 'l':
        this.loadGridState();
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
    // Arrow keys for camera rotation - update target rotation
    if (this.keysPressed.has('arrowleft')) {
      this.targetRotation.yaw += this.rotationSpeed;
    }
    if (this.keysPressed.has('arrowright')) {
      this.targetRotation.yaw -= this.rotationSpeed;
    }
    if (this.keysPressed.has('arrowup')) {
      // Limited to 45 degrees (reduced from 60 degrees)
      this.targetRotation.pitch = Math.min(this.targetRotation.pitch + this.rotationSpeed, Math.PI / 4);
    }
    if (this.keysPressed.has('arrowdown')) {
      // Allowed to -75 degrees for near top-down view (increased from -30 degrees)
      this.targetRotation.pitch = Math.max(this.targetRotation.pitch - this.rotationSpeed, -Math.PI * 5 / 12);
    }

    // ALWAYS smoothly interpolate rotation (even when no keys pressed) for perfect smoothness
    this.cameraRotation.yaw += (this.targetRotation.yaw - this.cameraRotation.yaw) * this.rotationAcceleration;
    this.cameraRotation.pitch += (this.targetRotation.pitch - this.cameraRotation.pitch) * this.rotationAcceleration;

    // Determine movement speed (Shift for faster)
    const currentSpeed = this.keysPressed.has('shift') ? this.fastSpeed : this.moveSpeed;

    // Calculate camera direction based on yaw rotation
    const forward = new THREE.Vector3(
      Math.sin(this.cameraRotation.yaw),
      0,
      Math.cos(this.cameraRotation.yaw)
    );
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    // Reset target velocity
    this.targetVelocity.x = 0;
    this.targetVelocity.z = 0;
    this.targetVelocity.y = 0;

    // Calculate target velocity based on input (WASD movement)
    if (this.keysPressed.has('w')) {
      this.targetVelocity.x += forward.x * currentSpeed;
      this.targetVelocity.z += forward.z * currentSpeed;
    }
    if (this.keysPressed.has('s')) {
      this.targetVelocity.x -= forward.x * currentSpeed;
      this.targetVelocity.z -= forward.z * currentSpeed;
    }
    if (this.keysPressed.has('a')) {
      this.targetVelocity.x -= right.x * currentSpeed;
      this.targetVelocity.z -= right.z * currentSpeed;
    }
    if (this.keysPressed.has('d')) {
      this.targetVelocity.x += right.x * currentSpeed;
      this.targetVelocity.z += right.z * currentSpeed;
    }

    // Q/E for up/down
    if (this.keysPressed.has('q')) {
      this.targetVelocity.y -= currentSpeed;
    }
    if (this.keysPressed.has('e')) {
      this.targetVelocity.y += currentSpeed;
    }

    // Smooth acceleration/deceleration (lerp towards target velocity)
    this.cameraVelocity.x += (this.targetVelocity.x - this.cameraVelocity.x) * this.acceleration;
    this.cameraVelocity.y += (this.targetVelocity.y - this.cameraVelocity.y) * this.acceleration;
    this.cameraVelocity.z += (this.targetVelocity.z - this.cameraVelocity.z) * this.acceleration;

    // Apply movement
    this.camera.position.x += this.cameraVelocity.x;
    this.camera.position.y += this.cameraVelocity.y;
    this.camera.position.z += this.cameraVelocity.z;

    // Keep camera within reasonable bounds
    const maxDistance = 50;
    this.camera.position.x = Math.max(-maxDistance, Math.min(maxDistance, this.camera.position.x));
    this.camera.position.z = Math.max(-maxDistance, Math.min(maxDistance, this.camera.position.z));
    this.camera.position.y = Math.max(5, Math.min(60, this.camera.position.y));

    // Apply rotation to camera
    const lookAtDistance = 10;
    const targetX = this.camera.position.x + forward.x * lookAtDistance;
    const targetY = this.camera.position.y + Math.sin(this.cameraRotation.pitch) * lookAtDistance - 5;
    const targetZ = this.camera.position.z + forward.z * lookAtDistance;

    // Update orbit controls target
    if (this.controls) {
      this.controls.target.set(targetX, targetY, targetZ);
    }
  }

  private addHelpers(): void {
    // Add grid helper for spatial reference
    const gridHelper = new THREE.GridHelper(30, 30, 0x666666, 0x333333);
    gridHelper.position.y = -0.5;
    this.scene.add(gridHelper);

    // Remove axis helper - it's confusing and not needed for terrain editing
  }

  private createBrushIndicator(): void {
    // Create a ring to show brush area - crisp and clear
    const geometry = new THREE.RingGeometry(0.4, 0.5, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x6a9aff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      depthTest: false
    });
    this.brushIndicator = new THREE.Mesh(geometry, material);
    this.brushIndicator.rotation.x = -Math.PI / 2;
    this.brushIndicator.visible = false;
    this.brushIndicator.renderOrder = 1000; // Always render on top
    this.scene.add(this.brushIndicator);
  }

  private createSpawnExitMarkers(): void {
    // Spawn marker - green cylinder
    const spawnGeometry = new THREE.CylinderGeometry(0.3, 0.5, 0.8, 8);
    const spawnMaterial = new THREE.MeshBasicMaterial({
      color: 0x50ff50,
      transparent: true,
      opacity: 0.8
    });
    this.spawnMarker = new THREE.Mesh(spawnGeometry, spawnMaterial);
    this.spawnMarker.renderOrder = 999;
    this.scene.add(this.spawnMarker);

    // Exit marker - red cylinder
    const exitGeometry = new THREE.CylinderGeometry(0.5, 0.3, 0.8, 8);
    const exitMaterial = new THREE.MeshBasicMaterial({
      color: 0xff5050,
      transparent: true,
      opacity: 0.8
    });
    this.exitMarker = new THREE.Mesh(exitGeometry, exitMaterial);
    this.exitMarker.renderOrder = 999;
    this.scene.add(this.exitMarker);

    // Position markers at initial spawn/exit points
    this.updateSpawnMarker();
    this.updateExitMarker();
  }

  private updateSpawnMarker(): void {
    const spawn = this.terrainGrid.getSpawnPoint();
    if (spawn) {
      const tile = this.terrainGrid.getTileAt(spawn.x, spawn.z);
      if (tile) {
        this.spawnMarker.position.copy(tile.mesh.position);
        this.spawnMarker.position.y += 0.8;
        this.spawnMarker.visible = true;
      }
    }
  }

  private updateExitMarker(): void {
    const exit = this.terrainGrid.getExitPoint();
    if (exit) {
      const tile = this.terrainGrid.getTileAt(exit.x, exit.z);
      if (tile) {
        this.exitMarker.position.copy(tile.mesh.position);
        this.exitMarker.position.y += 0.8;
        this.exitMarker.visible = true;
      }
    }
  }

  private saveGridState(): void {
    const state = this.terrainGrid.exportState();
    const json = JSON.stringify(state);
    localStorage.setItem('novarise_terrain', json);
    console.log('Terrain saved to localStorage');
  }

  private loadGridState(): void {
    const json = localStorage.getItem('novarise_terrain');
    if (json) {
      try {
        const state = JSON.parse(json);
        this.terrainGrid.importState(state);
        this.updateSpawnMarker();
        this.updateExitMarker();
        console.log('Terrain loaded from localStorage');
      } catch (e) {
        console.error('Failed to load terrain:', e);
      }
    } else {
      console.log('No saved terrain found');
    }
  }

  public setEditMode(mode: EditMode): void {
    this.editMode = mode;
    // Update brush indicator color immediately for crisp feedback
    if (this.brushIndicator) {
      const material = this.brushIndicator.material as THREE.MeshBasicMaterial;
      const modeColors = {
        'paint': 0x6a9aff,
        'height': 0xff6a9a,
        'spawn': 0x50ff50,
        'exit': 0xff5050
      };
      material.color.setHex(modeColors[mode]);
    }
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

    // Animate brush indicator for crisp, noticeable feedback
    if (this.brushIndicator && this.brushIndicator.visible) {
      const pulse = Math.sin(Date.now() * 0.005) * 0.1 + 0.9;
      this.brushIndicator.scale.set(pulse, pulse, 1);
      const material = this.brushIndicator.material as THREE.MeshBasicMaterial;
      material.opacity = 0.6 + Math.sin(Date.now() * 0.005) * 0.2;
    }

    // Animate spawn/exit markers
    if (this.spawnMarker) {
      const bounce = Math.abs(Math.sin(Date.now() * 0.003)) * 0.2;
      const spawn = this.terrainGrid.getSpawnPoint();
      if (spawn) {
        const tile = this.terrainGrid.getTileAt(spawn.x, spawn.z);
        if (tile) {
          this.spawnMarker.position.y = tile.mesh.position.y + 0.8 + bounce;
        }
      }
      this.spawnMarker.rotation.y += 0.01;
    }

    if (this.exitMarker) {
      const bounce = Math.abs(Math.sin(Date.now() * 0.003 + Math.PI)) * 0.2;
      const exit = this.terrainGrid.getExitPoint();
      if (exit) {
        const tile = this.terrainGrid.getTileAt(exit.x, exit.z);
        if (tile) {
          this.exitMarker.position.y = tile.mesh.position.y + 0.8 + bounce;
        }
      }
      this.exitMarker.rotation.y -= 0.01;
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
