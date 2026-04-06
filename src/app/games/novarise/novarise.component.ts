import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import * as THREE from 'three';
import { TerrainGrid } from './features/terrain-editor/terrain-grid.class';
import { TerrainType } from './models/terrain-types.enum';
import { MapStorageService } from '../../core/services/map-storage.service';
import { EditHistoryService, SpawnPointCommand, ExitPointCommand } from './core/edit-history.service';
import { CameraControlService, MovementInput, RotationInput, JoystickInput } from './core/camera-control.service';
import { EditorStateService, EditMode, BrushTool } from './core/editor-state.service';
import { MapBridgeService } from '../../core/services/map-bridge.service';
import { JoystickEvent } from './features/mobile-controls';
import {
  EDITOR_EDIT_THROTTLE_MS,
  EDITOR_AUTOSAVE_JUST_NOW_MS,
  EDITOR_HOVER_EMISSIVE,
} from './constants/editor-ui.constants';
import { PathValidationService, PathValidationResult } from './core/path-validation.service';
import { MapTemplateService } from '../../core/services/map-template.service';
import { MapTemplate } from '../../core/models/map-template.model';
import { EditorSceneService } from './core/editor-scene.service';
import { EditorNotificationService, EditorNotification } from './core/editor-notification.service';
import { TerrainEditService } from './core/terrain-edit.service';
import { MapFileService } from './core/map-file.service';
import { BrushPreviewService } from './core/brush-preview.service';
import { SpawnExitMarkerService } from './core/spawn-exit-marker.service';
import { RectangleToolService } from './core/rectangle-tool.service';
import { EditorModalService } from './core/editor-modal.service';
import { EditorKeyboardService } from './core/editor-keyboard.service';

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
  private lastEditTime = 0;
  private readonly editThrottleMs = EDITOR_EDIT_THROTTLE_MS;

  // Mobile joystick state (updated via modular VirtualJoystickComponent events)
  private movementJoystick: JoystickInput = { active: false, x: 0, y: 0 };
  private rotationJoystick: JoystickInput = { active: false, x: 0, y: 0 };

  // Event handlers (mouse/touch — keyboard is handled by EditorKeyboardService)
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

  // Modal dialog — delegated to EditorModalService (template binds through getters below)
  public get showModal(): boolean { return this.editorModal.showModal; }
  public get modalTitle(): string { return this.editorModal.modalTitle; }
  public get modalType(): 'input' | 'confirm' | 'select' { return this.editorModal.modalType; }
  public get modalInputValue(): string { return this.editorModal.modalInputValue; }
  public set modalInputValue(v: string) { this.editorModal.modalInputValue = v; }
  public get modalSelectOptions(): string[] { return this.editorModal.modalSelectOptions; }

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
    private brushPreview: BrushPreviewService,
    private spawnExitMarker: SpawnExitMarkerService,
    private rectangleTool: RectangleToolService,
    public editorModal: EditorModalService,
    private editorKeyboard: EditorKeyboardService,
  ) {
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

    // Wire up extracted services
    this.brushPreview.setScene(this.editorScene.getScene());
    this.brushPreview.setTerrainGrid(this.terrainGrid);
    this.spawnExitMarker.setScene(this.editorScene.getScene());
    this.spawnExitMarker.setTerrainGrid(this.terrainGrid);
    this.rectangleTool.setScene(this.editorScene.getScene());
    this.rectangleTool.setTerrainGrid(this.terrainGrid);

    // Create brush indicator for crisp visual feedback
    this.brushPreview.createBrushIndicator();

    // Initialize brush preview system
    this.brushPreview.updateBrushPreview();

    // Create spawn/exit markers for tower defense
    this.spawnExitMarker.createSpawnExitMarkers();

    // Initialize camera rotation to match initial camera view
    this.cameraControl.initializeFromCamera(this.editorScene.getCamera(), new THREE.Vector3(0, 0, 0));

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
      this.editorModal.showConfirmModal('An unsaved draft was found. Restore it?', (confirmed) => {
        if (confirmed) {
          this.terrainGrid.importState(draft);
          this.spawnExitMarker.updateSpawnMarkers();
          this.spawnExitMarker.updateExitMarkers();
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

  private setupInteraction(): void {
    const canvas = this.editorScene.getRenderer().domElement;

    this.mousemoveHandler = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.editorScene.getCamera());
      const tileMeshes = this.terrainGrid.getTileMeshes();
      const intersects = this.raycaster.intersectObjects(tileMeshes);

      // Reset previous hover emissive (delegated to BrushPreviewService)
      if (this.hoveredTile) this.brushPreview.resetHoverEmissive(this.hoveredTile);

      if (intersects.length > 0) {
        this.hoveredTile = intersects[0].object as THREE.Mesh;
        const material = this.hoveredTile.material as THREE.MeshStandardMaterial;

        // Crisp, bright hover state for clear feedback
        material.emissiveIntensity = EDITOR_HOVER_EMISSIVE.hover;

        // Position brush indicator at tile location
        this.brushPreview.positionBrushIndicator(this.hoveredTile);
        canvas.style.cursor = this.editorState.getCursorForMode();

        // Update brush preview meshes (only for brush tool)
        if (this.activeTool === 'brush') {
          this.brushPreview.updateBrushPreviewPositions(this.hoveredTile);
        } else {
          this.brushPreview.hideBrushPreview();
        }

        // Apply edit if mouse is down (with throttling for performance)
        if (this.isMouseDown) {
          // Rectangle tool: update preview
          if (this.activeTool === 'rectangle' && this.rectangleTool.getStartTile()) {
            this.rectangleTool.updatePreview(this.rectangleTool.getStartTile()!, this.hoveredTile);
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
        this.brushPreview.hideBrushIndicator();
        this.brushPreview.hideBrushPreview();
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
      const hit = this.raycastFromTouch(event.touches[0], canvas);
      if (hit) {
        this.hoveredTile = hit;
        this.handleMouseDown({ button: 0 } as MouseEvent);
      }
    };

    this.touchMoveHandler = (event: TouchEvent) => {
      event.preventDefault();
      const hit = this.raycastFromTouch(event.touches[0], canvas);
      if (hit) {
        this.hoveredTile = hit;
        if (this.isMouseDown) {
          if (this.activeTool === 'rectangle' && this.rectangleTool.getStartTile()) {
            this.rectangleTool.updatePreview(this.rectangleTool.getStartTile()!, this.hoveredTile);
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

  /** Convert a Touch to normalized device coords, raycast, and return the first tile hit. */
  private raycastFromTouch(touch: Touch, canvas: HTMLCanvasElement): THREE.Mesh | null {
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.editorScene.getCamera());
    const intersects = this.raycaster.intersectObjects(this.terrainGrid.getTileMeshes());
    return intersects.length > 0 ? (intersects[0].object as THREE.Mesh) : null;
  }

  private handleMouseDown(event: MouseEvent): void {
    if (event.button === 0) { // Left click
      this.isMouseDown = true;

      // Start tracking stroke for undo/redo (brush tool with paint/height mode)
      if (this.activeTool === 'brush' && (this.editMode === 'paint' || this.editMode === 'height')) {
        this.terrainEdit.startStroke();
      }

      if (this.hoveredTile) {
        // Rectangle tool: set start point
        if (this.activeTool === 'rectangle') {
          this.rectangleTool.setStartTile(this.hoveredTile);
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
      this.terrainEdit.endStroke(() => this.runPathValidation());
    }

    // Rectangle tool: complete selection
    const rectStart = this.rectangleTool.getStartTile();
    if (this.activeTool === 'rectangle' && rectStart && this.hoveredTile) {
      const flashTargets = this.rectangleTool.fill(rectStart, this.hoveredTile, () => this.runPathValidation());
      flashTargets.forEach(m => this.brushPreview.flashTileEdit(m));
    }
    this.rectangleTool.clearStartTile();
  }

  private applyEdit(mesh: THREE.Mesh): void {
    // Handle different tools
    if (this.activeTool === 'fill') {
      const flashTargets = this.terrainEdit.floodFill(mesh, () => this.runPathValidation());
      flashTargets.forEach(m => this.brushPreview.flashTileEdit(m));
      return;
    }

    if (this.activeTool === 'rectangle') {
      // Rectangle tool is handled in mouse handlers
      return;
    }

    // Regular brush tool with multi-tile support
    const affectedTiles = this.brushPreview.getAffectedTiles(mesh);
    const editMode = this.editMode;

    if (editMode === 'paint' || editMode === 'height') {
      const flashTargets = this.terrainEdit.applyBrushEdit(affectedTiles, () => this.runPathValidation());
      flashTargets.forEach(m => this.brushPreview.flashTileEdit(m));
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
          const spawnMs = this.spawnExitMarker.getSpawnMarkers();
          if (spawnMs.length > 0) this.brushPreview.flashMarkerRejection(spawnMs[0]);
          return;
        }
        // Reject placement on same tile as any exit
        const exitPoints = this.terrainGrid.getExitPoints();
        if (exitPoints.some(ep => ep.x === x && ep.z === z)) {
          const spawnMs = this.spawnExitMarker.getSpawnMarkers();
          if (spawnMs.length > 0) this.brushPreview.flashMarkerRejection(spawnMs[0]);
          return;
        }
        // Snapshot full spawn array before toggle for undo
        const previousSpawns = this.terrainGrid.getSpawnPoints().map(p => ({ ...p }));
        this.terrainGrid.addSpawnPoint(x, z);
        this.spawnExitMarker.updateSpawnMarkers();
        this.brushPreview.flashTileEdit(tileMesh);
        // Record command immediately (not part of stroke)
        const command = new SpawnPointCommand(
          previousSpawns,
          { x, z },
          (points) => {
            this.terrainGrid.setSpawnPoints(points);
            this.spawnExitMarker.updateSpawnMarkers();
          },
          (sx, sz) => {
            this.terrainGrid.addSpawnPoint(sx, sz);
            this.spawnExitMarker.updateSpawnMarkers();
          }
        );
        this.editHistory.record(command);
        this.runPathValidation();
      } else if (editMode === 'exit') {
        // Reject placement on non-walkable terrain
        const tile = this.terrainGrid.getTileAt(x, z);
        if (!tile || tile.type === TerrainType.CRYSTAL || tile.type === TerrainType.ABYSS) {
          const exitMs = this.spawnExitMarker.getExitMarkers();
          if (exitMs.length > 0) this.brushPreview.flashMarkerRejection(exitMs[0]);
          return;
        }
        // Reject placement on same tile as any spawn
        const spawnPoints = this.terrainGrid.getSpawnPoints();
        if (spawnPoints.some(sp => sp.x === x && sp.z === z)) {
          const exitMs = this.spawnExitMarker.getExitMarkers();
          if (exitMs.length > 0) this.brushPreview.flashMarkerRejection(exitMs[0]);
          return;
        }
        // Snapshot full exit array before toggle for undo
        const previousExits = this.terrainGrid.getExitPoints().map(p => ({ ...p }));
        this.terrainGrid.addExitPoint(x, z);
        this.spawnExitMarker.updateExitMarkers();
        this.brushPreview.flashTileEdit(tileMesh);
        // Record command immediately (not part of stroke)
        const command = new ExitPointCommand(
          previousExits,
          { x, z },
          (points) => {
            this.terrainGrid.setExitPoints(points);
            this.spawnExitMarker.updateExitMarkers();
          },
          (ex, ez) => {
            this.terrainGrid.addExitPoint(ex, ez);
            this.spawnExitMarker.updateExitMarkers();
          }
        );
        this.editHistory.record(command);
        this.runPathValidation();
      }
    });
  }

  private setupKeyboardControls(): void {
    this.editorKeyboard.setup({
      undo: () => this.undo(),
      redo: () => this.redo(),
      exportMap: () => this.exportCurrentMap(),
      importMap: () => this.importMapFromFile(),
      saveGrid: () => this.saveGridState(),
      loadGrid: () => this.loadGridState(),
      cycleBrushSize: (dir) => { this.editorState.cycleBrushSize(dir); this.brushPreview.updateBrushPreview(); },
      changeActiveTool: (tool) => this.setActiveTool(tool),
      playMap: () => this.playMap(),
      setEditMode: (mode) => this.setEditMode(mode),
      setTerrainType: (type) => this.setTerrainType(type),
    });
  }

  private updateCameraMovement(): void {
    const keys = this.editorKeyboard.getKeysPressed();
    const movementInput: MovementInput = {
      forward: keys.has('w'),
      backward: keys.has('s'),
      left: keys.has('a'),
      right: keys.has('d'),
      up: keys.has('e'),
      down: keys.has('q'),
      fast: keys.has('shift')
    };
    const rotationInput: RotationInput = {
      left: keys.has('arrowleft'),
      right: keys.has('arrowright'),
      up: keys.has('arrowup'),
      down: keys.has('arrowdown')
    };
    this.cameraControl.update(movementInput, rotationInput, this.movementJoystick, this.rotationJoystick);
    this.cameraControl.applyToCamera(this.editorScene.getCamera(), this.editorScene.getControls()?.target);
  }

  // ── Modal dialog helpers — delegated to EditorModalService ───────────────

  public confirmModal(): void { this.editorModal.confirmModal(); }
  public selectModalOption(index: number): void { this.editorModal.selectModalOption(index); }
  public cancelModal(): void { this.editorModal.cancelModal(); }
  public closeModal(): void { this.editorModal.closeModal(); }

  // ─────────────────────────────────────────────────────────────────────────

  private saveGridState(): void {
    if (!this.isPathValid && this.hasSpawnAndExit) {
      this.editorModal.showConfirmModal('This map has no valid path from spawn to exit. Save anyway?', (proceed) => {
        if (!proceed) return;
        this.editorModal.showInputModal('Enter map name', this.currentMapName, (mapName) => {
          if (!mapName) return;
          this.mapFile.save(mapName);
        });
      });
      return;
    }
    this.editorModal.showInputModal('Enter map name', this.currentMapName, (mapName) => {
      if (!mapName) return;
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

    this.editorModal.showSelectModal('Select a map to load', options, (selectedIndex) => {
      if (selectedIndex === null) return; // User cancelled

      const selectedMap = maps[selectedIndex];
      const state = this.mapFile.loadById(selectedMap.id);

      if (state) {
        this.terrainGrid.importState(state);
        this.spawnExitMarker.updateSpawnMarkers();
        this.spawnExitMarker.updateExitMarkers();
        this.runPathValidation();
      }
    });
  }

  private tryLoadCurrentMap(): void {
    const state = this.mapFile.loadCurrent();
    if (state) {
      this.terrainGrid.importState(state);
      this.spawnExitMarker.updateSpawnMarkers();
      this.spawnExitMarker.updateExitMarkers();
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
      this.spawnExitMarker.updateSpawnMarkers();
      this.spawnExitMarker.updateExitMarkers();
      this.runPathValidation();
      this.editHistory.clear();
      this.mapStorage.clearCurrentMapId();
      this.currentMapName = '';
      this.mapFile.clearDraft();
    };

    if (this.editHistory.canUndo) {
      this.editorModal.showConfirmModal('Load template? Unsaved changes will be lost.', (confirmed) => {
        if (confirmed) doLoad();
      });
    } else {
      doLoad();
    }
  }

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
    this.brushPreview.updateBrushIndicatorColor();
  }

  public setTerrainType(type: TerrainType): void {
    this.editorState.setTerrainType(type);
    // Update brush indicator color since mode may have changed
    this.brushPreview.updateBrushIndicatorColor();
  }

  public setBrushSize(size: number): void {
    this.editorState.setBrushSize(size);
    this.brushPreview.updateBrushPreview();
  }

  public setActiveTool(tool: BrushTool): void {
    this.editorState.setActiveTool(tool);
    if (tool !== 'rectangle') this.rectangleTool.reset();
    if (tool !== 'brush') this.brushPreview.hideBrushPreview();
  }

  public undo(): void {
    const command = this.editHistory.undo();
    if (command) {
      // Update markers if spawn/exit was undone
      this.spawnExitMarker.updateSpawnMarkers();
      this.spawnExitMarker.updateExitMarkers();
      this.runPathValidation();
    }
  }

  public redo(): void {
    const command = this.editHistory.redo();
    if (command) {
      // Update markers if spawn/exit was redone
      this.spawnExitMarker.updateSpawnMarkers();
      this.spawnExitMarker.updateExitMarkers();
      this.runPathValidation();
    }
  }

  public clearHistory(): void { this.editHistory.clear(); }

  private runPathValidation(): void {
    if (!this.terrainGrid) {
      this.pathValidationResult = { valid: false };
      return;
    }
    const state = this.terrainGrid.exportState();
    this.pathValidationResult = this.pathValidation.validate(state);
  }

  public get canPlayMap(): boolean {
    if (!this.terrainGrid) return false;
    const hasPoints =
      this.terrainGrid.getSpawnPoints().length > 0 &&
      this.terrainGrid.getExitPoints().length > 0;
    return hasPoints && this.pathValidationResult.valid;
  }

  public playMap(): void {
    if (!this.canPlayMap) return;
    this.router.navigate(['/play']);
  }

  public exportCurrentMap(): void {
    this.mapFile.exportAsJson();
  }

  public async importMapFromFile(): Promise<void> {
    const state = await this.mapFile.importFromJson(new File([], ''));
    if (state) {
      this.terrainGrid.importState(state);
      this.spawnExitMarker.updateSpawnMarkers();
      this.spawnExitMarker.updateExitMarkers();
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

    const now = Date.now();
    this.brushPreview.animateBrushIndicator(now);
    this.spawnExitMarker.animateMarkers(now);
    this.editorScene.animateParticles();
    this.editorScene.render();
  }

  ngOnDestroy(): void {
    // Stop the animation loop first to prevent calls to disposed resources
    cancelAnimationFrame(this.animationFrameId);

    this.mapFile.stopAutosave();

    this.notificationSub?.unsubscribe();
    this.notificationSub = null;
    this.editorNotificationService.clear();

    this.editorKeyboard.teardown();

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

    // Clean up brush preview meshes and indicator (delegated to service)
    this.brushPreview.cleanup();

    // Clean up rectangle preview meshes
    this.rectangleTool.cleanup();

    // Clean up spawn/exit markers (delegated to service)
    this.spawnExitMarker.cleanup();

    if (this.terrainGrid) {
      this.terrainGrid.dispose();
    }

    // Dispose scene infrastructure (renderer, composer, passes, controls, skybox, particles)
    this.editorScene.dispose();
  }
}
