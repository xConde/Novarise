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
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private light!: THREE.AmbientLight;
  private boardGroup!: THREE.Group;
  private spawnerGroup!: THREE.Group;
  private exitGroup!: THREE.Group;
  private spawnerTiles: number[][] = [];
  private exitTiles: number[][] = [];
  private cameraDistance = 50;

  constructor(private gameBoardService: GameBoardService) { }

  ngOnInit(): void {
    this.initializeScene();
    this.initializeCamera();
    // this.initializeRenderer();
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
    console.log(aspectRatio, window.innerHeight, window.innerWidth)
    this.camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    this.camera.position.set(0, 30, 3);
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
    this.light = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(this.light);
  }

  private renderGameBoard(): void {
    const boardTiles = this.gameBoardService.getGameBoard();
    this.boardGroup = new THREE.Group();
    boardTiles.forEach((row: any[]) => {
      row.forEach(tile => {
        const { type } = tile;
        const shape = this.gameBoardService.getMeshShape(type);
        const mesh = this.gameBoardService.generateMesh(type, shape, tile.x, tile.y);
        mesh.receiveShadow = true;
        this.boardGroup.add(mesh);
      });
    });
    this.scene.add(this.boardGroup);
    console.log(this.scene.children)
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);
  }

  addCameraControls() {
    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = this.cameraDistance / 2;
    controls.maxDistance = this.cameraDistance * 2;
    controls.maxPolarAngle = Math.PI / 2;
    controls.update();
  }

  createTowerMesh(position: THREE.Vector3): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    return mesh;
  }

  createEnemyMesh(position: THREE.Vector3): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    return mesh;
  }
}
