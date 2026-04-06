import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import * as THREE from 'three';
import { TerrainGrid } from './features/terrain-editor/terrain-grid.class';
import { TerrainType, TERRAIN_CONFIGS } from './models/terrain-types.enum';
import { MapStorageService } from '../../core/services/map-storage.service';
import { EditHistoryService, SpawnPointCommand, ExitPointCommand } from './core/edit-history.service';
import { CameraControlService, MovementInput, RotationInput, JoystickInput } from './core/camera-control.service';
import { EditorStateService, EditMode, BrushTool } from './core/editor-state.service';
import { MapBridgeService } from '../../core/services/map-bridge.service';
import { disposeMesh } from '../../game/game-board/utils/three-utils';
import { JoystickEvent } from './features/mobile-controls';
import {
  EDITOR_EDIT_THROTTLE_MS,
  EDITOR_BRUSH_INDICATOR,
  EDITOR_BRUSH_PREVIEW,
  EDITOR_RECTANGLE_PREVIEW,
  EDITOR_SPAWN_MARKER,
  EDITOR_EXIT_MARKER,
  EDITOR_ANIMATION,
  EDITOR_HOVER_EMISSIVE,
  EDITOR_PATH_INVALID_FLASH_MS,
  EDITOR_PATH_INVALID_FLASH_COLOR,
  EDITOR_RENDER_ORDER,
  EDITOR_AUTOSAVE_JUST_NOW_MS,
} from './constants/editor-ui.constants';
import { PathValidationService, PathValidationResult } from './core/path-validation.service';
import { MapTemplateService } from '../../core/services/map-template.service';
import { MapTemplate } from '../../core/models/map-template.model';
import { EditorSceneService } from './core/editor-scene.service';
import { EditorNotificationService, EditorNotification } from './core/editor-notification.service';
import { TerrainEditService } from './core/terrain-edit.service';
import { MapFileService } from './core/map-file.service';

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
  private animationFrameId = 0;

  // WebGL context loss recovery
  contextLost = false;

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

  // Map templates
  public templates: MapTemplate[] = [];

  // Toast notification state (populated from EditorNotificationService)
  public editorNotification: EditorNotification | null = null;
  private notificationSub: Subscription | null = null;

  // Modal dialog state (replaces browser prompt()/confirm())
  public showModal = false;
  public modalTitle = '';
  public modalType: 'input' | 'confirm' | 'select' = 'confirm';
  public modalInputValue = '';
  public modalSelectOptions: string[] = [];
  private modalCallback: ((result: string | boolean | number | null) => void) | null = null;

  // Autosave draft timestamp (updated when MapFileService triggers a save)
  public lastAutosaveTime: Date | null = null;

  // Undo/Redo state - expose for UI binding
  public get canUndo(): boolean { return this.editHistory.canUndo; }
  public get canRedo(): boolean { return this.editHistory.canRedo; }
  public get undoDescription(): string | null { return this.editHistory.nextUndoDescription; }
  public get redoDescription(): string | null { return this.editHistory.nextRedoDescription; }

  constructor(
    private router: Router,
    private mapStorage: MapStorageService,
    private editHistory: EditHistoryService,
    private cameraControl: CameraControlService,
    private editorState: EditorStateService,
    private mapBridge: MapBridgeService,
    private pathValidation: PathValidationService,
    private mapTemplateService: MapTemplateService,
    private editorScene: EditorSceneService,
    public editorNotificationService: EditorNotificationService,
    private terrainEdit: TerrainEditService,
    private mapFile: MapFileService,
  ) {
    this.keyboardHandler = this.handleKeyDown.bind(this);
    this.keyUpHandler = this.handleKeyUp.bind(this);
    this.mouseDownHandler = this.handleMouseDown.bind(this);
    this.mouseUpHandler = this.handleMouseUp.bind(this);
  }

  ngAfterViewInit(): void {
    this.editorScene.initScene();
    this.editorScene.initCamera();
    this.editorScene.initLights();
    this.editorScene.initSkybox();
    this.editorScene.initParticles();
    this.editorScene.initRenderer(
      this.canvasContainer.nativeElement,
      () => {
        this.contextLost = true;
        if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
          this.animationFrameId = 0;
        }
      },
      () => {
        this.contextLost = false;
        if (!this.animationFrameId) {
          this.animate();
        }
      }
    );
    this.editorScene.initPostProcessing();
    this.editorScene.initControls();

    // Initialize terrain grid
    this.terrainGrid = new TerrainGrid(this.editorScene.getScene(), 25);
    this.terrainEdit.setTerrainGrid(this.terrainGrid);
    this.mapFile.setTerrainGrid(this.terrainGrid);

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

    // Subscribe to toast notifications from EditorNotificationService
    this.notificationSub = this.editorNotificationService.getNotification().subscribe(n => {
      this.editorNotification = n;
    });

    // Try to migrate old format and load current map
    this.mapStorage.migrateOldFormat();
    this.tryLoadCurrentMap();

    // Offer to restore any unsaved draft (only after the named map is loaded)
    const draft = this.mapFile.loadDraft();
    if (draft) {
      this.showConfirmModal('An unsaved draft was found. Restore it?', (confirmed) => {
        if (confirmed) {
          this.terrainGrid.importState(draft);
          this.updateSpawnMarker();
          this.updateExitMarker();
          this.runPathValidation();
        }
        this.mapFile.clearDraft();
      });
    }

    this.mapFile.startAutosave();

    this.setupInteraction();
    this.setupKeyboardControls();
    this.animate();
  }

  private initializeCameraRotation(): void {
    this.cameraControl.initializeFromCamera(this.editorScene.getCamera(), new THREE.Vector3(0, 0, 0));
  }

  private setupInteraction(): void {
    const canvas = this.editorScene.getRenderer().domElement;

    this.mousemoveHandler = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.editorScene.getCamera());
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

      this.raycaster.setFromCamera(this.mouse, this.editorScene.getCamera());
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

      this.raycaster.setFromCamera(this.mouse, this.editorScene.getCamera());
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
    if (this.terrainEdit.isTracking) {
      this.endStroke();
    }

    // Rectangle tool: complete selection
    if (this.activeTool === 'rectangle' && this.rectangleStartTile && this.hoveredTile) {
      this.fillRectangle(this.rectangleStartTile, this.hoveredTile);
    }

    this.rectangleStartTile = null;
  }

  private startStroke(): void {
    this.terrainEdit.startStroke();
  }

  private endStroke(): void {
    this.terrainEdit.endStroke(() => this.runPathValidation());
  }

  private applyEdit(mesh: THREE.Mesh): void {
    // Handle different tools
    if (this.activeTool === 'fill') {
      const flashTargets = this.terrainEdit.floodFill(mesh, () => this.runPathValidation());
      flashTargets.forEach(m => this.flashTileEdit(m));
      return;
    }

    if (this.activeTool === 'rectangle') {
      // Rectangle tool is handled in mouse handlers
      return;
    }

    // Regular brush tool with multi-tile support
    const affectedTiles = this.getAffectedTiles(mesh);
    const editMode = this.editMode;

    if (editMode === 'paint' || editMode === 'height') {
      const flashTargets = this.terrainEdit.applyBrushEdit(affectedTiles, () => this.runPathValidation());
      flashTargets.forEach(m => this.flashTileEdit(m));
      return;
    }

    // Spawn/exit placement — stays in component (marker management)
    affectedTiles.forEach(tileMesh => {
      const x = tileMesh.userData['gridX'] as number;
      const z = tileMesh.userData['gridZ'] as number;

      if (editMode === 'spawn') {
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
      } else if (editMode === 'exit') {
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
    this.cameraControl.applyToCamera(this.editorScene.getCamera(), this.editorScene.getControls()?.target);
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
    this.brushIndicator.renderOrder = EDITOR_RENDER_ORDER.brushIndicator;
    this.editorScene.getScene().add(this.brushIndicator);
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
    mesh.renderOrder = EDITOR_RENDER_ORDER.spawnMarker;
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
    mesh.renderOrder = EDITOR_RENDER_ORDER.exitMarker;
    return mesh;
  }

  /** Sync spawn marker meshes with the terrainGrid's spawnPoints array. */
  private updateSpawnMarkers(): void {
    const points = this.terrainGrid.getSpawnPoints();

    // Remove excess markers
    while (this.spawnMarkers.length > points.length) {
      const marker = this.spawnMarkers.pop()!;
      this.editorScene.getScene().remove(marker);
      disposeMesh(marker);
    }

    // Add missing markers
    while (this.spawnMarkers.length < points.length) {
      const marker = this.createSpawnMarkerMesh();
      this.spawnMarkers.push(marker);
      this.editorScene.getScene().add(marker);
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
      this.editorScene.getScene().remove(marker);
      disposeMesh(marker);
    }

    // Add missing markers
    while (this.exitMarkers.length < points.length) {
      const marker = this.createExitMarkerMesh();
      this.exitMarkers.push(marker);
      this.editorScene.getScene().add(marker);
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

  private updateSpawnMarker(): void {
    this.updateSpawnMarkers();
  }

  private updateExitMarker(): void {
    this.updateExitMarkers();
  }

  // ── Modal dialog helpers ──────────────────────────────────────────────────

  private showInputModal(title: string, defaultValue: string, callback: (value: string | null) => void): void {
    this.modalTitle = title;
    this.modalType = 'input';
    this.modalInputValue = defaultValue;
    this.modalCallback = (result) => callback(result as string | null);
    this.showModal = true;
  }

  private showConfirmModal(title: string, callback: (confirmed: boolean) => void): void {
    this.modalTitle = title;
    this.modalType = 'confirm';
    this.modalCallback = (result) => callback(result as boolean);
    this.showModal = true;
  }

  private showSelectModal(title: string, options: string[], callback: (index: number | null) => void): void {
    this.modalTitle = title;
    this.modalType = 'select';
    this.modalSelectOptions = options;
    this.modalCallback = (result) => callback(result === null ? null : (result as unknown as number));
    this.showModal = true;
  }

  public confirmModal(): void {
    const cb = this.modalCallback;
    const value = this.modalType === 'input' ? (this.modalInputValue || null) : true;
    this.closeModal();
    if (cb) cb(value);
  }

  public selectModalOption(index: number): void {
    const cb = this.modalCallback;
    this.closeModal();
    if (cb) cb(index);
  }

  public cancelModal(): void {
    const cb = this.modalCallback;
    const value = this.modalType === 'input' ? null : false;
    this.closeModal();
    if (cb) cb(value);
  }

  public closeModal(): void {
    this.showModal = false;
    this.modalCallback = null;
  }

  // ─────────────────────────────────────────────────────────────────────────

  private saveGridState(): void {
    // Warn if map has no valid path (but allow saving anyway — might be in-progress)
    if (!this.isPathValid && this.hasSpawnAndExit) {
      this.showConfirmModal('This map has no valid path from spawn to exit. Save anyway?', (proceed) => {
        if (!proceed) return;
        this.promptForMapNameAndSave();
      });
      return;
    }
    this.promptForMapNameAndSave();
  }

  private promptForMapNameAndSave(): void {
    this.showInputModal('Enter map name', this.currentMapName, (mapName) => {
      if (!mapName) return; // User cancelled
      this.mapFile.save(mapName);
    });
  }

  private loadGridState(): void {
    const maps = this.mapFile.getAllMaps();

    if (maps.length === 0) {
      this.editorNotificationService.show('No saved maps found.', 'error');
      return;
    }

    const options = maps.map((map) => {
      const date = new Date(map.updatedAt).toLocaleString();
      return `${map.name} — ${date}`;
    });

    this.showSelectModal('Select a map to load', options, (selectedIndex) => {
      if (selectedIndex === null) return; // User cancelled

      const selectedMap = maps[selectedIndex];
      const state = this.mapFile.loadById(selectedMap.id);

      if (state) {
        this.terrainGrid.importState(state);
        this.updateSpawnMarker();
        this.updateExitMarker();
        this.runPathValidation();
      }
    });
  }

  private tryLoadCurrentMap(): void {
    const state = this.mapFile.loadCurrent();
    if (state) {
      this.terrainGrid.importState(state);
      this.updateSpawnMarker();
      this.updateExitMarker();
      this.runPathValidation();
    }
  }

  /** Returns a human-readable string for the autosave indicator. */
  public formatAutosaveTime(): string {
    if (!this.lastAutosaveTime) return '';
    const elapsed = Date.now() - this.lastAutosaveTime.getTime();
    if (elapsed < EDITOR_AUTOSAVE_JUST_NOW_MS) return 'just now';
    const mins = Math.floor(elapsed / 60_000);
    return `${mins} min ago`;
  }

  public loadTemplate(templateId: string): void {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    const doLoad = () => {
      const state = this.mapFile.loadTemplate(template);
      if (!state) return;
      this.terrainGrid.importState(state);
      this.updateSpawnMarker();
      this.updateExitMarker();
      this.runPathValidation();
      this.editHistory.clear();
      this.mapStorage.clearCurrentMapId();
      this.currentMapName = '';
      this.mapFile.clearDraft();
    };

    if (this.editHistory.canUndo) {
      this.showConfirmModal('Load template? Unsaved changes will be lost.', (confirmed) => {
        if (confirmed) doLoad();
      });
    } else {
      doLoad();
    }
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
      this.editorScene.getScene().remove(mesh);
      disposeMesh(mesh);
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
          mesh.renderOrder = EDITOR_RENDER_ORDER.brushPreview;
          mesh.userData = { offsetX: dx, offsetZ: dz };
          this.editorScene.getScene().add(mesh);
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

  private fillRectangle(startTile: THREE.Mesh, endTile: THREE.Mesh): void {
    const flashTargets = this.terrainEdit.fillRectangle(
      startTile,
      endTile,
      () => this.runPathValidation()
    );
    flashTargets.forEach(m => this.flashTileEdit(m));
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
          mesh.renderOrder = EDITOR_RENDER_ORDER.rectanglePreview;
          this.editorScene.getScene().add(mesh);
          this.rectanglePreviewMeshes.push(mesh);
        }
      }
    }
  }

  private clearRectanglePreview(): void {
    this.rectanglePreviewMeshes.forEach(mesh => {
      this.editorScene.getScene().remove(mesh);
      disposeMesh(mesh);
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
    this.mapFile.exportAsJson();
  }

  /**
   * Import a map from a file
   */
  public async importMapFromFile(): Promise<void> {
    const state = await this.mapFile.importFromJson(new File([], ''));
    if (state) {
      this.terrainGrid.importState(state);
      this.updateSpawnMarker();
      this.updateExitMarker();
      this.runPathValidation();
      // Clear edit history when loading a new map
      this.editHistory.clear();
    }
  }

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    // Update camera movement
    this.updateCameraMovement();

    const controls = this.editorScene.getControls();
    if (controls) {
      controls.update();
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

    const particles = this.editorScene.getParticles();
    if (particles) {
      const positionAttribute = particles.geometry.attributes['position'] as THREE.BufferAttribute;
      const positions = positionAttribute.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(Date.now() * 0.001 + i) * 0.002;
      }
      positionAttribute.needsUpdate = true;
      particles.rotation.y += 0.0002;
    }

    this.editorScene.render();
  }

  ngOnDestroy(): void {
    // Stop the animation loop first to prevent calls to disposed resources
    cancelAnimationFrame(this.animationFrameId);

    this.mapFile.stopAutosave();

    this.notificationSub?.unsubscribe();
    this.notificationSub = null;
    this.editorNotificationService.clear();

    window.removeEventListener('keydown', this.keyboardHandler);
    window.removeEventListener('keyup', this.keyUpHandler);

    const canvas = this.editorScene.getRenderer()?.domElement;
    if (canvas) {
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
      this.mapStorage.saveMap(
        this.currentMapName,
        state,
        this.mapStorage.getCurrentMapId() || undefined
      );
    }

    // Clear undo/redo history to prevent stale closures referencing disposed TerrainGrid
    this.editHistory.clear();

    // Clean up brush preview meshes
    const scene = this.editorScene.getScene();
    this.brushPreviewMeshes.forEach(mesh => {
      scene.remove(mesh);
      disposeMesh(mesh);
    });
    this.brushPreviewMeshes = [];

    // Clean up rectangle preview meshes
    this.clearRectanglePreview();

    // Clean up brush indicator
    if (this.brushIndicator) {
      scene.remove(this.brushIndicator);
      disposeMesh(this.brushIndicator);
    }

    // Clean up spawn/exit markers
    for (const marker of this.spawnMarkers) {
      scene.remove(marker);
      disposeMesh(marker);
    }
    this.spawnMarkers = [];
    for (const marker of this.exitMarkers) {
      scene.remove(marker);
      disposeMesh(marker);
    }
    this.exitMarkers = [];

    if (this.terrainGrid) {
      this.terrainGrid.dispose();
    }

    // Dispose scene infrastructure (renderer, composer, passes, controls, skybox, particles)
    this.editorScene.dispose();
  }
}
