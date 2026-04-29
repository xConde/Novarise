import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';
import { applyRendererPolicy, clampPixelRatio, disposeMaterial, disposeMesh } from '../utils/three-utils';
import { GAME_RENDERER_POLICY, POST_PROCESSING_CONFIG, SCENE_CONFIG, SKYBOX_CONFIG, ANIMATION_CONFIG } from '../constants/rendering.constants';
import { KEY_LIGHT, FILL_LIGHT, RIM_LIGHT, UNDER_LIGHT, ACCENT_LIGHTS, HEMISPHERE_LIGHT } from '../constants/lighting.constants';
import { CAMERA_CONFIG, CONTROLS_CONFIG } from '../constants/camera.constants';
import { BOARD_CONFIG } from '../constants/board.constants';
import { PARTICLE_CONFIG, PARTICLE_COLORS } from '../constants/particle.constants';

// ---------------------------------------------------------------------------
// GLSL shader source — kept near the service that owns the passes.
// The random() hash constant 12.9898/78.233 is a well-known GLSL pattern.
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
  varying vec3 vPosition;
  uniform float time;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  void main() {
    vec3 deepPurple = vec3(0.04, 0.02, 0.08);
    vec3 darkBlue = vec3(0.06, 0.04, 0.12);
    vec3 color = mix(deepPurple, darkBlue, vUv.y * 0.5);

    // Stars with twinkle
    vec2 starPos = vUv * 150.0;
    float star = random(floor(starPos));
    if (star > 0.992) {
      float baseBright = random(floor(starPos) + 1.0) * 0.5;
      float twinkle = 0.6 + 0.4 * sin(time * (1.0 + random(floor(starPos) + 2.0) * 3.0));
      float brightness = baseBright * twinkle;
      color += vec3(brightness * 0.4, brightness * 0.3, brightness * 0.5);
    }

    // Drifting nebula veins
    float drift = time * 0.02;
    float vein1 = random(floor(vUv * 40.0 + vec2(drift, vUv.x * 10.0 + drift * 0.5)));
    if (vein1 > 0.97) {
      color += vec3(0.25, 0.15, 0.3) * vein1;
    }

    // Slow-shifting bioluminescence
    float bio = random(floor(vUv * 25.0 + vec2(drift * 0.3))) * 0.12;
    color += vec3(bio * 0.3, bio * 0.5, bio * 0.7);

    gl_FragColor = vec4(color, 1.0);
  }
`;

@Injectable()
export class SceneService {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private controls!: OrbitControls;

  // Lights
  private hemisphereLight?: THREE.HemisphereLight;
  private keyLight?: THREE.DirectionalLight;
  private fillLight?: THREE.DirectionalLight;
  private rimLight?: THREE.DirectionalLight;
  private underLight?: THREE.PointLight;
  private accentLights: THREE.PointLight[] = [];

  // Post-processing passes
  private bloomPass?: UnrealBloomPass;
  private vignettePass?: ShaderPass;
  private outputPass?: OutputPass;
  private renderPass?: RenderPass;

  // Scene objects
  private skybox?: THREE.Mesh;
  private particles: THREE.Points | null = null;

  // Board size — used to clamp orbit target and prevent wandering off the map.
  // Initialised from BOARD_CONFIG so the pre-init default tracks the active
  // board dimensions; overridden by setBoardSize() once the component knows
  // the actual size (which can differ for editor-imported maps).
  private boardSize = Math.max(BOARD_CONFIG.width, BOARD_CONFIG.height);

  // Renderer event handlers — stored for removal on dispose
  private contextLostHandler: ((event: Event) => void) | null = null;
  private onControlsChange: (() => void) | null = null;
  private contextRestoredHandler: (() => void) | null = null;

  // Called by the component to restart the animation loop on context restore
  private onContextRestored: (() => void) | null = null;
  // Called by the component when context is lost (cancel rAF)
  private onContextLost: (() => void) | null = null;

  // ----- Getters -----

  getScene(): THREE.Scene { return this.scene; }
  getCamera(): THREE.PerspectiveCamera { return this.camera; }
  getRenderer(): THREE.WebGLRenderer { return this.renderer; }
  getComposer(): EffectComposer { return this.composer; }
  getControls(): OrbitControls { return this.controls; }
  getParticles(): THREE.Points | null { return this.particles; }
  getSkybox(): THREE.Mesh | undefined { return this.skybox; }

  setBoardSize(size: number): void { this.boardSize = size; }

  // ----- Initializers -----

  initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SCENE_CONFIG.backgroundColor);
    this.scene.fog = new THREE.FogExp2(SCENE_CONFIG.fogColor, SCENE_CONFIG.fogDensity);
  }

  initCamera(): void {
    const aspectRatio = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.fov,
      aspectRatio,
      CAMERA_CONFIG.near,
      CAMERA_CONFIG.far
    );
    this.camera.position.set(0, CAMERA_CONFIG.distance, CAMERA_CONFIG.distance * CAMERA_CONFIG.zOffsetFactor);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Initialise WebGLRenderer and attach to the DOM.
   * Context loss/restore callbacks are injected so the component keeps ownership
   * of the animation-frame ID.
   */
  initRenderer(
    canvas: HTMLCanvasElement,
    onContextLost: () => void,
    onContextRestored: () => void
  ): void {
    this.onContextLost = onContextLost;
    this.onContextRestored = onContextRestored;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    applyRendererPolicy(
      this.renderer,
      window.innerWidth,
      window.innerHeight,
      window.devicePixelRatio,
      GAME_RENDERER_POLICY
    );

    const rendererCanvas = this.renderer.domElement;

    this.contextLostHandler = (event: Event) => {
      event.preventDefault();
      this.onContextLost?.();
    };
    this.contextRestoredHandler = () => {
      this.onContextRestored?.();
    };

    rendererCanvas.addEventListener('webglcontextlost', this.contextLostHandler as EventListener);
    rendererCanvas.addEventListener('webglcontextrestored', this.contextRestoredHandler as EventListener);

    canvas.appendChild(rendererCanvas);
  }

  initPostProcessing(): void {
    this.composer = new EffectComposer(this.renderer);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      POST_PROCESSING_CONFIG.bloom.strength,
      POST_PROCESSING_CONFIG.bloom.radius,
      POST_PROCESSING_CONFIG.bloom.threshold
    );
    this.composer.addPass(this.bloomPass);

    const vignetteShader = {
      uniforms: {
        tDiffuse: { value: null },
        offset: { value: POST_PROCESSING_CONFIG.vignette.offset },
        darkness: { value: POST_PROCESSING_CONFIG.vignette.darkness }
      },
      vertexShader: VIGNETTE_VERTEX_SHADER,
      fragmentShader: VIGNETTE_FRAGMENT_SHADER,
    };

    this.vignettePass = new ShaderPass(vignetteShader);
    this.composer.addPass(this.vignettePass);

    // OutputPass MUST be last. It applies the renderer's tone mapping +
    // outputColorSpace to composer-rendered frames, which the EffectComposer
    // otherwise bypasses. Without this, ACESFilmicToneMapping +
    // SRGBColorSpace are silently dropped when composing.
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  initLights(): void {
    this.hemisphereLight = new THREE.HemisphereLight(
      HEMISPHERE_LIGHT.skyColor,
      HEMISPHERE_LIGHT.groundColor,
      HEMISPHERE_LIGHT.intensity
    );
    this.scene.add(this.hemisphereLight);

    const keyLight = new THREE.DirectionalLight(KEY_LIGHT.color, KEY_LIGHT.intensity);
    keyLight.position.set(...KEY_LIGHT.position!);
    keyLight.castShadow = KEY_LIGHT.castShadow;
    keyLight.shadow.camera.left = -KEY_LIGHT.shadow.bounds;
    keyLight.shadow.camera.right = KEY_LIGHT.shadow.bounds;
    keyLight.shadow.camera.top = KEY_LIGHT.shadow.bounds;
    keyLight.shadow.camera.bottom = -KEY_LIGHT.shadow.bounds;
    keyLight.shadow.mapSize.width = KEY_LIGHT.shadow.mapSize;
    keyLight.shadow.mapSize.height = KEY_LIGHT.shadow.mapSize;
    keyLight.shadow.bias = KEY_LIGHT.shadow.bias;
    this.keyLight = keyLight;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(FILL_LIGHT.color, FILL_LIGHT.intensity);
    this.fillLight.position.set(...FILL_LIGHT.position!);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(RIM_LIGHT.color, RIM_LIGHT.intensity);
    this.rimLight.position.set(...RIM_LIGHT.position!);
    this.scene.add(this.rimLight);

    this.underLight = new THREE.PointLight(UNDER_LIGHT.color, UNDER_LIGHT.intensity, UNDER_LIGHT.range);
    this.underLight.position.set(...UNDER_LIGHT.position!);
    this.scene.add(this.underLight);

    for (const cfg of ACCENT_LIGHTS) {
      const light = new THREE.PointLight(cfg.color, cfg.intensity, cfg.range);
      light.position.set(...cfg.position!);
      this.scene.add(light);
      this.accentLights.push(light);
    }
  }

  initControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = CONTROLS_CONFIG.dampingFactor;
    this.controls.screenSpacePanning = false;
    this.controls.enablePan = true;
    this.controls.minDistance = CAMERA_CONFIG.distance * CONTROLS_CONFIG.minDistanceFactor;
    this.controls.maxDistance = CAMERA_CONFIG.distance * CONTROLS_CONFIG.maxDistanceFactor;
    this.controls.minPolarAngle = CONTROLS_CONFIG.minPolarAngle;
    this.controls.maxPolarAngle = CONTROLS_CONFIG.maxPolarAngle;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    // Clamp orbit target to prevent wandering off the map.
    // Stored as a named field so dispose() can detach it — OrbitControls.dispose()
    // does NOT remove user-added 'change' listeners attached via addEventListener.
    this.onControlsChange = () => {
      const target = this.controls.target;
      const boardHalf = this.boardSize * CONTROLS_CONFIG.panBoundaryMargin;
      target.x = Math.max(-boardHalf, Math.min(boardHalf, target.x));
      target.z = Math.max(-boardHalf, Math.min(boardHalf, target.z));
      target.y = Math.max(0, Math.min(5, target.y));
    };
    this.controls.addEventListener('change', this.onControlsChange);
  }

  initParticles(): void {
    const particleCount = PARTICLE_CONFIG.count;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * PARTICLE_CONFIG.spread;
      positions[i * 3 + 1] = Math.random() * PARTICLE_CONFIG.heightRange + PARTICLE_CONFIG.heightMin;
      positions[i * 3 + 2] = (Math.random() - 0.5) * PARTICLE_CONFIG.spread;

      const colorChoice = Math.random();
      let colorEntry = PARTICLE_COLORS[PARTICLE_COLORS.length - 1];
      for (const entry of PARTICLE_COLORS) {
        if (colorChoice < entry.threshold) { colorEntry = entry; break; }
      }
      colors[i * 3] = colorEntry.r;
      colors[i * 3 + 1] = colorEntry.g;
      colors[i * 3 + 2] = colorEntry.b;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: PARTICLE_CONFIG.size,
      vertexColors: true,
      transparent: true,
      opacity: PARTICLE_CONFIG.opacity,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(this.particles);
  }

  initSkybox(): void {
    const starfieldGeometry = new THREE.SphereGeometry(
      SKYBOX_CONFIG.radius,
      SKYBOX_CONFIG.widthSegments,
      SKYBOX_CONFIG.heightSegments
    );

    const starfieldMaterial = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: SKYBOX_VERTEX_SHADER,
      fragmentShader: SKYBOX_FRAGMENT_SHADER,
      side: THREE.BackSide,
      depthWrite: false
    });

    this.skybox = new THREE.Mesh(starfieldGeometry, starfieldMaterial);
    this.scene.add(this.skybox);
  }

  // ----- Per-frame operations -----

  /** Tick ambient particle drift and skybox time uniform. */
  tickAmbientVisuals(time: number): void {
    if (this.particles) {
      const posAttr = this.particles.geometry.attributes['position'] as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(time * PARTICLE_CONFIG.animSpeedTime + i) * PARTICLE_CONFIG.animSpeedWave;
      }
      posAttr.needsUpdate = true;
      this.particles.rotation.y += PARTICLE_CONFIG.rotationSpeed;
    }
    if (this.skybox) {
      (this.skybox.material as THREE.ShaderMaterial).uniforms['time'].value = time * ANIMATION_CONFIG.msToSeconds;
    }
  }

  resize(width: number, height: number): void {
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    if (this.renderer) {
      // Re-apply pixel ratio: display switch / browser zoom can change
      // window.devicePixelRatio without recreating the renderer.
      this.renderer.setPixelRatio(clampPixelRatio(window.devicePixelRatio, SCENE_CONFIG.maxPixelRatio));
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

  // ----- Lights-only cleanup (for restart — scene re-uses same renderer/composer) -----

  disposeLights(): void {
    if (this.hemisphereLight) {
      this.scene.remove(this.hemisphereLight);
      this.hemisphereLight = undefined;
    }
    if (this.keyLight) {
      this.keyLight.shadow.map?.dispose();
      this.scene.remove(this.keyLight);
      this.keyLight = undefined;
    }
    if (this.fillLight) {
      this.scene.remove(this.fillLight);
      this.fillLight = undefined;
    }
    if (this.rimLight) {
      this.scene.remove(this.rimLight);
      this.rimLight = undefined;
    }
    if (this.underLight) {
      this.scene.remove(this.underLight);
      this.underLight = undefined;
    }
    for (const light of this.accentLights) {
      this.scene.remove(light);
    }
    this.accentLights = [];
  }

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
      disposeMesh(this.skybox);
      this.skybox = undefined;
    }
  }

  // ----- Full disposal (ngOnDestroy) -----

  dispose(): void {
    // Lights
    this.disposeLights();

    // Particles
    this.disposeParticles();

    // Skybox
    this.disposeSkybox();

    // Post-processing
    if (this.outputPass) {
      this.outputPass.dispose();
      this.outputPass = undefined;
    }
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
    this.onContextLost = null;
    this.onContextRestored = null;

    // Controls — detach user-added 'change' listener BEFORE dispose
    if (this.controls) {
      if (this.onControlsChange) {
        this.controls.removeEventListener('change', this.onControlsChange);
        this.onControlsChange = null;
      }
      this.controls.dispose();
    }

    // Renderer — remove canvas from DOM then dispose
    if (this.renderer) {
      if (this.renderer.domElement?.parentElement) {
        this.renderer.domElement.remove();
      }
      this.renderer.dispose();
    }
  }
}
