import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GameBoardService } from './game-board.service';
import { BlockType } from './models/game-board-tile';

@Component({
  selector: 'app-game-board',
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss']
})
export class GameBoardComponent implements OnInit, AfterViewInit {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;

  // Camera configuration constants
  private readonly cameraDistance = 50;
  private readonly cameraFov = 75;
  private readonly cameraNear = 0.1;
  private readonly cameraFar = 1000;
  private readonly cameraPositionY = 30;
  private readonly cameraPositionZ = 3;
  private readonly maxPolarAngle = Math.PI / 2;

  // Lighting configuration constants
  private readonly ambientLightIntensity = 1.0;
  private readonly ambientLightColor = 0xffffff;
  private readonly directionalLightIntensity = 0.5;
  private readonly directionalLightColor = 0xffffff;

  // Control configuration constants
  private readonly controlsDampingFactor = 0.05;

  // Scene objects
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private light!: THREE.AmbientLight;
  private boardGroup!: THREE.Group;
  private spawnerGroup!: THREE.Group;
  private exitGroup!: THREE.Group;
  private spawnerTiles: number[][] = [];
  private exitTiles: number[][] = [];

  constructor(private gameBoardService: GameBoardService) { }

  ngOnInit(): void {
    this.initializeScene();
    this.initializeCamera();
    this.initializeLight();
    this.addLights();
    this.renderGameBoard();
    this.renderSpawners();
    this.renderExits();
  }

  ngAfterViewInit(): void {
    this.initializeRenderer();
    this.addCameraControls();
    this.animate();
  }

  private initializeScene(): void {
    this.scene = new THREE.Scene();
  }

  private initializeCamera(): void {
    const aspectRatio = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      this.cameraFov,
      aspectRatio,
      this.cameraNear,
      this.cameraFar
    );
    this.camera.position.set(0, this.cameraPositionY, this.cameraPositionZ);
    this.camera.lookAt(this.scene.position);
  }

  private initializeRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvasContainer.nativeElement.appendChild(this.renderer.domElement);
    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    });
  }

  private initializeLight(): void {
    this.light = new THREE.AmbientLight(
      this.ambientLightColor,
      this.ambientLightIntensity
    );
    this.scene.add(this.light);
  }

  private renderGameBoard(): void {
    const boardTiles = this.gameBoardService.getGameBoard();
    this.boardGroup = new THREE.Group();
    boardTiles.forEach(row => {
      row.forEach(tile => {
        const { type } = tile;
        const shape = this.gameBoardService.getMeshShape(type);
        const mesh = this.gameBoardService.generateMesh(type, shape, tile.x, tile.y);
        mesh.receiveShadow = true;
        this.boardGroup.add(mesh);
      });
    });
    this.scene.add(this.boardGroup);
  }

  private renderSpawners(): void {
    this.spawnerTiles = this.gameBoardService.getSpawnerTiles();
    this.spawnerGroup = new THREE.Group();
    this.spawnerTiles.forEach(coords => {
      const mesh = this.gameBoardService.generateMesh(BlockType.SPAWNER, this.gameBoardService.getMeshShape(BlockType.SPAWNER), coords[0], coords[1]);
      mesh.receiveShadow = true;
      this.spawnerGroup.add(mesh);
    });
    this.scene.add(this.spawnerGroup);
  }

  private renderExits(): void {
    const exitTiles = this.gameBoardService.getExitTiles();

    const geometry = new THREE.PlaneGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00FFFF });
    const mesh = new THREE.Mesh(geometry, material);

    exitTiles.forEach((tile) => {
      const [x, y] = tile;
      const exitMesh = mesh.clone();
      exitMesh.position.set(y, 0.5, x);
      exitMesh.rotateX(-Math.PI / 2);
      this.scene.add(exitMesh);
    });
  }

  animate() {
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => {
      this.animate();
    });
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  addLights() {
    const ambientLight = new THREE.AmbientLight(
      this.ambientLightColor,
      this.ambientLightIntensity / 2
    );
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(
      this.directionalLightColor,
      this.directionalLightIntensity
    );
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);
  }

  addCameraControls() {
    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = this.controlsDampingFactor;
    controls.screenSpacePanning = false;
    controls.minDistance = this.cameraDistance / 2;
    controls.maxDistance = this.cameraDistance * 2;
    controls.maxPolarAngle = this.maxPolarAngle;
    controls.update();
  }
}
