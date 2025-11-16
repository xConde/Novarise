import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
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

  // Interaction
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private tileMeshes: Map<string, THREE.Mesh> = new Map();
  private hoveredTile: THREE.Mesh | null = null;
  private selectedTile: { row: number, col: number } | null = null;

  // Tower management
  private towerMeshes: Map<string, THREE.Mesh> = new Map();
  public selectedTowerType: string = 'basic';

  constructor(private gameBoardService: GameBoardService) { }

  ngOnInit(): void {
    this.initializeScene();
    this.initializeCamera();
    this.initializeLights();
    this.renderGameBoard();
    this.addGridLines();
  }

  ngAfterViewInit(): void {
    this.initializeRenderer();
    this.initializeControls();
    this.setupMouseInteraction();
    this.animate();
  }

  private initializeScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0a);
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

    this.canvasContainer.nativeElement.appendChild(this.renderer.domElement);

    // Handle window resize
    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    });
  }

  private initializeLights(): void {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(
      this.ambientLightColor,
      this.ambientLightIntensity
    );
    this.scene.add(ambientLight);

    // Directional light for shadows and definition
    const directionalLight = new THREE.DirectionalLight(
      this.directionalLightColor,
      this.directionalLightIntensity
    );
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    // Additional fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);
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
        const material = this.hoveredTile.material as THREE.MeshLambertMaterial;
        material.emissiveIntensity = this.hoveredTile.userData['tile'].type === 0 ? 0 : 0.3;
      }

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        if (mesh !== this.getSelectedTileMesh()) {
          this.hoveredTile = mesh;
          const material = mesh.material as THREE.MeshLambertMaterial;
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
        const material = prevSelected.material as THREE.MeshLambertMaterial;
        material.emissiveIntensity = prevSelected.userData['tile'].type === 0 ? 0 : 0.3;
      }

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const row = mesh.userData['row'];
        const col = mesh.userData['col'];

        this.selectedTile = { row, col };

        // Highlight selected tile
        const material = mesh.material as THREE.MeshLambertMaterial;
        material.emissiveIntensity = 0.8;

        console.log(`Tile selected: Row ${row}, Col ${col}`, mesh.userData['tile']);

        // Try to place a tower
        if (this.gameBoardService.canPlaceTower(row, col)) {
          if (this.gameBoardService.placeTower(row, col, this.selectedTowerType)) {
            this.spawnTower(row, col, this.selectedTowerType);
            console.log(`${this.selectedTowerType} tower placed at Row ${row}, Col ${col}`);
          }
        } else {
          console.log(`Cannot place tower at Row ${row}, Col ${col}`);
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

    this.renderer.render(this.scene, this.camera);
  }
}
