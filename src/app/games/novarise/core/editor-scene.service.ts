import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { disposeMaterial } from '../../../game/game-board/utils/three-utils';
import {
  EDITOR_SCENE_CONFIG,
  EDITOR_RENDERER_CONFIG,
  EDITOR_POST_PROCESSING,
  EDITOR_LIGHTS,
  EDITOR_SKYBOX,
  EDITOR_PARTICLES,
} from '../constants/editor-scene.constants';
import {
  EDITOR_PERSPECTIVE_CAMERA_CONFIG,
  EDITOR_ORBIT_CONTROLS_CONFIG,
} from '../constants/editor-camera.constants';

// ---------------------------------------------------------------------------
// GLSL shader source — kept near the service that owns the passes.
// The random() hash constants (12.9898, 78.233, 43758.5453123) are canonical
// GLSL noise constants — do not extract them from the shader string.
// ---------------------------------------------------------------------------

const VIGNETTE_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const VIGNETTE_FRAGMENT_SHADER = `
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
`;

const SKYBOX_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// GLSL random() — standard hash (12.9898, 78.233 are canonical constants)
const SKYBOX_FRAGMENT_SHADER = `
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
`;

@Injectable()
export class EditorSceneService {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private composer!: EffectComposer;
  private bloomPass?: UnrealBloomPass;
  private vignettePass?: ShaderPass;
  private renderPass?: RenderPass;
  private skybox?: THREE.Mesh;
  private particles: THREE.Points | null = null;

  // Context loss handlers — stored for removal on dispose
  private contextLostHandler: ((event: Event) => void) | null = null;
  private contextRestoredHandler: (() => void) | null = null;

  // Resize handler — stored for removal on dispose
  private resizeHandler: (() => void) | null = null;

  // ----- Getters -----

  getScene(): THREE.Scene { return this.scene; }
  getCamera(): THREE.PerspectiveCamera { return this.camera; }
  getRenderer(): THREE.WebGLRenderer { return this.renderer; }
  getComposer(): EffectComposer { return this.composer; }
  getControls(): OrbitControls { return this.controls; }
  getParticles(): THREE.Points | null { return this.particles; }
  getSkybox(): THREE.Mesh | undefined { return this.skybox; }

  // ----- Initializers -----

  initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(EDITOR_SCENE_CONFIG.backgroundColor);
    this.scene.fog = new THREE.FogExp2(EDITOR_SCENE_CONFIG.fogColor, EDITOR_SCENE_CONFIG.fogDensity);
  }

  initCamera(): void {
    const aspectRatio = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      EDITOR_PERSPECTIVE_CAMERA_CONFIG.fov,
      aspectRatio,
      EDITOR_PERSPECTIVE_CAMERA_CONFIG.near,
      EDITOR_PERSPECTIVE_CAMERA_CONFIG.far
    );
    const dist = EDITOR_PERSPECTIVE_CAMERA_CONFIG.distance;
    this.camera.position.set(0, dist, dist * 0.5);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Initialise WebGLRenderer and attach canvas to the container element.
   * Context loss/restore callbacks are injected so the component retains
   * ownership of the animation-frame ID.
   */
  initRenderer(
    container: HTMLElement,
    onContextLost: () => void,
    onContextRestored: () => void
  ): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, EDITOR_RENDERER_CONFIG.maxPixelRatio));

    const { width, height } = this.getViewportSize();
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = EDITOR_RENDERER_CONFIG.toneMappingExposure;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const canvas = this.renderer.domElement;

    this.contextLostHandler = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    this.contextRestoredHandler = () => {
      onContextRestored();
    };

    canvas.addEventListener('webglcontextlost', this.contextLostHandler as EventListener);
    canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler as EventListener);

    container.appendChild(canvas);

    this.resizeHandler = () => {
      const { width: w, height: h } = this.getViewportSize();
      this.resize(w, h);
    };

    window.addEventListener('resize', this.resizeHandler);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.resizeHandler);
    }
  }

  initPostProcessing(): void {
    this.composer = new EffectComposer(this.renderer);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    const { width, height } = this.getViewportSize();
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      EDITOR_POST_PROCESSING.bloom.strength,
      EDITOR_POST_PROCESSING.bloom.radius,
      EDITOR_POST_PROCESSING.bloom.threshold
    );
    this.composer.addPass(this.bloomPass);

    const vignetteShader = {
      uniforms: {
        tDiffuse: { value: null },
        offset: { value: EDITOR_POST_PROCESSING.vignette.offset },
        darkness: { value: EDITOR_POST_PROCESSING.vignette.darkness }
      },
      vertexShader: VIGNETTE_VERTEX_SHADER,
      fragmentShader: VIGNETTE_FRAGMENT_SHADER,
    };

    this.vignettePass = new ShaderPass(vignetteShader);
    this.composer.addPass(this.vignettePass);
  }

  initLights(): void {
    const ambientLight = new THREE.AmbientLight(
      EDITOR_LIGHTS.ambient.color,
      EDITOR_LIGHTS.ambient.intensity
    );
    this.scene.add(ambientLight);

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
    this.scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(dl2Cfg.color, dl2Cfg.intensity);
    directionalLight2.position.set(...dl2Cfg.position);
    this.scene.add(directionalLight2);

    const directionalLight3 = new THREE.DirectionalLight(dl3Cfg.color, dl3Cfg.intensity);
    directionalLight3.position.set(...dl3Cfg.position);
    this.scene.add(directionalLight3);

    const directionalLight4 = new THREE.DirectionalLight(dl4Cfg.color, dl4Cfg.intensity);
    directionalLight4.position.set(...dl4Cfg.position);
    this.scene.add(directionalLight4);

    const blCfg = EDITOR_LIGHTS.bottomLight;
    const bottomLight = new THREE.DirectionalLight(blCfg.color, blCfg.intensity);
    bottomLight.position.set(...blCfg.position);
    bottomLight.lookAt(0, 0, 0);
    this.scene.add(bottomLight);

    const hemiLight = new THREE.HemisphereLight(
      EDITOR_LIGHTS.hemisphere.skyColor,
      EDITOR_LIGHTS.hemisphere.groundColor,
      EDITOR_LIGHTS.hemisphere.intensity
    );
    this.scene.add(hemiLight);

    for (const cfg of EDITOR_LIGHTS.point) {
      const pl = new THREE.PointLight(cfg.color, cfg.intensity, cfg.distance);
      pl.position.set(...cfg.position);
      this.scene.add(pl);
    }
  }

  initSkybox(): void {
    const starfieldGeometry = new THREE.SphereGeometry(
      EDITOR_SKYBOX.radius,
      EDITOR_SKYBOX.widthSegments,
      EDITOR_SKYBOX.heightSegments
    );

    const starfieldMaterial = new THREE.ShaderMaterial({
      vertexShader: SKYBOX_VERTEX_SHADER,
      fragmentShader: SKYBOX_FRAGMENT_SHADER,
      side: THREE.BackSide,
      depthWrite: false
    });

    this.skybox = new THREE.Mesh(starfieldGeometry, starfieldMaterial);
    this.scene.add(this.skybox);
  }

  initParticles(): void {
    const particleCount = EDITOR_PARTICLES.count;
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

  initControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.controls.enableRotate = false;
    this.controls.enablePan = false;
    this.controls.enableZoom = true;
    this.controls.zoomSpeed = EDITOR_ORBIT_CONTROLS_CONFIG.zoomSpeed;
    this.controls.minDistance = EDITOR_ORBIT_CONTROLS_CONFIG.minDistance;
    this.controls.maxDistance = EDITOR_ORBIT_CONTROLS_CONFIG.maxDistance;
    this.controls.enableDamping = false;

    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  // ----- Per-frame operations -----

  resize(width: number, height: number): void {
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    if (this.renderer) {
      this.renderer.setSize(width, height);
    }
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }

  render(): void {
    if (this.composer) {
      this.composer.render();
    } else if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // ----- Selective disposal -----

  disposeParticles(): void {
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      disposeMaterial(this.particles.material);
      this.particles = null;
    }
  }

  disposeSkybox(): void {
    if (this.skybox) {
      this.scene.remove(this.skybox);
      this.skybox.geometry.dispose();
      disposeMaterial(this.skybox.material);
      this.skybox = undefined;
    }
  }

  // ----- Full disposal (called from component ngOnDestroy) -----

  dispose(): void {
    // Particles
    this.disposeParticles();

    // Skybox
    this.disposeSkybox();

    // Post-processing
    if (this.vignettePass) {
      this.vignettePass.dispose();
      this.vignettePass = undefined;
    }
    if (this.bloomPass) {
      this.bloomPass.dispose();
      this.bloomPass = undefined;
    }
    if (this.renderPass) {
      this.renderPass.dispose();
      this.renderPass = undefined;
    }
    if (this.composer) {
      this.composer.renderTarget1.dispose();
      this.composer.renderTarget2.dispose();
      this.composer.dispose();
    }

    // Context loss handlers
    if (this.contextLostHandler && this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLostHandler as EventListener);
    }
    if (this.contextRestoredHandler && this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener('webglcontextrestored', this.contextRestoredHandler as EventListener);
    }
    this.contextLostHandler = null;
    this.contextRestoredHandler = null;

    // Resize handlers
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', this.resizeHandler);
      }
      this.resizeHandler = null;
    }

    // Controls
    if (this.controls) {
      this.controls.dispose();
    }

    // Renderer
    if (this.renderer) {
      if (this.renderer.domElement?.parentElement) {
        this.renderer.domElement.remove();
      }
      this.renderer.dispose();
    }
  }

  // ----- Private helpers -----

  /**
   * Get accurate viewport size accounting for mobile browser chrome.
   */
  private getViewportSize(): { width: number; height: number } {
    if (window.visualViewport) {
      return {
        width: window.visualViewport.width,
        height: window.visualViewport.height
      };
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }
}
