import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { TerrainGrid } from './features/terrain-editor/terrain-grid.class';
import { TerrainType, TERRAIN_CONFIGS } from './models/terrain-types.enum';
import { MapStorageService } from './core/map-storage.service';
import { EditHistoryService, PaintCommand, HeightCommand, SpawnPointCommand, ExitPointCommand, TileState } from './core/edit-history.service';
import { CameraControlService, MovementInput, RotationInput, JoystickInput } from './core/camera-control.service';
import { EditorStateService, EditMode, BrushTool } from './core/editor-state.service';
import { MapBridgeService } from '../../game/game-board/services/map-bridge.service';
import { disposeMaterial } from '../../game/game-board/utils/three-utils';
import { MOBILE_CONFIG } from '../../game/game-board/constants/mobile.constants';
import { JoystickEvent } from './features/mobile-controls';
import {
  EDITOR_SCENE_CONFIG,
  EDITOR_RENDERER_CONFIG,
  EDITOR_POST_PROCESSING,
  EDITOR_LIGHTS,
  EDITOR_SKYBOX,
  EDITOR_PARTICLES,
} from './constants/editor-scene.constants';
import {
  EDITOR_EDIT_THROTTLE_MS,
  EDITOR_BRUSH_INDICATOR,
  EDITOR_BRUSH_PREVIEW,
  EDITOR_RECTANGLE_PREVIEW,
  EDITOR_SPAWN_MARKER,
  EDITOR_EXIT_MARKER,
  EDITOR_ANIMATION,
  EDITOR_HOVER_EMISSIVE,
  EDITOR_FLOOD_FILL_MAX_ITERATIONS,
  EDITOR_PATH_INVALID_FLASH_MS,
  EDITOR_PATH_INVALID_FLASH_COLOR,
  EDITOR_HEIGHT,
} from './constants/editor-ui.constants';
import { PathValidationService, PathValidationResult } from './core/path-validation.service';
import { MapTemplateService } from './core/map-template.service';
import { MapTemplate } from './core/map-template.model';

// Re-export types for template compatibility
export { EditMode, BrushTool } from './core/editor-state.service';

@Component({
  selector: 'app-novarise',
  templateUrl: './novarise.component.html',
  styleUrls: ['./novarise.component.scss']
})
export class NovariseComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;

  // Edit state - delegated to EditorStateService
  public get editMode(): EditMode { return this.editorState.getEditMode(); }
  public get selectedTerrainType(): TerrainType { return this.editorState.getTerrainType(); }
  public get brushSize(): number { return this.editorState.getBrushSize(); }
  public get brushSizes(): number[] { return this.editorState.brushSizes; }
  public get activeTool(): BrushTool { return this.editorState.getActiveTool(); }

  // Camera configuration
  private readonly cameraDistance = 35;
  private readonly cameraFov = 45;

  // Scene objects
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private composer!: EffectComposer;
  private bloomPass?: UnrealBloomPass;
  private vignettePass?: ShaderPass;
  private skybox?: THREE.Mesh;
  private particles: THREE.Points | null = null;

  // Terrain
  private terrainGrid!: TerrainGrid;

  // Interaction
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private hoveredTile: THREE.Mesh | null = null;
  private isMouseDown = false;
  private brushIndicator!: THREE.Mesh;
  private brushPreviewMeshes: THREE.Mesh[] = [];
  private lastEditedTiles = new Set<THREE.Mesh>();
  private lastEditTime = 0;
  private readonly editThrottleMs = EDITOR_EDIT_THROTTLE_MS; // Throttle edits during drag to 20fps max

  // Rectangle selection state
  private rectangleStartTile: THREE.Mesh | null = null;
  private rectanglePreviewMeshes: THREE.Mesh[] = [];

  // Visual markers — arrays for multi-spawn/exit
  private spawnMarkers: THREE.Mesh[] = [];
  private exitMarkers: THREE.Mesh[] = [];

  // Camera movement - delegated to CameraControlService
  private keysPressed = new Set<string>();

  // Mobile joystick state (updated via modular VirtualJoystickComponent events)
  private movementJoystick: JoystickInput = { active: false, x: 0, y: 0 };
  private rotationJoystick: JoystickInput = { active: false, x: 0, y: 0 };

  // Event handlers
  private keyboardHandler: (event: KeyboardEvent) => void;
  private keyUpHandler: (event: KeyboardEvent) => void;
  private mouseDownHandler: (event: MouseEvent) => void;
  private mouseUpHandler: (event: MouseEvent) => void;
  private mousemoveHandler!: (event: MouseEvent) => void;
  private touchStartHandler!: (event: TouchEvent) => void;
  private touchMoveHandler!: (event: TouchEvent) => void;
  private touchEndHandler!: (event: TouchEvent) => void;
  private resizeHandler: () => void = () => {};
  private animationFrameId = 0;

  // Current map tracking - delegated to EditorStateService
  private get currentMapName(): string { return this.editorState.getCurrentMapName(); }
  private set currentMapName(name: string) { this.editorState.setCurrentMapName(name); }

  // Path validation state
  private pathValidationResult: PathValidationResult = { valid: false };
  /** Whether the current map has a valid walkable path from spawn to exit. */
  public get isPathValid(): boolean { return this.pathValidationResult.valid; }
  /** Whether at least one spawn and one exit point have been placed (regardless of path validity). */
  public get hasSpawnAndExit(): boolean {
    if (!this.terrainGrid) return false;
    return this.terrainGrid.getSpawnPoints().length > 0 && this.terrainGrid.getExitPoints().length > 0;
  }

  // Title display
  public title = 'Novarise';

  // Init error state
  public initError: string | null = null;
  public isLoading = true;

  // Map templates
  public templates: MapTemplate[] = [];

  // Undo/Redo state - expose for UI binding
  public get canUndo(): boolean { return this.editHistory.canUndo; }
  public get canRedo(): boolean { return this.editHistory.canRedo; }
  public get undoDescription(): string | null { return this.editHistory.nextUndoDescription; }
  public get redoDescription(): string | null { return this.editHistory.nextRedoDescription; }

  // Track tiles being edited in current stroke for batching
  private currentStrokeTiles: Map<string, TileState> = new Map();
  private currentStrokeNewHeights: Map<string, number> = new Map();
  private isInStroke = false;

  constructor(
    private router: Router,
    private mapStorage: MapStorageService,
    private editHistory: EditHistoryService,
    private cameraControl: CameraControlService,
    private editorState: EditorStateService,
    private mapBridge: MapBridgeService,
    private pathValidation: PathValidationService,
    private mapTemplateService: MapTemplateService
  ) {
    this.keyboardHandler = this.handleKeyDown.bind(this);
    this.keyUpHandler = this.handleKeyUp.bind(this);
    this.mouseDownHandler = this.handleMouseDown.bind(this);
    this.mouseUpHandler = this.handleMouseUp.bind(this);
  }

  ngAfterViewInit(): void {
    try {
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

      // Initialize brush preview system
      this.updateBrushPreview();

      // Create spawn/exit markers for tower defense
      this.createSpawnExitMarkers();

      // Initialize camera rotation to match initial camera view
      this.initializeCameraRotation();

      // Load map templates for the editor UI
      this.templates = this.mapTemplateService.getTemplates();

      // Try to migrate old format and load current map
      this.mapStorage.migrateOldFormat();
      this.tryLoadCurrentMap();

      this.setupInteraction();
      this.setupKeyboardControls();
      this.animate();
      this.isLoading = false;
    } catch (error) {
      this.initError = error instanceof Error
        ? error.message
        : 'Failed to initialize editor renderer';
      this.isLoading = false;
      console.error('Editor initialization failed:', error);
    }
  }

  private initializeScene(): void {
    this.scene = new THREE.Scene();
    // Lighter background for better visibility
    this.scene.background = new THREE.Color(EDITOR_SCENE_CONFIG.backgroundColor);
    // Reduce fog for better visibility
    this.scene.fog = new THREE.FogExp2(EDITOR_SCENE_CONFIG.fogColor, EDITOR_SCENE_CONFIG.fogDensity);
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
    // Initialize camera control service from current camera state
    this.cameraControl.initializeFromCamera(this.camera, new THREE.Vector3(0, 0, 0));
  }

  private initializeRenderer(): void {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    if (!gl) {
      throw new Error('WebGL is not supported by your browser');
    }
    // Release the test WebGL context to free the browser context slot
    (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    const mobileMaxRatio = window.innerWidth <= MOBILE_CONFIG.breakpoint ? MOBILE_CONFIG.maxPixelRatio : EDITOR_RENDERER_CONFIG.maxPixelRatio;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobileMaxRatio));

    // Initial size using proper viewport calculation
    const { width, height } = this.getViewportSize();
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = EDITOR_RENDERER_CONFIG.toneMappingExposure; // Increased from 1.2 for brightness
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.canvasContainer.nativeElement.appendChild(this.renderer.domElement);

    // Handle resize with proper viewport calculations
    this.resizeHandler = () => {
      const { width, height } = this.getViewportSize();
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      if (this.composer) {
        this.composer.setSize(width, height);
      }
    };

    window.addEventListener('resize', this.resizeHandler);

    // Also listen to visualViewport for mobile browser chrome changes
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.resizeHandler);
    }
  }

  /**
   * Get accurate viewport size accounting for mobile browser chrome
   */
  private getViewportSize(): { width: number; height: number } {
    // Use visualViewport for accurate mobile sizing (accounts for browser chrome)
    if (window.visualViewport) {
      return {
        width: window.visualViewport.width,
        height: window.visualViewport.height
      };
    }
    // Fallback to innerWidth/innerHeight
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  private initializePostProcessing(): void {
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Skip bloom on phones — too expensive for low-end GPUs
    const { width, height } = this.getViewportSize();
    if (window.innerWidth > MOBILE_CONFIG.phoneBreakpoint) {
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        EDITOR_POST_PROCESSING.bloom.strength,
        EDITOR_POST_PROCESSING.bloom.radius,
        EDITOR_POST_PROCESSING.bloom.threshold
      );
      this.composer.addPass(this.bloomPass);
    }

    // Lighter vignette for better edge visibility
    const vignetteShader = {
      uniforms: {
        tDiffuse: { value: null },
        offset: { value: EDITOR_POST_PROCESSING.vignette.offset },    // Increased offset = less vignette
        darkness: { value: EDITOR_POST_PROCESSING.vignette.darkness } // Reduced darkness
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
    // EXTREMELY BRIGHT ambient light for maximum visibility
    const ambientLight = new THREE.AmbientLight(
      EDITOR_LIGHTS.ambient.color,
      EDITOR_LIGHTS.ambient.intensity
    );
    this.scene.add(ambientLight);

    // Multiple strong directional lights for even coverage
    const [dl1Cfg, dl2Cfg, dl3Cfg, dl4Cfg] = EDITOR_LIGHTS.directional;

    const directionalLight1 = new THREE.DirectionalLight(dl1Cfg.color, dl1Cfg.intensity);
    directionalLight1.position.set(...dl1Cfg.position);
    directionalLight1.castShadow = true;
    directionalLight1.shadow.camera.left = -dl1Cfg.shadowCameraExtent!;
    directionalLight1.shadow.camera.right = dl1Cfg.shadowCameraExtent!;
    directionalLight1.shadow.camera.top = dl1Cfg.shadowCameraExtent!;
    directionalLight1.shadow.camera.bottom = -dl1Cfg.shadowCameraExtent!;
    directionalLight1.shadow.mapSize.width = dl1Cfg.shadowMapSize!;
    directionalLight1.shadow.mapSize.height = dl1Cfg.shadowMapSize!;
    if (window.innerWidth <= MOBILE_CONFIG.breakpoint) {
      directionalLight1.shadow.mapSize.width = Math.min(directionalLight1.shadow.mapSize.width, MOBILE_CONFIG.maxShadowMapSize);
      directionalLight1.shadow.mapSize.height = Math.min(directionalLight1.shadow.mapSize.height, MOBILE_CONFIG.maxShadowMapSize);
    }
    this.scene.add(directionalLight1);

    // Second directional light from opposite angle
    const directionalLight2 = new THREE.DirectionalLight(dl2Cfg.color, dl2Cfg.intensity);
    directionalLight2.position.set(...dl2Cfg.position);
    this.scene.add(directionalLight2);

    // Third directional light from side
    const directionalLight3 = new THREE.DirectionalLight(dl3Cfg.color, dl3Cfg.intensity);
    directionalLight3.position.set(...dl3Cfg.position);
    this.scene.add(directionalLight3);

    // Fourth directional light from opposite side
    const directionalLight4 = new THREE.DirectionalLight(dl4Cfg.color, dl4Cfg.intensity);
    directionalLight4.position.set(...dl4Cfg.position);
    this.scene.add(directionalLight4);

    // Bright light from below for complete visibility
    const blCfg = EDITOR_LIGHTS.bottomLight;
    const bottomLight = new THREE.DirectionalLight(blCfg.color, blCfg.intensity);
    bottomLight.position.set(...blCfg.position);
    bottomLight.lookAt(0, 0, 0);
    this.scene.add(bottomLight);

    // Hemisphere light for natural fill
    const hemiLight = new THREE.HemisphereLight(
      EDITOR_LIGHTS.hemisphere.skyColor,
      EDITOR_LIGHTS.hemisphere.groundColor,
      EDITOR_LIGHTS.hemisphere.intensity
    );
    this.scene.add(hemiLight);

    // Point lights for extra brightness at key positions
    for (const cfg of EDITOR_LIGHTS.point) {
      const pl = new THREE.PointLight(cfg.color, cfg.intensity, cfg.distance);
      pl.position.set(...cfg.position);
      this.scene.add(pl);
    }
  }

  private addSkybox(): void {
    const starfieldGeometry = new THREE.SphereGeometry(EDITOR_SKYBOX.radius, EDITOR_SKYBOX.widthSegments, EDITOR_SKYBOX.heightSegments);
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

    this.skybox = new THREE.Mesh(starfieldGeometry, starfieldMaterial);
    this.scene.add(this.skybox);
  }

  private initializeParticles(): void {
    const particleCount = window.innerWidth <= MOBILE_CONFIG.breakpoint
      ? Math.floor(EDITOR_PARTICLES.count / MOBILE_CONFIG.particleDivisor)
      : EDITOR_PARTICLES.count;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * EDITOR_PARTICLES.positionRange;
      positions[i * 3 + 1] = Math.random() * EDITOR_PARTICLES.positionYRange + EDITOR_PARTICLES.positionYMin;
      positions[i * 3 + 2] = (Math.random() - 0.5) * EDITOR_PARTICLES.positionRange;

      const colorChoice = Math.random();
      let rgb: [number, number, number];
      if (colorChoice < EDITOR_PARTICLES.colorThresholds.blue) {
        rgb = EDITOR_PARTICLES.colors.blue;
      } else if (colorChoice < EDITOR_PARTICLES.colorThresholds.purple) {
        rgb = EDITOR_PARTICLES.colors.purple;
      } else {
        rgb = EDITOR_PARTICLES.colors.teal;
      }
      colors[i * 3] = rgb[0]; colors[i * 3 + 1] = rgb[1]; colors[i * 3 + 2] = rgb[2];
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: EDITOR_PARTICLES.size,
      vertexColors: true,
      transparent: true,
      opacity: EDITOR_PARTICLES.opacity,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(this.particles);
  }

  private initializeControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // Disable mouse rotation and pan - mouse is for terrain editing
    this.controls.enableRotate = false;
    this.controls.enablePan = false;

    // Enable zoom with mouse wheel
    this.controls.enableZoom = true;
    this.controls.zoomSpeed = 1.0;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 80;

    // Disable damping - we handle our own smoothing for keyboard
    this.controls.enableDamping = false;

    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private setupInteraction(): void {
    const canvas = this.renderer.domElement;

    this.mousemoveHandler = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.camera.updateMatrixWorld();
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const tileMeshes = this.terrainGrid.getTileMeshes();
      const intersects = this.raycaster.intersectObjects(tileMeshes);

      // Reset previous hover with crisp transition
      if (this.hoveredTile && !this.lastEditedTiles.has(this.hoveredTile)) {
        const material = this.hoveredTile.material as THREE.MeshStandardMaterial;
        // Reset to original terrain emissive intensity from config
        const x = this.hoveredTile.userData['gridX'];
        const z = this.hoveredTile.userData['gridZ'];
        if (typeof x === 'number' && typeof z === 'number') {
          const tile = this.terrainGrid.getTileAt(x, z);
          if (tile) {
            const config = TERRAIN_CONFIGS[tile.type];
            material.emissiveIntensity = config.emissiveIntensity;
          }
        }
      }

      if (intersects.length > 0) {
        this.hoveredTile = intersects[0].object as THREE.Mesh;
        const material = this.hoveredTile.material as THREE.MeshStandardMaterial;

        // Crisp, bright hover state for clear feedback
        material.emissiveIntensity = EDITOR_HOVER_EMISSIVE.hover;

        // Position brush indicator at tile location
        this.brushIndicator.position.copy(this.hoveredTile.position);
        this.brushIndicator.position.y = this.hoveredTile.position.y + EDITOR_BRUSH_INDICATOR.yOffset;
        this.brushIndicator.visible = true;

        // Update brush color and cursor from centralized EditorStateService
        const brushMaterial = this.brushIndicator.material as THREE.MeshBasicMaterial;
        brushMaterial.color.setHex(this.editorState.getColorForMode());
        canvas.style.cursor = this.editorState.getCursorForMode();

        // Update brush preview meshes (only for brush tool)
        if (this.activeTool === 'brush') {
          this.updateBrushPreviewPositions();
        } else {
          this.hideBrushPreview();
        }

        // Apply edit if mouse is down (with throttling for performance)
        if (this.isMouseDown) {
          // Rectangle tool: update preview
          if (this.activeTool === 'rectangle' && this.rectangleStartTile) {
            this.updateRectanglePreview(this.rectangleStartTile, this.hoveredTile);
          } else {
            // Other tools: apply edit with throttling
            const now = Date.now();
            if (now - this.lastEditTime >= this.editThrottleMs) {
              this.applyEdit(this.hoveredTile);
              this.lastEditTime = now;
            }
          }
        }
      } else {
        this.hoveredTile = null;
        this.brushIndicator.visible = false;
        this.hideBrushPreview();
        canvas.style.cursor = 'default';
      }
    };
    canvas.addEventListener('mousemove', this.mousemoveHandler);

    canvas.addEventListener('mousedown', this.mouseDownHandler);
    canvas.addEventListener('mouseup', this.mouseUpHandler);
    canvas.addEventListener('mouseleave', this.mouseUpHandler);

    // Touch event support for mobile — stored as named refs for cleanup
    this.touchStartHandler = (event: TouchEvent) => {
      event.preventDefault();
      const touch = event.touches[0];
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

      this.camera.updateMatrixWorld();
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const tileMeshes = this.terrainGrid.getTileMeshes();
      const intersects = this.raycaster.intersectObjects(tileMeshes);

      if (intersects.length > 0) {
        this.hoveredTile = intersects[0].object as THREE.Mesh;
        this.handleMouseDown({ button: 0 } as MouseEvent);
      }
    };

    this.touchMoveHandler = (event: TouchEvent) => {
      event.preventDefault();
      const touch = event.touches[0];
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

      this.camera.updateMatrixWorld();
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const tileMeshes = this.terrainGrid.getTileMeshes();
      const intersects = this.raycaster.intersectObjects(tileMeshes);

      if (intersects.length > 0) {
        this.hoveredTile = intersects[0].object as THREE.Mesh;

        if (this.isMouseDown) {
          if (this.activeTool === 'rectangle' && this.rectangleStartTile) {
            this.updateRectanglePreview(this.rectangleStartTile, this.hoveredTile);
          } else {
            const now = Date.now();
            if (now - this.lastEditTime >= this.editThrottleMs) {
              this.applyEdit(this.hoveredTile);
              this.lastEditTime = now;
            }
          }
        }
      }
    };

    this.touchEndHandler = (event: TouchEvent) => {
      event.preventDefault();
      this.handleMouseUp();
    };

    canvas.addEventListener('touchstart', this.touchStartHandler);
    canvas.addEventListener('touchmove', this.touchMoveHandler);
    canvas.addEventListener('touchend', this.touchEndHandler);
    canvas.addEventListener('touchcancel', this.touchEndHandler);
  }

  private handleMouseDown(event: MouseEvent): void {
    if (event.button === 0) { // Left click
      this.isMouseDown = true;

      // Start tracking stroke for undo/redo (brush tool with paint/height mode)
      if (this.activeTool === 'brush' && (this.editMode === 'paint' || this.editMode === 'height')) {
        this.startStroke();
      }

      if (this.hoveredTile) {
        // Rectangle tool: set start point
        if (this.activeTool === 'rectangle') {
          this.rectangleStartTile = this.hoveredTile;
        } else {
          // Other tools: apply immediately
          this.applyEdit(this.hoveredTile);
        }
      }
    }
  }

  private handleMouseUp(): void {
    this.isMouseDown = false;

    // End stroke and record command for undo/redo
    if (this.isInStroke) {
      this.endStroke();
    }

    // Rectangle tool: complete selection
    if (this.activeTool === 'rectangle' && this.rectangleStartTile && this.hoveredTile) {
      this.fillRectangle(this.rectangleStartTile, this.hoveredTile);
    }

    this.rectangleStartTile = null;
  }

  private startStroke(): void {
    this.isInStroke = true;
    this.currentStrokeTiles.clear();
    this.currentStrokeNewHeights.clear();
  }

  private endStroke(): void {
    this.isInStroke = false;

    // Record command based on edit mode
    if (this.editMode === 'paint' && this.currentStrokeTiles.size > 0) {
      const tiles = Array.from(this.currentStrokeTiles.values());
      const command = new PaintCommand(
        tiles,
        this.selectedTerrainType,
        (x, z, type) => this.terrainGrid.paintTile(x, z, type)
      );
      this.editHistory.record(command);
      this.runPathValidation();
    } else if (this.editMode === 'height' && this.currentStrokeTiles.size > 0) {
      const tiles = Array.from(this.currentStrokeTiles.values());
      const command = new HeightCommand(
        tiles,
        new Map(this.currentStrokeNewHeights),
        (x, z, height) => this.terrainGrid.setHeight(x, z, height)
      );
      this.editHistory.record(command);
    }

    this.currentStrokeTiles.clear();
    this.currentStrokeNewHeights.clear();
  }

  private applyEdit(mesh: THREE.Mesh): void {
    // Handle different tools
    if (this.activeTool === 'fill') {
      this.floodFill(mesh);
      return;
    }

    if (this.activeTool === 'rectangle') {
      // Rectangle tool is handled in mouse handlers
      return;
    }

    // Regular brush tool with multi-tile support
    const affectedTiles = this.getAffectedTiles(mesh);

    affectedTiles.forEach(tileMesh => {
      const x = tileMesh.userData['gridX'];
      const z = tileMesh.userData['gridZ'];

      if (this.editMode === 'paint') {
        // Track tile state before painting for undo
        this.trackTileForUndo(x, z);
        this.terrainGrid.paintTile(x, z, this.selectedTerrainType);
        this.flashTileEdit(tileMesh);
      } else if (this.editMode === 'height') {
        // Track tile state before height change for undo
        this.trackTileForUndo(x, z);
        this.terrainGrid.adjustHeight(x, z, EDITOR_HEIGHT.stepSize);
        const tile = this.terrainGrid.getTileAt(x, z);
        if (tile) {
          // Track new height after change
          const key = `${x},${z}`;
          this.currentStrokeNewHeights.set(key, tile.height);
          this.flashTileEdit(tile.mesh);
        }
      } else if (this.editMode === 'spawn') {
        // Reject placement on non-walkable terrain
        const tile = this.terrainGrid.getTileAt(x, z);
        if (!tile || tile.type === TerrainType.CRYSTAL || tile.type === TerrainType.ABYSS) {
          if (this.spawnMarkers.length > 0) this.flashMarkerRejection(this.spawnMarkers[0]);
          return;
        }
        // Reject placement on same tile as any exit
        const exitPoints = this.terrainGrid.getExitPoints();
        if (exitPoints.some(ep => ep.x === x && ep.z === z)) {
          if (this.spawnMarkers.length > 0) this.flashMarkerRejection(this.spawnMarkers[0]);
          return;
        }
        // Snapshot full spawn array before toggle for undo
        const previousSpawns = this.terrainGrid.getSpawnPoints().map(p => ({ ...p }));
        this.terrainGrid.addSpawnPoint(x, z);
        this.updateSpawnMarkers();
        this.flashTileEdit(tileMesh);
        // Record command immediately (not part of stroke)
        const command = new SpawnPointCommand(
          previousSpawns,
          { x, z },
          (points) => {
            this.terrainGrid.setSpawnPoints(points);
            this.updateSpawnMarkers();
          },
          (sx, sz) => {
            this.terrainGrid.addSpawnPoint(sx, sz);
            this.updateSpawnMarkers();
          }
        );
        this.editHistory.record(command);
        this.runPathValidation();
      } else if (this.editMode === 'exit') {
        // Reject placement on non-walkable terrain
        const tile = this.terrainGrid.getTileAt(x, z);
        if (!tile || tile.type === TerrainType.CRYSTAL || tile.type === TerrainType.ABYSS) {
          if (this.exitMarkers.length > 0) this.flashMarkerRejection(this.exitMarkers[0]);
          return;
        }
        // Reject placement on same tile as any spawn
        const spawnPoints = this.terrainGrid.getSpawnPoints();
        if (spawnPoints.some(sp => sp.x === x && sp.z === z)) {
          if (this.exitMarkers.length > 0) this.flashMarkerRejection(this.exitMarkers[0]);
          return;
        }
        // Snapshot full exit array before toggle for undo
        const previousExits = this.terrainGrid.getExitPoints().map(p => ({ ...p }));
        this.terrainGrid.addExitPoint(x, z);
        this.updateExitMarkers();
        this.flashTileEdit(tileMesh);
        // Record command immediately (not part of stroke)
        const command = new ExitPointCommand(
          previousExits,
          { x, z },
          (points) => {
            this.terrainGrid.setExitPoints(points);
            this.updateExitMarkers();
          },
          (ex, ez) => {
            this.terrainGrid.addExitPoint(ex, ez);
            this.updateExitMarkers();
          }
        );
        this.editHistory.record(command);
        this.runPathValidation();
      }
    });
  }

  /**
   * Track a tile's current state before making changes (for undo)
   */
  private trackTileForUndo(x: number, z: number): void {
    const key = `${x},${z}`;
    // Only track first state (before any changes in this stroke)
    if (!this.currentStrokeTiles.has(key)) {
      const tile = this.terrainGrid.getTileAt(x, z);
      if (tile) {
        this.currentStrokeTiles.set(key, {
          x,
          z,
          type: tile.type,
          height: tile.height
        });
      }
    }
  }

  private flashTileEdit(mesh: THREE.Mesh): void {
    // Crisp flash animation for immediate feedback
    const material = mesh.material as THREE.MeshStandardMaterial;

    // Get original intensity from terrain config
    const x = mesh.userData['gridX'];
    const z = mesh.userData['gridZ'];
    let originalIntensity: number = EDITOR_HOVER_EMISSIVE.defaultFallback; // Default fallback

    if (typeof x === 'number' && typeof z === 'number') {
      const tile = this.terrainGrid.getTileAt(x, z);
      if (tile) {
        const config = TERRAIN_CONFIGS[tile.type];
        originalIntensity = config.emissiveIntensity;
      }
    }

    // Add to edited tiles set
    this.lastEditedTiles.add(mesh);

    // Instant bright flash
    material.emissiveIntensity = EDITOR_HOVER_EMISSIVE.flashPeak;

    // Quick fade back for crisp feel
    setTimeout(() => {
      material.emissiveIntensity = EDITOR_HOVER_EMISSIVE.flashMid; // Hover state
      setTimeout(() => {
        this.lastEditedTiles.delete(mesh);
        if (this.hoveredTile !== mesh) {
          material.emissiveIntensity = originalIntensity;
        }
      }, EDITOR_HOVER_EMISSIVE.flashFadeBackMs);
    }, EDITOR_HOVER_EMISSIVE.flashFadeDelayMs);
  }

  /**
   * Flash a marker red briefly to signal a rejected spawn/exit placement.
   */
  private flashMarkerRejection(marker: THREE.Mesh): void {
    const material = marker.material as THREE.MeshBasicMaterial;
    const originalColor = material.color.getHex();
    material.color.setHex(EDITOR_PATH_INVALID_FLASH_COLOR);
    setTimeout(() => {
      material.color.setHex(originalColor);
    }, EDITOR_PATH_INVALID_FLASH_MS);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();

    // Ignore all keyboard handling when focus is on an interactive form element
    const tag = (event.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    this.keysPressed.add(key);

    // Undo/Redo shortcuts (Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z)
    if (event.ctrlKey || event.metaKey) {
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        this.undo();
        return;
      }
      if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        this.redo();
        return;
      }
      // Export map (Ctrl+E)
      if (key === 'e') {
        event.preventDefault();
        this.exportCurrentMap();
        return;
      }
      // Import map (Ctrl+O for "Open")
      if (key === 'o') {
        event.preventDefault();
        this.importMapFromFile();
        return;
      }
    }

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
      case 'p':
        this.setEditMode('spawn');
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
      case '[':
        this.cycleBrushSize(-1);
        break;
      case ']':
        this.cycleBrushSize(1);
        break;
      case 'f':
        this.changeActiveTool('fill');
        break;
      case 'r':
        this.changeActiveTool('rectangle');
        break;
      case 'b':
        this.changeActiveTool('brush');
        break;
      case 'enter':
        this.playMap();
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
    // Build movement input from keyboard state
    const movementInput: MovementInput = {
      forward: this.keysPressed.has('w'),
      backward: this.keysPressed.has('s'),
      left: this.keysPressed.has('a'),
      right: this.keysPressed.has('d'),
      up: this.keysPressed.has('e'),
      down: this.keysPressed.has('q'),
      fast: this.keysPressed.has('shift')
    };

    // Build rotation input from arrow keys
    const rotationInput: RotationInput = {
      left: this.keysPressed.has('arrowleft'),
      right: this.keysPressed.has('arrowright'),
      up: this.keysPressed.has('arrowup'),
      down: this.keysPressed.has('arrowdown')
    };

    // Update camera control service
    this.cameraControl.update(movementInput, rotationInput, this.movementJoystick, this.rotationJoystick);

    // Apply camera state to Three.js camera and controls
    this.cameraControl.applyToCamera(this.camera, this.controls?.target);
  }

  private addHelpers(): void {
    // Don't add THREE.js GridHelper - we have custom grid lines that match tiles perfectly
    // The custom grid lines are added by TerrainGrid and aligned to actual tile positions
  }

  private createBrushIndicator(): void {
    // Create a ring to show brush area - crisp and clear
    const geometry = new THREE.RingGeometry(
      EDITOR_BRUSH_INDICATOR.innerRadius,
      EDITOR_BRUSH_INDICATOR.outerRadius,
      EDITOR_BRUSH_INDICATOR.segments
    );
    const material = new THREE.MeshBasicMaterial({
      color: EDITOR_BRUSH_INDICATOR.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: EDITOR_BRUSH_INDICATOR.opacity,
      depthTest: false
    });
    this.brushIndicator = new THREE.Mesh(geometry, material);
    this.brushIndicator.rotation.x = -Math.PI / 2;
    this.brushIndicator.visible = false;
    this.brushIndicator.renderOrder = 1000; // Always render on top
    this.scene.add(this.brushIndicator);
  }

  private createSpawnExitMarkers(): void {
    // Initial markers are created by updateSpawnMarkers/updateExitMarkers
    this.updateSpawnMarkers();
    this.updateExitMarkers();
  }

  private createSpawnMarkerMesh(): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(
      EDITOR_SPAWN_MARKER.radiusTop,
      EDITOR_SPAWN_MARKER.radiusBottom,
      EDITOR_SPAWN_MARKER.height,
      EDITOR_SPAWN_MARKER.radialSegments
    );
    const material = new THREE.MeshBasicMaterial({
      color: EDITOR_SPAWN_MARKER.color,
      transparent: true,
      opacity: EDITOR_SPAWN_MARKER.opacity
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 999;
    return mesh;
  }

  private createExitMarkerMesh(): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(
      EDITOR_EXIT_MARKER.radiusTop,
      EDITOR_EXIT_MARKER.radiusBottom,
      EDITOR_EXIT_MARKER.height,
      EDITOR_EXIT_MARKER.radialSegments
    );
    const material = new THREE.MeshBasicMaterial({
      color: EDITOR_EXIT_MARKER.color,
      transparent: true,
      opacity: EDITOR_EXIT_MARKER.opacity
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 999;
    return mesh;
  }

  /** Sync spawn marker meshes with the terrainGrid's spawnPoints array. */
  private updateSpawnMarkers(): void {
    const points = this.terrainGrid.getSpawnPoints();

    // Remove excess markers
    while (this.spawnMarkers.length > points.length) {
      const marker = this.spawnMarkers.pop()!;
      this.scene.remove(marker);
      marker.geometry.dispose();
      disposeMaterial(marker.material);
    }

    // Add missing markers
    while (this.spawnMarkers.length < points.length) {
      const marker = this.createSpawnMarkerMesh();
      this.spawnMarkers.push(marker);
      this.scene.add(marker);
    }

    // Position all markers
    for (let i = 0; i < points.length; i++) {
      const tile = this.terrainGrid.getTileAt(points[i].x, points[i].z);
      if (tile) {
        this.spawnMarkers[i].position.copy(tile.mesh.position);
        this.spawnMarkers[i].position.y += EDITOR_SPAWN_MARKER.yBase;
        this.spawnMarkers[i].visible = true;
      }
    }
  }

  /** Sync exit marker meshes with the terrainGrid's exitPoints array. */
  private updateExitMarkers(): void {
    const points = this.terrainGrid.getExitPoints();

    // Remove excess markers
    while (this.exitMarkers.length > points.length) {
      const marker = this.exitMarkers.pop()!;
      this.scene.remove(marker);
      marker.geometry.dispose();
      disposeMaterial(marker.material);
    }

    // Add missing markers
    while (this.exitMarkers.length < points.length) {
      const marker = this.createExitMarkerMesh();
      this.exitMarkers.push(marker);
      this.scene.add(marker);
    }

    // Position all markers
    for (let i = 0; i < points.length; i++) {
      const tile = this.terrainGrid.getTileAt(points[i].x, points[i].z);
      if (tile) {
        this.exitMarkers[i].position.copy(tile.mesh.position);
        this.exitMarkers[i].position.y += EDITOR_EXIT_MARKER.yBase;
        this.exitMarkers[i].visible = true;
      }
    }
  }

  /** @deprecated Backward-compatible alias — calls updateSpawnMarkers(). */
  private updateSpawnMarker(): void {
    this.updateSpawnMarkers();
  }

  /** @deprecated Backward-compatible alias — calls updateExitMarkers(). */
  private updateExitMarker(): void {
    this.updateExitMarkers();
  }

  private saveGridState(): void {
    // Get current map name or prompt for new one
    const mapName = prompt('Enter map name:', this.currentMapName);
    if (!mapName) return; // User cancelled

    const state = this.terrainGrid.exportState();
    const currentId = this.mapStorage.getCurrentMapId();

    // Save (will update if ID exists, create new if not)
    const savedId = this.mapStorage.saveMap(mapName, state, currentId || undefined);
    if (!savedId) {
      alert('Failed to save map — storage may be full. Try deleting unused maps.');
      return;
    }
    this.currentMapName = mapName;

    alert(`Map "${mapName}" saved successfully!`);
  }

  private loadGridState(): void {
    const maps = this.mapStorage.getAllMaps();

    if (maps.length === 0) {
      alert('No saved maps found.');
      return;
    }

    // Build a simple list for user selection
    let message = 'Select a map to load:\n\n';
    maps.forEach((map, index) => {
      const date = new Date(map.updatedAt).toLocaleString();
      message += `${index + 1}. ${map.name} (${date})\n`;
    });

    const selection = prompt(message + '\nEnter number:');
    if (!selection) return; // User cancelled

    const index = parseInt(selection) - 1;
    if (index < 0 || index >= maps.length) {
      alert('Invalid selection.');
      return;
    }

    const selectedMap = maps[index];
    const state = this.mapStorage.loadMap(selectedMap.id);

    if (state) {
      this.terrainGrid.importState(state);
      this.updateSpawnMarker();
      this.updateExitMarker();
      this.runPathValidation();
      this.currentMapName = selectedMap.name;
      alert(`Map "${selectedMap.name}" loaded successfully!`);
    } else {
      alert('Failed to load map.');
    }
  }

  private tryLoadCurrentMap(): void {
    const state = this.mapStorage.loadCurrentMap();
    if (state) {
      this.terrainGrid.importState(state);
      this.updateSpawnMarker();
      this.updateExitMarker();
      this.runPathValidation();

      const currentId = this.mapStorage.getCurrentMapId();
      if (currentId) {
        const metadata = this.mapStorage.getMapMetadata(currentId);
        if (metadata) {
          this.currentMapName = metadata.name;
        }
      }
    }
  }

  public loadTemplate(templateId: string): void {
    if (this.editHistory.canUndo && !confirm('Load template? Unsaved changes will be lost.')) return;
    const state = this.mapTemplateService.loadTemplate(templateId);
    if (!state) return;
    this.terrainGrid.importState(state);
    this.updateSpawnMarker();
    this.updateExitMarker();
    this.runPathValidation();
    this.editHistory.clear();
    this.mapStorage.clearCurrentMapId();
    this.currentMapName = '';
  }

  private cycleBrushSize(direction: number): void {
    this.editorState.cycleBrushSize(direction);
    this.updateBrushPreview();
  }

  private changeActiveTool(tool: BrushTool): void {
    this.editorState.setActiveTool(tool);

    // Reset rectangle selection when switching tools
    if (tool !== 'rectangle') {
      this.rectangleStartTile = null;
      this.clearRectanglePreview();
    }

    // Hide brush previews when switching away from brush tool
    if (tool !== 'brush') {
      this.hideBrushPreview();
    }
  }

  private updateBrushPreview(): void {
    // Clear existing preview meshes
    this.brushPreviewMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      disposeMaterial(mesh.material);
    });
    this.brushPreviewMeshes = [];

    // Create new preview meshes for current brush size
    if (this.brushSize > 1) {
      const halfSize = Math.floor(this.brushSize / 2);
      for (let dx = -halfSize; dx <= halfSize; dx++) {
        for (let dz = -halfSize; dz <= halfSize; dz++) {
          if (dx === 0 && dz === 0) continue; // Skip center (main brush indicator shows it)

          const geometry = new THREE.RingGeometry(
            EDITOR_BRUSH_PREVIEW.innerRadius,
            EDITOR_BRUSH_PREVIEW.outerRadius,
            EDITOR_BRUSH_PREVIEW.segments
          );
          const material = new THREE.MeshBasicMaterial({
            color: EDITOR_BRUSH_PREVIEW.color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: EDITOR_BRUSH_PREVIEW.opacity,
            depthTest: false
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.rotation.x = -Math.PI / 2;
          mesh.visible = false;
          mesh.renderOrder = 999;
          mesh.userData = { offsetX: dx, offsetZ: dz };
          this.scene.add(mesh);
          this.brushPreviewMeshes.push(mesh);
        }
      }
    }
  }

  private updateBrushPreviewPositions(): void {
    if (!this.hoveredTile) {
      this.hideBrushPreview();
      return;
    }

    // Validate userData exists
    if (!this.hoveredTile.userData ||
        typeof this.hoveredTile.userData['gridX'] !== 'number' ||
        typeof this.hoveredTile.userData['gridZ'] !== 'number') {
      this.hideBrushPreview();
      return;
    }

    const centerX = this.hoveredTile.userData['gridX'];
    const centerZ = this.hoveredTile.userData['gridZ'];

    this.brushPreviewMeshes.forEach(mesh => {
      const offsetX = mesh.userData['offsetX'];
      const offsetZ = mesh.userData['offsetZ'];
      const tile = this.terrainGrid.getTileAt(centerX + offsetX, centerZ + offsetZ);

      if (tile) {
        mesh.position.copy(tile.mesh.position);
        mesh.position.y = tile.mesh.position.y + EDITOR_BRUSH_PREVIEW.yOffset;
        mesh.visible = true;
      } else {
        mesh.visible = false;
      }
    });
  }

  private hideBrushPreview(): void {
    this.brushPreviewMeshes.forEach(mesh => {
      mesh.visible = false;
    });
  }

  private getAffectedTiles(centerTile: THREE.Mesh): THREE.Mesh[] {
    const tiles: THREE.Mesh[] = [centerTile];

    if (this.brushSize === 1) return tiles;

    // Validate userData exists
    if (!centerTile.userData ||
        typeof centerTile.userData['gridX'] !== 'number' ||
        typeof centerTile.userData['gridZ'] !== 'number') {
      return tiles;
    }

    const centerX = centerTile.userData['gridX'];
    const centerZ = centerTile.userData['gridZ'];
    const halfSize = Math.floor(this.brushSize / 2);

    for (let dx = -halfSize; dx <= halfSize; dx++) {
      for (let dz = -halfSize; dz <= halfSize; dz++) {
        if (dx === 0 && dz === 0) continue;

        const tile = this.terrainGrid.getTileAt(centerX + dx, centerZ + dz);
        if (tile) {
          tiles.push(tile.mesh);
        }
      }
    }

    return tiles;
  }

  private floodFill(startTile: THREE.Mesh): void {
    // Validate userData exists
    if (!startTile.userData ||
        typeof startTile.userData['gridX'] !== 'number' ||
        typeof startTile.userData['gridZ'] !== 'number') {
      return;
    }

    const startX = startTile.userData['gridX'];
    const startZ = startTile.userData['gridZ'];
    const startTileData = this.terrainGrid.getTileAt(startX, startZ);

    if (!startTileData) return;

    const targetType = startTileData.type;
    const replacementType = this.selectedTerrainType;

    // Don't fill if same type
    if (targetType === replacementType) return;

    // Track tiles for undo
    const affectedTiles: TileState[] = [];

    const visited = new Set<string>();
    const queue: [number, number][] = [[startX, startZ]];
    const maxIterations = EDITOR_FLOOD_FILL_MAX_ITERATIONS; // Max 25x25 grid
    let iterations = 0;

    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;
      const [x, z] = queue.shift()!;
      const key = `${x},${z}`;

      if (visited.has(key)) continue;
      visited.add(key);

      const tile = this.terrainGrid.getTileAt(x, z);
      if (!tile || tile.type !== targetType) continue;

      // Track tile state before change
      affectedTiles.push({
        x, z,
        type: tile.type,
        height: tile.height
      });

      // Paint this tile
      if (this.editMode === 'paint') {
        this.terrainGrid.paintTile(x, z, replacementType);
        this.flashTileEdit(tile.mesh);
      }

      // Add neighbors to queue
      const neighbors = [
        [x - 1, z], [x + 1, z],
        [x, z - 1], [x, z + 1]
      ];

      neighbors.forEach(([nx, nz]) => {
        if (!visited.has(`${nx},${nz}`)) {
          queue.push([nx, nz]);
        }
      });
    }

    // Record command for undo
    if (affectedTiles.length > 0) {
      const command = new PaintCommand(
        affectedTiles,
        replacementType,
        (x, z, type) => this.terrainGrid.paintTile(x, z, type)
      );
      this.editHistory.record(command);
      this.runPathValidation();
    }
  }

  private fillRectangle(startTile: THREE.Mesh, endTile: THREE.Mesh): void {
    // Validate userData exists for both tiles
    if (!startTile.userData || !endTile.userData ||
        typeof startTile.userData['gridX'] !== 'number' ||
        typeof startTile.userData['gridZ'] !== 'number' ||
        typeof endTile.userData['gridX'] !== 'number' ||
        typeof endTile.userData['gridZ'] !== 'number') {
      this.clearRectanglePreview();
      this.rectangleStartTile = null;
      return;
    }

    const x1 = startTile.userData['gridX'];
    const z1 = startTile.userData['gridZ'];
    const x2 = endTile.userData['gridX'];
    const z2 = endTile.userData['gridZ'];

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minZ = Math.min(z1, z2);
    const maxZ = Math.max(z1, z2);

    // Track tiles for undo
    const affectedTiles: TileState[] = [];
    const newHeights = new Map<string, number>();

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const tile = this.terrainGrid.getTileAt(x, z);
        if (tile) {
          // Track tile state before change
          affectedTiles.push({
            x, z,
            type: tile.type,
            height: tile.height
          });

          if (this.editMode === 'paint') {
            this.terrainGrid.paintTile(x, z, this.selectedTerrainType);
          } else if (this.editMode === 'height') {
            this.terrainGrid.adjustHeight(x, z, 0.2);
            // Track new height after change
            const updatedTile = this.terrainGrid.getTileAt(x, z);
            if (updatedTile) {
              newHeights.set(`${x},${z}`, updatedTile.height);
            }
          }
          this.flashTileEdit(tile.mesh);
        }
      }
    }

    // Record command for undo
    if (affectedTiles.length > 0) {
      if (this.editMode === 'paint') {
        const command = new PaintCommand(
          affectedTiles,
          this.selectedTerrainType,
          (x, z, type) => this.terrainGrid.paintTile(x, z, type)
        );
        this.editHistory.record(command);
      } else if (this.editMode === 'height') {
        const command = new HeightCommand(
          affectedTiles,
          newHeights,
          (x, z, height) => this.terrainGrid.setHeight(x, z, height)
        );
        this.editHistory.record(command);
      }
    }

    if (affectedTiles.length > 0 && this.editMode === 'paint') {
      this.runPathValidation();
    }

    this.clearRectanglePreview();
    this.rectangleStartTile = null;
  }

  private updateRectanglePreview(startTile: THREE.Mesh, endTile: THREE.Mesh): void {
    this.clearRectanglePreview();

    // Validate userData exists for both tiles
    if (!startTile.userData || !endTile.userData ||
        typeof startTile.userData['gridX'] !== 'number' ||
        typeof startTile.userData['gridZ'] !== 'number' ||
        typeof endTile.userData['gridX'] !== 'number' ||
        typeof endTile.userData['gridZ'] !== 'number') {
      return;
    }

    const x1 = startTile.userData['gridX'];
    const z1 = startTile.userData['gridZ'];
    const x2 = endTile.userData['gridX'];
    const z2 = endTile.userData['gridZ'];

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minZ = Math.min(z1, z2);
    const maxZ = Math.max(z1, z2);

    // Performance limit: don't create more than 100 preview meshes
    const tileCount = (maxX - minX + 1) * (maxZ - minZ + 1);
    if (tileCount > 100) {
      // For large selections, only show corner/edge previews
      return;
    }

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const tile = this.terrainGrid.getTileAt(x, z);
        if (tile) {
          const geometry = new THREE.RingGeometry(
            EDITOR_RECTANGLE_PREVIEW.innerRadius,
            EDITOR_RECTANGLE_PREVIEW.outerRadius,
            EDITOR_RECTANGLE_PREVIEW.segments
          );
          const material = new THREE.MeshBasicMaterial({
            color: EDITOR_RECTANGLE_PREVIEW.color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: EDITOR_RECTANGLE_PREVIEW.opacity,
            depthTest: false
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.copy(tile.mesh.position);
          mesh.position.y = tile.mesh.position.y + EDITOR_RECTANGLE_PREVIEW.yOffset;
          mesh.renderOrder = 998;
          this.scene.add(mesh);
          this.rectanglePreviewMeshes.push(mesh);
        }
      }
    }
  }

  private clearRectanglePreview(): void {
    this.rectanglePreviewMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      disposeMaterial(mesh.material);
    });
    this.rectanglePreviewMeshes = [];
  }

  /**
   * Handle joystick events from the modular VirtualJoystickComponent
   */
  public onJoystickChange(event: JoystickEvent): void {
    if (event.type === 'movement') {
      this.movementJoystick = {
        active: event.active,
        x: event.vector.x,
        y: event.vector.y
      };
    } else if (event.type === 'rotation') {
      this.rotationJoystick = {
        active: event.active,
        x: event.vector.x,
        y: event.vector.y
      };
    }
  }

  public setEditMode(mode: EditMode): void {
    this.editorState.setEditMode(mode);
    // Update brush indicator color immediately for crisp feedback
    if (this.brushIndicator) {
      const material = this.brushIndicator.material as THREE.MeshBasicMaterial;
      material.color.setHex(this.editorState.getColorForMode());
    }
  }

  public setTerrainType(type: TerrainType): void {
    this.editorState.setTerrainType(type);
    // Update brush indicator color since mode may have changed
    if (this.brushIndicator) {
      const material = this.brushIndicator.material as THREE.MeshBasicMaterial;
      material.color.setHex(this.editorState.getColorForMode());
    }
  }

  public setBrushSize(size: number): void {
    this.editorState.setBrushSize(size);
    this.updateBrushPreview();
  }

  public setActiveTool(tool: BrushTool): void {
    this.changeActiveTool(tool);
  }

  /**
   * Undo the last edit action
   */
  public undo(): void {
    const command = this.editHistory.undo();
    if (command) {
      // Update markers if spawn/exit was undone
      this.updateSpawnMarker();
      this.updateExitMarker();
      this.runPathValidation();
    }
  }

  /**
   * Redo the last undone action
   */
  public redo(): void {
    const command = this.editHistory.redo();
    if (command) {
      // Update markers if spawn/exit was redone
      this.updateSpawnMarker();
      this.updateExitMarker();
      this.runPathValidation();
    }
  }

  /**
   * Clear all edit history
   */
  public clearHistory(): void {
    this.editHistory.clear();
  }

  /**
   * Run BFS path validation and cache the result.
   * Call after any terrain paint, spawn/exit placement, or map load.
   */
  private runPathValidation(): void {
    if (!this.terrainGrid) {
      this.pathValidationResult = { valid: false };
      return;
    }
    const state = this.terrainGrid.exportState();
    this.pathValidationResult = this.pathValidation.validate(state);
  }

  /**
   * Check if the map is ready to play: has both spawn and exit points
   * AND a valid walkable path exists between them.
   */
  public get canPlayMap(): boolean {
    if (!this.terrainGrid) return false;
    const hasPoints =
      this.terrainGrid.getSpawnPoints().length > 0 &&
      this.terrainGrid.getExitPoints().length > 0;
    return hasPoints && this.pathValidationResult.valid;
  }

  /**
   * Navigate to the game to play the current map
   */
  public playMap(): void {
    if (!this.canPlayMap) return;
    this.router.navigate(['/play']);
  }

  /**
   * Export current map to a downloadable file
   */
  public exportCurrentMap(): void {
    const currentId = this.mapStorage.getCurrentMapId();
    if (!currentId) {
      alert('No map to export. Save a map first (G key).');
      return;
    }

    const success = this.mapStorage.downloadMapAsFile(currentId);
    if (!success) {
      alert('Failed to export map.');
    }
  }

  /**
   * Import a map from a file
   */
  public async importMapFromFile(): Promise<void> {
    const mapId = await this.mapStorage.promptFileImport();
    if (mapId) {
      const state = this.mapStorage.loadMap(mapId);
      if (state) {
        this.terrainGrid.importState(state);
        this.updateSpawnMarker();
        this.updateExitMarker();
        this.runPathValidation();
        const metadata = this.mapStorage.getMapMetadata(mapId);
        if (metadata) {
          this.currentMapName = metadata.name;
        }
        // Clear edit history when loading a new map
        this.editHistory.clear();
        alert(`Map "${this.currentMapName}" imported successfully!`);
      }
    }
  }

  private animate = (): void => {
    if (!this.renderer || this.initError) return;
    this.animationFrameId = requestAnimationFrame(this.animate);

    // Update camera movement
    this.updateCameraMovement();

    if (this.controls) {
      this.controls.update();
    }

    // Animate brush indicator for crisp, noticeable feedback
    if (this.brushIndicator && this.brushIndicator.visible) {
      const pulse = Math.sin(Date.now() * EDITOR_ANIMATION.brushPulseSpeed) * EDITOR_ANIMATION.brushPulseAmplitude + 0.9;
      this.brushIndicator.scale.set(pulse, pulse, 1);
      const material = this.brushIndicator.material as THREE.MeshBasicMaterial;
      material.opacity = 0.6 + Math.sin(Date.now() * EDITOR_ANIMATION.brushPulseSpeed) * 0.2;
    }

    // Animate spawn markers
    const spawnPoints = this.terrainGrid.getSpawnPoints();
    for (let i = 0; i < this.spawnMarkers.length && i < spawnPoints.length; i++) {
      const bounce = Math.abs(Math.sin(Date.now() * EDITOR_ANIMATION.markerBounceSpeed)) * EDITOR_ANIMATION.markerBounceAmplitude;
      const tile = this.terrainGrid.getTileAt(spawnPoints[i].x, spawnPoints[i].z);
      if (tile) {
        this.spawnMarkers[i].position.y = tile.mesh.position.y + EDITOR_SPAWN_MARKER.yBase + bounce;
      }
      this.spawnMarkers[i].rotation.y += EDITOR_ANIMATION.spawnRotationSpeed;
    }

    // Animate exit markers
    const exitPointsAnim = this.terrainGrid.getExitPoints();
    for (let i = 0; i < this.exitMarkers.length && i < exitPointsAnim.length; i++) {
      const bounce = Math.abs(Math.sin(Date.now() * EDITOR_ANIMATION.markerBounceSpeed + EDITOR_ANIMATION.exitBouncePhaseOffset)) * EDITOR_ANIMATION.markerBounceAmplitude;
      const tile = this.terrainGrid.getTileAt(exitPointsAnim[i].x, exitPointsAnim[i].z);
      if (tile) {
        this.exitMarkers[i].position.y = tile.mesh.position.y + EDITOR_EXIT_MARKER.yBase + bounce;
      }
      this.exitMarkers[i].rotation.y += EDITOR_ANIMATION.exitRotationSpeed;
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
    // Stop the animation loop first to prevent calls to disposed resources
    cancelAnimationFrame(this.animationFrameId);

    window.removeEventListener('keydown', this.keyboardHandler);
    window.removeEventListener('keyup', this.keyUpHandler);
    window.removeEventListener('resize', this.resizeHandler);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.resizeHandler);
    }

    if (this.renderer) {
      const canvas = this.renderer.domElement;
      canvas.removeEventListener('mousemove', this.mousemoveHandler);
      canvas.removeEventListener('mousedown', this.mouseDownHandler);
      canvas.removeEventListener('mouseup', this.mouseUpHandler);
      canvas.removeEventListener('mouseleave', this.mouseUpHandler);
      canvas.removeEventListener('touchstart', this.touchStartHandler);
      canvas.removeEventListener('touchmove', this.touchMoveHandler);
      canvas.removeEventListener('touchend', this.touchEndHandler);
      canvas.removeEventListener('touchcancel', this.touchEndHandler);
    }

    // Snapshot terrain state for the game to consume on /play navigation
    // and auto-save to localStorage to prevent data loss
    if (this.terrainGrid) {
      const state = this.terrainGrid.exportState();
      this.mapBridge.setEditorMapState(state);
      try {
        this.mapStorage.saveMap(
          this.currentMapName,
          state,
          this.mapStorage.getCurrentMapId() || undefined
        );
      } catch (error) {
        console.warn('Auto-save failed on destroy:', error);
      }
    }

    // Clear undo/redo history to prevent stale closures referencing disposed TerrainGrid
    this.editHistory.clear();

    // Clean up brush preview meshes
    if (this.scene) {
      this.brushPreviewMeshes.forEach(mesh => {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        disposeMaterial(mesh.material);
      });
      this.brushPreviewMeshes = [];

      // Clean up rectangle preview meshes
      this.clearRectanglePreview();

      // Clean up brush indicator
      if (this.brushIndicator) {
        this.scene.remove(this.brushIndicator);
        this.brushIndicator.geometry.dispose();
        disposeMaterial(this.brushIndicator.material);
      }

      // Clean up spawn/exit markers
      for (const marker of this.spawnMarkers) {
        this.scene.remove(marker);
        marker.geometry.dispose();
        disposeMaterial(marker.material);
      }
      this.spawnMarkers = [];
      for (const marker of this.exitMarkers) {
        this.scene.remove(marker);
        marker.geometry.dispose();
        disposeMaterial(marker.material);
      }
      this.exitMarkers = [];

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

    if (this.terrainGrid) {
      this.terrainGrid.dispose();
    }

    // Dispose OrbitControls (removes its internal DOM event listeners)
    if (this.controls) {
      this.controls.dispose();
    }

    // Dispose post-processing passes (frees GPU framebuffers)
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
