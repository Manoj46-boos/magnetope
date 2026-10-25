import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PCFSoftShadowMap,
  Scene,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  BoxGeometry,
  ConeGeometry,
  type Material,
} from 'three';
import type { FieldLook } from '@/config/cosmetics';
import { TUNING } from '@/config/tuning';
import { clamp, DEG, hypot2, lerp, type Vec2 } from '@/core/mathx';
import type { MagnoView } from '@/sim/magno';
import { cycleState, poseAt, toBodyFrame } from '@/sim/motion';
import type { Simulation } from '@/sim/simulation';
import type { PropCycle } from '@/sim/types';
import { gustForecast, windAcceleration } from '@/sim/wind';
import type { BuiltProp } from '@/sim/world';
import type { EndingFrame } from '@/game/ending';
import { ALL_LEVELS } from '@/levels';
import { Backdrop } from './backdrop';
import { blinkLook } from './blink-look';
import { CAMERA_FOV, CameraRig, type ShakeKind } from './camera-rig';
import { EndingStage } from './ending-stage';
import { GeometryBuilder } from './geometry';
import { GhostView } from './ghost-view';
import { braceAmount, grabPoint } from './hand-reach';
import { mountainLayout, pullbackFraming, type Framing } from './mountain';
import { CLASSIC_SKIN, MagnoRig, type CharacterBeat, type RigSkin } from './magno-rig';
import { PALETTES, fxTheme, toColor } from './palette';
import { PostStack } from './post-stack';
import type { PropPlacement } from '@/sim/types';
import { PROP_DEPTH, buildPropParts, type PropParts } from './prop-mesh';
import { CARD_GRADE } from './grade';
import { CARD_SKY, ThumbnailStage, cardDressProp, type ThumbnailVariant } from './thumbnail-scene';
import { PROFILES, type QualityProfile, type QualityTier } from './quality';
import { ResolutionGovernor, layoutStage } from './stage';
import { Vfx } from './vfx';
import { WindStreaks } from './wind-streaks';

/** MAGNO and effects are drawn just in front of the prop faces so geometry never hides them. */
const ACTOR_Z = PROP_DEPTH / 2 + 0.2;
/** The Core's beam is tall enough to be seen from far below, so the whole climb has a lighthouse to aim for. */
const CORE_BEAM_M = 90;

export interface FrameContext {
  alpha: number;
  dt: number;
  reducedMotion: boolean;
  /** 0 normal, 1 full slow motion; drives the camera dolly. */
  slowMo: number;
  rimTint: boolean;
  /** Where each ghost stands this frame; null hides it. */
  ghosts: { par: Vec2 | null; personal: Vec2 | null; friend: Vec2 | null };
  /** Set while the ending film plays; the camera and stage follow it instead of the climb. */
  ending?: EndingFrame | null;
}

interface PullStart {
  center: Vec2;
  visibleHeight: number;
}

interface BlinkVisual {
  cycle: PropCycle;
  body: MeshStandardMaterial;
  rim: MeshBasicMaterial | null;
  glow: MeshBasicMaterial | null;
}

/** A prop whose pose changes: a loose body, a scripted mover or a flickering sign. */
interface AnimatedVisual {
  prop: BuiltProp;
  group: Group;
  prev: { x: number; y: number; angle: number };
  cur: { x: number; y: number; angle: number };
  blink: BlinkVisual | null;
  /** What this surface does in answer to MAGNO, if anything, so the renderer can show it. */
  reaction: 'crumble' | 'boing' | 'glass' | null;
  /** Seconds since the last bounce. */
  boingAge: number;
  /** Seconds since the surface last re-formed. */
  popAge: number;
}

/** A rod from a pivot to a point on an animated prop: chains, crane cables. The pivot is fixed, or rides on another prop. */
interface Tether {
  mesh: Mesh;
  pivot: Vec2 | { on: AnimatedVisual; local: Vec2 };
  local: Vec2;
  visual: AnimatedVisual;
}

const TETHER_WIDTH = 0.07;
const GRAB_PROBE_EVERY_FRAMES = 3;
/** R-CH-02: the curiosity glance re-reads the world this often while settled; five hertz is plenty. */
const CURIOSITY_PROBE_EVERY_FRAMES = 12;
/** R-CH-02: steel further than this is scenery — the glance only aims at faces he could reach. */
const CURIOSITY_REACH_M = 12;
const NO_EXCLUDE: ReadonlySet<number> = new Set();
const POP_SECONDS = 0.32;
const SQUASH_SECONDS = 0.7;
const CABLE_RUN_M = 70;

export class SceneRenderer {
  readonly renderer: WebGLRenderer;
  readonly rig: MagnoRig;
  readonly cameraRig = new CameraRig();
  private readonly parGhost = new GhostView(new Color(0x9fe7ff), ACTOR_Z - 0.06);
  private readonly personalGhost = new GhostView(new Color(0xffc16b), ACTOR_Z - 0.04);
  private readonly friendGhost = new GhostView(new Color(0xe0a3ff), ACTOR_Z - 0.02);
  private readonly scene = new Scene();
  private readonly levelGroup = new Group();
  private readonly sun = new DirectionalLight(0xffffff, 1);
  private readonly hemi = new HemisphereLight(0xffffff, 0x444444, 1);
  private readonly fog = new FogExp2(0xffffff, 0.01);
  private readonly post: PostStack;
  private backdrop: Backdrop | null = null;
  private vfx: Vfx;
  private governor: ResolutionGovernor;
  private profile: QualityProfile;
  private sim: Simulation | null = null;
  private animated: AnimatedVisual[] = [];
  private animatedByProp = new Map<number, AnimatedVisual>();
  private tethers: Tether[] = [];
  private rimMeshes: Mesh[] = [];
  private glowMeshes: Mesh[] = [];
  private guideRings: Array<{ ring: Mesh; phase: number }> = [];
  private beacon: Group | null = null;
  private endingStage: EndingStage | null = null;
  private thumbnail: ThumbnailStage | null = null;
  private thumbnailDress: Group | null = null;
  private dressGuideStart = -1;
  /** Light, sky and bloom lift that carries the staged catch flash onto the captured card; the shell's own flash veil is a DOM layer the capture's photo mode hides. */
  private thumbFlash = 0;
  private pullStart: PullStart | null = null;
  private directed: Framing | null = null;
  private resolutionHeld = false;
  private baseFogDensity = 0;
  private flags: Array<{ cloth: Mesh; reached: boolean }> = [];
  private prevMagno: Vec2 = { x: 0, y: 0 };
  private curMagno: Vec2 = { x: 0, y: 0 };
  private readonly headScratch: Vec2 = { x: 0, y: 0 };
  private readonly grabScratch: Vec2 = { x: 0, y: 0 };
  private reachFrame = 0;
  private bodyMaterial: MeshStandardMaterial;
  private glassMaterial: MeshStandardMaterial;
  private rimMaterial: MeshBasicMaterial;
  private readonly glowMaterial: MeshBasicMaterial;
  private readonly tetherMaterial: MeshStandardMaterial;
  private readonly tetherGeometry = new BoxGeometry(TETHER_WIDTH, 1, TETHER_WIDTH);
  private readonly windStreaks: WindStreaks;
  private time = 0;
  private cssWidth = 1;
  private cssHeight = 1;
  private deviceRatio = 1;
  private flashAmount = 0;
  /** The same one-frame beats as the flash veil, carried by the bloom so the snap ident reads at gameplay strength (R-SM-03). */
  private beatFlash = 0;
  private frameMs = 16;
  private lastFrameStamp = 0;

  constructor(
    canvas: HTMLCanvasElement,
    tier: QualityTier,
    private readonly onShake: (kind: ShakeKind) => void = () => undefined,
    private readonly onCharacterBeat: (beat: CharacterBeat) => void = () => undefined,
  ) {
    this.profile = PROFILES[tier];
    this.renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    // Directional sun shadows. The shadow map is small (1024) and the shadow
    // camera is a tight 24x24 ortho that follows the player so the resolution
    // is spent where the action is. Tier-low devices skip shadows entirely via
    // the quality profile (see quality.ts) so the tier-low cold-load target holds.
    if (this.profile.shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = PCFSoftShadowMap;
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1024, 1024);
      this.sun.shadow.camera.near = 1;
      this.sun.shadow.camera.far = 80;
      this.sun.shadow.camera.left = -16;
      this.sun.shadow.camera.right = 16;
      this.sun.shadow.camera.top = 16;
      this.sun.shadow.camera.bottom = -16;
      this.sun.shadow.bias = -0.0008;
      this.sun.shadow.normalBias = 0.025;
    }
    this.governor = new ResolutionGovernor(this.profile.minResolutionScale);
    this.post = new PostStack(this.renderer, this.profile);

    this.scene.fog = this.fog;
    this.scene.add(this.levelGroup, this.sun, this.sun.target, this.hemi);
    this.bodyMaterial = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.78, metalness: 0.12 });
    this.glassMaterial = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    this.rimMaterial = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1.0, depthWrite: false, blending: AdditiveBlending });
    this.glowMaterial = new MeshBasicMaterial({ vertexColors: true, transparent: true, fog: false, toneMapped: false, depthWrite: false });
    this.tetherMaterial = new MeshStandardMaterial({ color: 0x59626b, flatShading: true, roughness: 0.6, metalness: 0.4 });
    applyToonShading(this.bodyMaterial);
    applyToonShading(this.tetherMaterial);

    this.rig = new MagnoRig(CLASSIC_SKIN);
    this.rig.root.position.z = ACTOR_Z;
    // MAGNO casts a shadow so the player reads his position in the world even
    // when he is airborne against a bright sky. The shadow follows the rig's
    // root, so it tracks every animation state without per-mesh bookkeeping.
    this.rig.root.traverse((o) => {
      if (o instanceof Mesh) o.castShadow = true;
    });
    this.scene.add(this.rig.root, this.parGhost.group, this.personalGhost.group, this.friendGhost.group);

    this.vfx = new Vfx(this.scene, this.profile, ACTOR_Z + 0.08, {
      shake: (kind) => this.onShake(kind),
      // Only the snap ident rides the bloom: the staged beats keep their veil,
      // so a catch never washes the pole colours the silhouette lives on.
      flash: (amount) => {
        this.flashAmount = Math.max(this.flashAmount, amount);
        this.beatFlash = Math.max(this.beatFlash, amount);
      },
    });
    this.windStreaks = new WindStreaks(this.scene, ACTOR_Z + 0.12);
    this.windStreaks.setCeiling(this.profile.windStreaks);
  }

  triggerFlash(amount: number): void {
    this.flashAmount = Math.max(this.flashAmount, amount);
  }

  get flash(): number {
    return this.flashAmount;
  }

  get tier(): QualityTier {
    return this.profile.tier;
  }

  setSkin(skin: RigSkin): void {
    this.rig.applySkin(skin);
  }

  /** Equips a field-line colour set; `null` restores the classic cyan and amber. */
  setFieldColors(look: FieldLook | null): void {
    fxTheme.setField(look);
    this.vfx.syncTheme();
  }

  setChargeMeterVisible(visible: boolean): void {
    this.rig.setChargeMeterVisible(visible);
  }

  setQuality(tier: QualityTier): void {
    this.profile = PROFILES[tier];
    this.vfx.applyProfile(this.profile);
    this.windStreaks.setCeiling(this.profile.windStreaks);
    this.governor = new ResolutionGovernor(this.profile.minResolutionScale);
    this.post.setProfile(this.profile);
    this.applySize();
  }

  /** Builds visuals for a freshly created simulation. */
  load(sim: Simulation): void {
    this.clearLevel();
    this.sim = sim;
    const level = sim.level;
    const palette = PALETTES[level.biome];

    toColor(palette.sunColor, this.sun.color);
    this.sun.intensity = palette.sunIntensity;
    const el = palette.sunElevation * DEG;
    this.sun.position.set(-Math.cos(el) * 14, Math.sin(el) * 22 + 6, 18);
    toColor(palette.hemiSky, this.hemi.color);
    toColor(palette.hemiGround, this.hemi.groundColor);
    this.hemi.intensity = palette.hemiIntensity;
    toColor(palette.fog, this.fog.color);
    this.baseFogDensity = palette.fogDensity * 0.09;
    this.fog.density = this.baseFogDensity;
    this.scene.background = toColor(palette.skyHorizon);
    this.post.setBiome(level.biome);

    this.backdrop?.dispose();
    this.backdrop = new Backdrop(level.biome, level.index * 97 + 5);
    this.scene.add(this.backdrop.group);

    this.vfx.setBiome(palette);
    this.vfx.bind(sim);
    this.vfx.reset();
    const fog = toColor(palette.fog);
    this.windStreaks.setTint([lerp(fog.r, 1, 0.55), lerp(fog.g, 1, 0.55), lerp(fog.b, 1, 0.55)], fxTheme.bright);

    this.buildProps(sim, palette);
    this.buildBeacon(level.summit, Boolean(level.finale));
    this.buildFlags(level.checkpoints);
    this.buildGuides(level.guides ?? []);
    this.bindRig(sim);

    const start = sim.magno.view.position;
    this.prevMagno = { ...start };
    this.curMagno = { ...start };
    this.cameraRig.snapTo(start);
  }

  private bindRig(sim: Simulation): void {
    sim.events.on('attach', (e) => {
      this.rig.onAttach(e.normal);
      // The catch settle (R-GF-04) rides the snap: the click eases the lens in and back out.
      if (e.viaSnap) this.cameraRig.settle();
    });
    sim.events.on('repel', (e) => {
      this.rig.onRepel(e.direction, e.power);
      // The full-power release owns the camera beats (R-GF-01): a lunge along the flight and a brief wide lens.
      if (e.power >= 1) {
        this.cameraRig.kick(e.direction);
        this.cameraRig.pop();
      }
    });
    sim.events.on('impact', (e) => this.rig.onImpact(e.normal, e.speed));
    sim.events.on('crumbleWarn', (e) => {
      // R-CH-03: the failing surface under him earns the wary face — the pupil
      // darts to the very prop the physics is warning about.
      const prop = sim.physics.props[e.propIndex];
      if (prop) this.rig.setWary({ x: prop.placement.x, y: prop.placement.y });
    });
    sim.events.on('boing', (e) => {
      const visual = this.animatedByProp.get(e.propIndex);
      if (visual) visual.boingAge = 0;
    });
    sim.events.on('restore', (e) => {
      const visual = this.animatedByProp.get(e.propIndex);
      if (visual) visual.popAge = 0;
    });
    sim.events.on('summit', () => {
      this.rig.onClear();
      this.vfx.celebrate({ x: sim.level.summit.x, y: sim.level.summit.y });
    });
  }

  private buildProps(sim: Simulation, palette: (typeof PALETTES)['scrapyard']): void {
    const seed = sim.level.index * 31 + sim.level.biome.length;
    const merged = { body: new GeometryBuilder(), glass: new GeometryBuilder(), rim: new GeometryBuilder(), glow: new GeometryBuilder() };

    for (const prop of sim.physics.props) {
      const parts = buildPropParts(prop, palette, seed);
      const placement = prop.placement;
      if (prop.dynamic || prop.moving || placement.cycle || prop.kind.reaction || prop.material.breakable) {
        this.addAnimated(prop, parts, merged.body);
        continue;
      }
      const rot = placement.rot ?? 0;
      merged.body.append(parts.body, placement.x, placement.y, rot);
      merged.glass.append(parts.glass, placement.x, placement.y, rot);
      merged.rim.append(parts.rim, placement.x, placement.y, rot);
      merged.glow.append(parts.glow, placement.x, placement.y, rot);
      if (placement.glow) this.addGlow(prop);
    }

    const add = (builder: GeometryBuilder, material: MeshStandardMaterial | MeshBasicMaterial, order: number): Mesh | null => {
      if (builder.triangleCount === 0) return null;
      const mesh = new Mesh(builder.toGeometry(), material);
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      // The prop body and tether cast and receive the directional sun shadow.
      // Rim and glow passes are MeshBasicMaterial and stay out of the shadow
      // pass so they keep their additive read against bright skies.
      if (material === this.bodyMaterial || material === this.tetherMaterial) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
      this.levelGroup.add(mesh);
      return mesh;
    };
    add(merged.body, this.bodyMaterial, 0);
    add(merged.glass, this.glassMaterial, 5);
    add(merged.glow, this.glowMaterial, 3);
    const rimMesh = add(merged.rim, this.rimMaterial, 6);
    if (rimMesh) this.rimMeshes.push(rimMesh);
  }

  private addAnimated(prop: BuiltProp, parts: PropParts, cables: GeometryBuilder): void {
    const placement = prop.placement;
    const cycle = placement.cycle;
    const group = new Group();

    const bodyMaterial = cycle ? this.bodyMaterial.clone() : this.bodyMaterial;
    if (cycle) bodyMaterial.transparent = true;
    group.add(new Mesh(parts.body.toGeometry(), bodyMaterial));
    if (parts.glass.triangleCount > 0) group.add(new Mesh(parts.glass.toGeometry(), this.glassMaterial));

    let rimMaterial: MeshBasicMaterial | null = null;
    if (parts.rim.triangleCount > 0) {
      rimMaterial = cycle ? this.rimMaterial.clone() : this.rimMaterial;
      const rimMesh = new Mesh(parts.rim.toGeometry(), rimMaterial);
      rimMesh.renderOrder = 6;
      this.rimMeshes.push(rimMesh);
      group.add(rimMesh);
    }

    let glowMaterial: MeshBasicMaterial | null = null;
    if (parts.glow.triangleCount > 0) {
      glowMaterial = cycle ? this.glowMaterial.clone() : this.glowMaterial;
      const glowMesh = new Mesh(parts.glow.toGeometry(), glowMaterial);
      glowMesh.renderOrder = 3;
      group.add(glowMesh);
    }

    this.levelGroup.add(group);
    const start = poseAt(placement, 0);
    const state = { x: start.x, y: start.y, angle: start.rot };
    const visual: AnimatedVisual = {
      prop,
      group,
      prev: { ...state },
      cur: { ...state },
      blink: cycle ? { cycle, body: bodyMaterial, rim: rimMaterial, glow: glowMaterial } : null,
      reaction: prop.material.breakable ? 'glass' : prop.kind.reaction?.type ?? null,
      boingAge: Infinity,
      popAge: Infinity,
    };
    this.animated.push(visual);
    this.animatedByProp.set(prop.index, visual);
    this.addTethers(visual);
    this.addCables(prop, cables);
  }

  private newTether(): Mesh {
    const mesh = new Mesh(this.tetherGeometry, this.tetherMaterial);
    mesh.frustumCulled = false;
    mesh.position.z = -0.12;
    this.levelGroup.add(mesh);
    return mesh;
  }

  /** Chains for hung props and cables for swinging ones: a rod from the pivot to the prop, re-aimed every frame. */
  private addTethers(visual: AnimatedVisual): void {
    const { placement, width, height } = visual.prop;
    if (placement.pin) {
      const tag = placement.pin.tag;
      const on = this.animated.find((other) => other.prop.placement.tag === tag);
      if (!on) return;
      const local = toBodyFrame(poseAt(on.prop.placement, 0), placement.pin.at);
      for (const side of [-1, 1]) {
        this.tethers.push({ mesh: this.newTether(), pivot: { on, local }, local: { x: side * (width / 2 - 0.2), y: height / 2 }, visual });
      }
    } else if (placement.hinge && visual.prop.kind.tilt) {
      this.addPivot(placement.hinge, visual.prop);
    } else if (placement.hinge) {
      for (const side of [-1, 1]) {
        this.tethers.push({ mesh: this.newTether(), pivot: placement.hinge, local: { x: side * (width / 2 - 0.2), y: height / 2 }, visual });
      }
    } else if (placement.motion?.type === 'swing') {
      this.tethers.push({ mesh: this.newTether(), pivot: placement.motion.pivot, local: { x: 0, y: height / 2 }, visual });
    }
  }

  /** A board's pivot: a stout post and a pin under the hinge, so an end-hinged board is plainly fixed to something. */
  private addPivot(hinge: Vec2, prop: BuiltProp): void {
    if (Math.abs(hinge.x - prop.placement.x) < prop.width * 0.2) return;
    const post = new GeometryBuilder();
    const iron: [number, number, number] = [0.3, 0.33, 0.37];
    post.box(0, -1.2, -0.1, 0.5, 2.4, 0.5, iron);
    post.disc(0, 0, 0, 0.3, 0.8, 10, [0.42, 0.45, 0.5]);
    post.disc(0, 0, 0.44, 0.1, 0.1, 6, [0.78, 0.8, 0.84]);
    const mesh = new Mesh(post.toGeometry(), this.bodyMaterial);
    mesh.position.set(hinge.x, hinge.y, 0);
    mesh.frustumCulled = false;
    this.levelGroup.add(mesh);
  }

  /** Vertical movers ride fixed cables that run off the top of the screen. */
  private addCables(prop: BuiltProp, out: GeometryBuilder): void {
    const { placement, width, height } = prop;
    const motion = placement.motion ?? (placement.follow ? { ...placement.follow, type: 'slide' as const } : undefined);
    if (motion?.type !== 'slide' || motion.dx !== 0 || motion.dy === 0) return;
    const top = Math.max(placement.y, placement.y + motion.dy) + height / 2;
    const offsets = prop.kind.id === 'counterweight' ? [0] : [-(width / 2 - 0.25), width / 2 - 0.25];
    const colour: [number, number, number] = [0.28, 0.31, 0.35];
    for (const dx of offsets) out.box(placement.x + dx, top + CABLE_RUN_M / 2, -0.12, TETHER_WIDTH, CABLE_RUN_M, TETHER_WIDTH, colour);
  }

  private addGlow(prop: BuiltProp): void {
    const w = prop.width + 0.35;
    const h = prop.height + 0.35;
    const material = new MeshBasicMaterial({
      color: new Color(1, 0.86, 0.4),
      transparent: true,
      opacity: 0.2,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new Mesh(new BoxGeometry(w, h, PROP_DEPTH + 0.1), material);
    mesh.position.set(prop.placement.x, prop.placement.y, 0);
    mesh.rotation.z = prop.placement.rot ?? 0;
    mesh.renderOrder = 4;
    this.levelGroup.add(mesh);
    this.glowMeshes.push(mesh);
  }

  /** The collection beacon: gold crystal and rings, or at the climb's end MAGNO's own power core, cold and bright like a lighthouse. */
  private buildBeacon(summit: { x: number; y: number; radius: number }, core: boolean): void {
    const beacon = new Group();
    const gold = core ? new Color().setHSL(0.5, 0.95, 0.58) : new Color().setHSL(0.12, 1, 0.68);
    const crystal = new Mesh(
      core ? new IcosahedronGeometry(0.8, 0) : new OctahedronGeometry(0.55, 0),
      new MeshStandardMaterial({ color: gold, emissive: gold, emissiveIntensity: core ? 1.15 : 1.1, flatShading: true, roughness: 0.2, metalness: 0.4 }),
    );
    if (!core) crystal.scale.set(0.8, 1.15, 0.8);
    const ring = new Mesh(
      new TorusGeometry(1.0, 0.045, 5, 28),
      new MeshBasicMaterial({ color: gold, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }),
    );
    const ring2 = new Mesh(ring.geometry, ring.material);
    ring2.scale.setScalar(1.45);
    const pillar = new Mesh(
      new CylinderGeometry(0.42, 0.9, core ? CORE_BEAM_M : 16, 10, 1, true),
      new MeshBasicMaterial({ color: gold, transparent: true, opacity: core ? 0.16 : 0.1, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
    );
    pillar.position.y = (core ? CORE_BEAM_M : 16) / 2;
    beacon.add(pillar, crystal, ring, ring2);
    beacon.position.set(summit.x, summit.y, ACTOR_Z - 0.1);
    this.levelGroup.add(beacon);
    this.beacon = beacon;
  }

  /** Pulsing field rings that contract onto a point, like a field closing on a magnet: where to stick first. */
  private buildGuides(points: ReadonlyArray<{ x: number; y: number }>): void {
    const geometry = new TorusGeometry(1, 0.035, 5, 32);
    points.forEach((point, index) => {
      for (let i = 0; i < 3; i++) {
        const material = new MeshBasicMaterial({
          color: new Color().setHSL(index % 2 === 0 ? 0.52 : 0.07, 0.95, 0.62),
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        });
        const ring = new Mesh(geometry, material);
        ring.position.set(point.x, point.y, ACTOR_Z - 0.12);
        ring.renderOrder = 5;
        this.levelGroup.add(ring);
        this.guideRings.push({ ring, phase: i / 3 + index * 0.17 });
      }
    });
  }

  private animateGuides(): void {
    for (const { ring, phase } of this.guideRings) {
      const u = (this.time / 1.8 + phase) % 1;
      ring.scale.setScalar(1.5 - 1.2 * u);
      (ring.material as MeshBasicMaterial).opacity = 0.65 * Math.sin(u * Math.PI);
    }
  }

  private buildFlags(points: ReadonlyArray<{ x: number; y: number }>): void {
    for (const point of points) {
      const group = new Group();
      const pole = new Mesh(new BoxGeometry(0.08, 1.6, 0.08), new MeshStandardMaterial({ color: 0xcfd6dc, flatShading: true }));
      pole.position.y = 0.8;
      const cloth = new Mesh(
        new ConeGeometry(0.4, 0.8, 3),
        new MeshStandardMaterial({ color: 0x6f7b86, flatShading: true, emissive: 0x000000 }),
      );
      cloth.rotation.z = -Math.PI / 2;
      cloth.position.set(0.36, 1.3, 0);
      group.add(pole, cloth);
      group.position.set(point.x - 2.2, point.y, -1.2);
      this.levelGroup.add(group);
      this.flags.push({ cloth, reached: false });
    }
  }

  private clearLevel(): void {
    this.dropEndingStage();
    this.vfx.unbind();
    this.levelGroup.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        const material = o.material as { dispose(): void; userData?: { shared?: boolean } };
        const shared = [this.bodyMaterial, this.glassMaterial, this.rimMaterial, this.glowMaterial, this.tetherMaterial];
        if (!shared.includes(material as MeshStandardMaterial)) material.dispose();
      }
    });
    this.levelGroup.clear();
    if (this.backdrop) {
      this.scene.remove(this.backdrop.group);
      this.backdrop.dispose();
      this.backdrop = null;
    }
    this.animated = [];
    this.animatedByProp.clear();
    this.tethers = [];
    this.windStreaks.clear();
    this.rimMeshes = [];
    this.glowMeshes = [];
    this.guideRings = [];
    this.flags = [];
    this.beacon = null;
  }

  /** Sets the stage for the ending: the loose core, the bloom, the beam and the whole mountain. */
  beginEnding(): void {
    if (!this.sim || this.endingStage) return;
    this.endingStage = new EndingStage(mountainLayout(ALL_LEVELS), this.profile.tier === 'low');
    this.scene.add(this.endingStage.group);
    this.pullStart = null;
    if (this.beacon) this.beacon.visible = false;
  }

  /** Puts the climb back as it was, e.g. when the film is skipped or has finished. */
  endEnding(): void {
    if (!this.endingStage) return;
    this.dropEndingStage();
    if (this.sim) this.cameraRig.snapTo(this.sim.magno.view.position);
  }

  private dropEndingStage(): void {
    const stage = this.endingStage;
    if (!stage) return;
    this.scene.remove(stage.group);
    stage.dispose();
    this.endingStage = null;
    this.pullStart = null;
    if (this.beacon) this.beacon.visible = true;
    this.rig.setCoreLight(0);
    this.rig.setJoy(0);
    this.fog.density = this.baseFogDensity;
  }

  /** The seat moment of the film: a flash, a ring through the sky and a shower of sparks from the chest. */
  burstAtChest(): void {
    const chest = this.rig.chestWorld();
    this.vfx.celebrate(chest);
    this.vfx.rings.spawn(chest.x, chest.y, 0.3, 14, 1.9, [0.7, 0.96, 1], 0, 1);
    this.vfx.rings.spawn(chest.x, chest.y, 0.2, 7, 1.2, [1, 0.97, 0.85], 0, 1);
    this.triggerFlash(1);
    this.onShake('big');
  }

  /** Enters the store-card composition scene (PRD 17.3): staged sky, card LUT, staged pose. */
  enterThumbnail(variant: ThumbnailVariant, ident = false): void {
    this.exitThumbnail();
    if (!this.sim) return;
    this.thumbnail = new ThumbnailStage(variant, ident);
    const sky = CARD_SKY;
    const palette = PALETTES[this.sim.level.biome];
    this.backdrop?.gradeSky({ ...sky.top }, { ...sky.horizon }, { ...sky.sun });
    this.backdrop?.setAmbientVisible(this.thumbnail.ambientSky);
    this.post.setGrade(CARD_GRADE);
    // The card is a dusk shot: the graded sky goes deep amber behind a thin fog,
    // while a hotter key light keeps MAGNO and the junk stack lit (R-TH-05).
    this.sun.intensity = palette.sunIntensity * 2.6;
    this.hemi.intensity = palette.hemiIntensity * 0.9;
    this.fog.density = this.baseFogDensity * 0.55;
    this.flashAmount = 0;
    this.thumbFlash = 0;
    this.buildThumbnailDress(this.thumbnail.dress, this.thumbnail.guide);
  }

  /** Puts the world's own grade, sky and pose back; the follow camera resumes on its own. */
  exitThumbnail(): void {
    if (!this.thumbnail) return;
    this.thumbnail = null;
    const dress = this.thumbnailDress;
    if (dress) {
      this.scene.remove(dress);
      const shared: Material[] = [this.bodyMaterial, this.glassMaterial, this.rimMaterial, this.glowMaterial, this.tetherMaterial];
      dress.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        o.geometry.dispose();
        if (!shared.includes(o.material as Material)) (o.material as Material).dispose();
      });
      this.thumbnailDress = null;
    }
    this.guideRings.splice(this.dressGuideStart).forEach((entry) => {
      this.levelGroup.remove(entry.ring);
      entry.ring.geometry.dispose();
      (entry.ring.material as Material).dispose();
    });
    this.dressGuideStart = -1;
    this.rig.setJoy(0);
    this.rig.setBrace(0);
    this.rig.setGrab(null);
    if (this.sim) {
      const palette = PALETTES[this.sim.level.biome];
      this.sun.intensity = palette.sunIntensity;
      this.hemi.intensity = palette.hemiIntensity;
      this.fog.density = this.baseFogDensity;
      this.backdrop?.setAmbientVisible(true);
      this.backdrop?.applyBiome(this.sim.level.biome);
      this.post.setBiome(this.sim.level.biome);
    }
  }

  /** Builds the composition scene's staged props with the game's own dressing rules. */
  private buildThumbnailDress(placements: readonly PropPlacement[], guide: { x: number; y: number } | null): void {
    if (!this.sim) return;
    this.dressGuideStart = this.guideRings.length;
    if (guide) this.buildDressGuide(guide);
    if (placements.length === 0) return;
    const palette = PALETTES[this.sim.level.biome];
    const merged = { body: new GeometryBuilder(), glass: new GeometryBuilder(), rim: new GeometryBuilder(), glow: new GeometryBuilder() };
    placements.forEach((placement, index) => {
      const parts = buildPropParts(cardDressProp(placement, index), palette, 97);
      const rot = placement.rot ?? 0;
      merged.body.append(parts.body, placement.x, placement.y, rot);
      merged.glass.append(parts.glass, placement.x, placement.y, rot);
      merged.rim.append(parts.rim, placement.x, placement.y, rot);
      merged.glow.append(parts.glow, placement.x, placement.y, rot);
    });
    const group = new Group();
    const add = (builder: GeometryBuilder, material: Material, order: number, shadow: boolean): void => {
      if (builder.triangleCount === 0) return;
      const mesh = new Mesh(builder.toGeometry(), material);
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      mesh.castShadow = shadow;
      mesh.receiveShadow = shadow;
      group.add(mesh);
    };
    // The rim stays out of rimMeshes on purpose: the card keeps its magnetic
    // affordance even when the player's rim-tint setting is off.
    add(merged.body, this.bodyMaterial, 0, true);
    add(merged.glass, this.glassMaterial, 5, false);
    add(merged.glow, this.glowMaterial, 3, false);
    add(merged.rim, this.rimMaterial, 6, false);
    this.scene.add(group);
    this.thumbnailDress = group;
  }

  /** A tight two-ring bullseye at the catch point, sized for the card where the gameplay rings would read as abstract circles. */
  private buildDressGuide(point: { x: number; y: number }): void {
    const geometry = new TorusGeometry(0.42, 0.03, 5, 28);
    for (let i = 0; i < 2; i++) {
      const material = new MeshBasicMaterial({ color: new Color().setHSL(0.52, 0.95, 0.66), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
      const ring = new Mesh(geometry, material);
      ring.position.set(point.x, point.y, ACTOR_Z - 0.12);
      ring.renderOrder = 5;
      this.levelGroup.add(ring);
      this.guideRings.push({ ring, phase: i / 2 });
    }
  }

  /** Records the post-step transforms that rendering interpolates between. */
  captureStep(): void {
    if (!this.sim) return;
    this.prevMagno = this.curMagno;
    const p = this.sim.magno.view.position;
    this.curMagno = { x: p.x, y: p.y };
    for (const visual of this.animated) {
      const body = this.sim.physics.world.getRigidBody(visual.prop.bodyHandle);
      const t = body.translation();
      const q = body.rotation();
      visual.prev = visual.cur;
      visual.cur = { x: t.x, y: t.y, angle: 2 * Math.atan2(q.z, q.w) };
    }
  }

  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void {
    this.cssWidth = Math.max(1, cssWidth);
    this.cssHeight = Math.max(1, cssHeight);
    this.deviceRatio = devicePixelRatio;
    this.cameraRig.setLayout(layoutStage(this.cssWidth, this.cssHeight));
    this.applySize();
  }

  private applySize(): void {
    const ratio = Math.min(this.deviceRatio, this.profile.maxPixelRatio) * this.governor.scale;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(this.cssWidth, this.cssHeight, false);
    const buffer = this.renderer.getDrawingBufferSize(new Vector2());
    this.post.setSize(buffer.x, buffer.y);
    this.vfx.setViewport(this.cssHeight, CAMERA_FOV, ratio);
  }

  /** Pins the render scale, so captures are never softened by a slow machine. */
  holdResolution(held: boolean): void {
    this.resolutionHeld = held;
    if (held && this.governor.scale !== 1) {
      this.governor.scale = 1;
      this.applySize();
    }
  }

  /** Holds the camera on a fixed framing, for thumbnails and trailers; `null` returns to the follow shot. */
  directCamera(framing: Framing | null): void {
    this.directed = framing;
    if (!framing && this.sim) this.cameraRig.snapTo(this.sim.magno.view.position);
  }

  /** Hands the camera back to the follow shot without a cut, letting the rig ease home from the last framing. */
  releaseCamera(): void {
    this.directed = null;
  }

  /** MAGNO's attention hop for the idle ladder (PRD 15.3): presentation only, the simulation never hears about it. */
  attentionHop(): void {
    this.rig.attentionHop();
  }

  /** MAGNO in CSS pixels, for cursor-relative aim and HUD anchoring. */
  playerScreen(): Vec2 | null {
    if (!this.sim) return null;
    const v = new Vector3(this.rig.root.position.x, this.rig.root.position.y, this.rig.root.position.z).project(this.cameraRig.camera);
    return { x: ((v.x + 1) / 2) * this.cssWidth, y: ((1 - v.y) / 2) * this.cssHeight };
  }

  /** World-to-screen for HUD elements such as the altitude rail. */
  project(x: number, y: number, z = 0): Vec2 {
    const v = new Vector3(x, y, z).project(this.cameraRig.camera);
    return { x: ((v.x + 1) / 2) * this.cssWidth, y: ((1 - v.y) / 2) * this.cssHeight };
  }

  frame(ctx: FrameContext): void {
    const sim = this.sim;
    if (!sim) return;
    const now = performance.now();
    if (this.lastFrameStamp && !this.resolutionHeld) {
      this.frameMs = now - this.lastFrameStamp;
      const before = this.governor.scale;
      const scale = this.governor.push(Math.min(this.frameMs, 100));
      if (scale !== before) this.applySize();
    }
    this.lastFrameStamp = now;

    this.time += ctx.dt;
    this.flashAmount = Math.max(0, this.flashAmount - ctx.dt * 7);

    const view = sim.magno.view;
    const alpha = ctx.alpha;
    const pos = {
      x: lerp(this.prevMagno.x, this.curMagno.x, alpha),
      y: lerp(this.prevMagno.y, this.curMagno.y, alpha),
    };

    this.cameraRig.reducedMotion = ctx.reducedMotion;
    const ending = this.endingStage ? ctx.ending ?? null : null;
    if (this.thumbnail) {
      this.frameThumbnail(ctx);
    } else {
      if (this.directed && !ending) {
        this.cameraRig.direct(this.directed.center, this.directed.visibleHeight, this.directed.rollDeg);
      } else if (ending) {
        this.frameEndingCamera(ending, pos, ctx.dt, sim);
      } else {
        const falling = view.velocity.y < -9 && !view.attachNormal;
        this.cameraRig.update(pos, view.velocity, ctx.dt, {
          falling,
          slowMo: ctx.slowMo,
          charge: view.state === 'charging' ? view.charge01 : 0,
          bounds: sim.level.bounds,
        });
      }

      this.reachHands(sim, view);
      this.rig.update(view, pos, ctx.dt, ctx.reducedMotion);
      this.idlePerformance(sim, view);
      this.vfx.update(ctx.dt, view, this.rig.headWorld(this.headScratch), view.visualAngle);
      if (ending) this.poseEnding(ending, sim);
      // The gameplay flash ident rides the bloom: a halo with the catch burst,
      // spent in a fraction of a second and never enough to wash the frame.
      this.beatFlash = Math.max(0, this.beatFlash - ctx.dt * 2.5);
      this.post.setBloomBoost(this.beatFlash * 0.6);
    }
    this.parGhost.update(ctx.ghosts.par, ctx.dt);
    this.personalGhost.update(ctx.ghosts.personal, ctx.dt);
    this.friendGhost.update(ctx.ghosts.friend, ctx.dt);

    for (const mesh of this.rimMeshes) mesh.visible = ctx.rimTint;
    for (const visual of this.animated) this.poseAnimated(visual, alpha, ctx.dt, ctx.reducedMotion);
    for (const tether of this.tethers) this.poseTether(tether, alpha);
    const running = sim.run.started && !sim.run.cleared;
    const clockMs = sim.hazardClockMs + (running ? alpha * (1000 / TUNING.sim.hz) : 0);
    this.animateBlinkers(clockMs, ctx.reducedMotion);
    this.animateWind(sim, view, clockMs, ctx.dt);
    this.animateBeacon();
    this.animateGlow();
    this.animateGuides();
    this.updateFlags(sim);
    const altitude = this.thumbnail ? this.thumbnail.altitude : Math.min(1, Math.max(0, view.position.y / Math.max(1, sim.level.summit.y)));
    this.backdrop?.update(this.cameraRig.camera, ctx.dt, altitude);

    const camera = this.cameraRig.camera;
    this.sun.target.position.set(camera.position.x - 3.4, camera.position.y - 1.4, 0);
    this.sun.position.set(camera.position.x - 12, camera.position.y + 18, 18);
    this.post.render(this.scene, camera);
  }

  /** One staged frame of the composition scene: the stage owns camera, pose and field lines. */
  private frameThumbnail(ctx: FrameContext): void {
    const staged = this.thumbnail!.step(ctx.dt * 1000);
    // The ident's catch flash rides the sky grade, the key light and the bloom, decaying
    // on the shell veil's own curve: the post pipeline tone maps nothing, so the renderer's
    // exposure knob cannot reach the captured pixels.
    this.thumbFlash = Math.max(0, this.thumbFlash - ctx.dt * 7);
    if (staged.flash > 0) {
      this.triggerFlash(staged.flash);
      this.thumbFlash = Math.max(this.thumbFlash, staged.flash);
    }
    // A flash bright enough to punctuate the catch in a 3 s loop, never enough to
    // white out the frame: the sky lifts a little, the key light flares the
    // subject, the bloom adds a halo — the scene stays legible through the beat.
    const lift = this.thumbFlash * 7;
    this.backdrop?.gradeSky(
      { h: CARD_SKY.top.h, s: CARD_SKY.top.s, l: CARD_SKY.top.l + lift },
      { h: CARD_SKY.horizon.h, s: CARD_SKY.horizon.s, l: CARD_SKY.horizon.l + lift },
      { h: CARD_SKY.sun.h, s: CARD_SKY.sun.s, l: CARD_SKY.sun.l + lift },
    );
    const palette = PALETTES[this.sim!.level.biome];
    this.sun.intensity = palette.sunIntensity * 2.6 * (1 + this.thumbFlash * 0.35);
    this.post.setBloomBoost(this.thumbFlash * 1.2);
    this.cameraRig.direct(staged.framing.center, staged.framing.visibleHeight, staged.framing.rollDeg ?? 0);
    this.rig.setBrace(0);
    this.rig.setGrab(null);
    this.rig.setJoy(staged.joy);
    if (staged.blink) this.rig.blink();
    if (staged.flash > 0) this.triggerFlash(staged.flash);
    this.rig.update(staged.view, staged.view.position, ctx.dt, ctx.reducedMotion);
    this.vfx.update(ctx.dt, staged.view, this.rig.headWorld(this.headScratch), staged.view.visualAngle);
  }

  /** Holds the follow shot until the pull-back begins, then flies out along a path that ends on the whole mountain. */
  private frameEndingCamera(ending: EndingFrame, pos: Vec2, dt: number, sim: Simulation): void {
    const rig = this.cameraRig;
    if (ending.pull <= 0) {
      rig.update(pos, { x: 0, y: 0 }, dt, { falling: false, slowMo: 0, bounds: sim.level.bounds });
      return;
    }
    this.pullStart ??= { center: rig.focus, visibleHeight: rig.verticalExtent };
    const layout = this.endingStage!.mountain.layout;
    const framing: Framing = pullbackFraming(ending.pull, this.pullStart.center, this.pullStart.visibleHeight, layout, rig.camera.aspect);
    rig.direct(framing.center, framing.visibleHeight);
    const stretch = framing.visibleHeight / this.pullStart.visibleHeight;
    this.fog.density = this.baseFogDensity / stretch ** 1.15;
  }

  private poseEnding(ending: EndingFrame, sim: Simulation): void {
    const stage = this.endingStage;
    if (!stage) return;
    this.rig.setCoreLight(ending.chestGlow);
    this.rig.setJoy(ending.coreLoose ? 0 : 1);
    stage.apply({
      frame: ending,
      summit: sim.level.summit,
      chest: this.rig.chestWorld(),
      head: this.rig.headWorld(),
      axisAngle: sim.magno.view.visualAngle,
      cameraDistance: this.cameraRig.camera.position.z,
      time: this.time,
      actorZ: ACTOR_Z,
    });
  }

  /** Hands anticipate contact: bracing for a landing (every frame, one ray), reaching for a steel face (every third). */
  private reachHands(sim: Simulation, view: MagnoView): void {
    this.rig.setBrace(braceAmount(view, sim.physics));
    if (this.reachFrame++ % GRAB_PROBE_EVERY_FRAMES === 0) this.rig.setGrab(grabPoint(view, sim.physics, this.grabScratch));
  }

  /** R-CH-02: the settled glance aims at real steel, and the character beat leaves the render layer as one callback. */
  private idlePerformance(sim: Simulation, view: MagnoView): void {
    const settled = view.state === 'attached' && !view.limp && hypot2(view.velocity.x, view.velocity.y) < TUNING.character.idleSpeed;
    if (settled) {
      if (this.reachFrame % CURIOSITY_PROBE_EVERY_FRAMES === 0) {
        let best: Vec2 | null = null;
        let bestDist = CURIOSITY_REACH_M;
        for (const candidate of sim.physics.snapCandidates(view.position, NO_EXCLUDE)) {
          if (candidate.distance >= bestDist) continue;
          bestDist = candidate.distance;
          best = candidate.point;
        }
        this.rig.setCuriosity(best);
      }
    } else {
      this.rig.setCuriosity(null);
    }
    const beat = this.rig.takeCharacterBeat();
    if (beat) this.onCharacterBeat(beat);
  }

  private poseAnimated(visual: AnimatedVisual, alpha: number, dt: number, reducedMotion: boolean): void {
    const x = lerp(visual.prev.x, visual.cur.x, alpha);
    const y = lerp(visual.prev.y, visual.cur.y, alpha);
    visual.group.position.set(x, y, 0);
    visual.group.rotation.z = visual.cur.angle;
    if (visual.reaction) this.poseReaction(visual, dt, reducedMotion);
  }

  /** Shows what a reactive surface is doing: a shiver before it crumbles, a squash when it throws MAGNO, a pop when it re-forms, nothing once it is gone. */
  private poseReaction(visual: AnimatedVisual, dt: number, reducedMotion: boolean): void {
    const sim = this.sim;
    if (!sim) return;
    const group = visual.group;
    visual.boingAge += dt;
    visual.popAge += dt;

    if (visual.reaction === 'glass') {
      group.visible = sim.physics.isIntact(visual.prop);
      return;
    }

    let sx = 1;
    let sy = 1;
    if (visual.reaction === 'crumble') {
      const { stress, gone } = sim.reactive.crumbleView(visual.prop.index);
      group.visible = !gone;
      const shiver = clamp((stress - 0.3) / 0.7, 0, 1);
      if (shiver > 0 && !reducedMotion) {
        const seed = visual.prop.index * 1.7;
        group.position.x += Math.sin(this.time * 71 + seed) * 0.05 * shiver;
        group.position.y += Math.sin(this.time * 53 + seed) * 0.035 * shiver;
        group.rotation.z += Math.sin(this.time * 61 + seed) * 0.012 * shiver;
      } else if (shiver > 0) {
        sy = 1 - 0.03 * shiver * (0.5 + 0.5 * Math.sin(this.time * 9));
      }
      if (visual.popAge < POP_SECONDS) {
        const t = visual.popAge / POP_SECONDS;
        sx = sy = reducedMotion ? 1 : 0.6 + 0.4 * (1 - (1 - t) ** 3) + 0.08 * Math.sin(t * Math.PI);
      }
    } else if (visual.reaction === 'boing' && visual.boingAge < SQUASH_SECONDS && !reducedMotion) {
      const k = Math.exp(-9 * visual.boingAge) * Math.cos(26 * visual.boingAge);
      sx = 1 + 0.1 * k;
      sy = 1 - 0.22 * k;
    }
    group.scale.set(sx, sy, 1);
  }

  /** Where a point fixed to a moving prop is, between its last two ticks. */
  private carried(visual: AnimatedVisual, local: Vec2, alpha: number): Vec2 {
    const cos = Math.cos(visual.cur.angle);
    const sin = Math.sin(visual.cur.angle);
    return {
      x: lerp(visual.prev.x, visual.cur.x, alpha) + local.x * cos - local.y * sin,
      y: lerp(visual.prev.y, visual.cur.y, alpha) + local.x * sin + local.y * cos,
    };
  }

  private poseTether(tether: Tether, alpha: number): void {
    const { visual, local, pivot, mesh } = tether;
    const x = lerp(visual.prev.x, visual.cur.x, alpha);
    const y = lerp(visual.prev.y, visual.cur.y, alpha);
    const cos = Math.cos(visual.cur.angle);
    const sin = Math.sin(visual.cur.angle);
    const ex = x + local.x * cos - local.y * sin;
    const ey = y + local.x * sin + local.y * cos;
    const anchor = 'on' in pivot ? this.carried(pivot.on, pivot.local, alpha) : pivot;
    const dx = ex - anchor.x;
    const dy = ey - anchor.y;
    mesh.position.x = (ex + anchor.x) / 2;
    mesh.position.y = (ey + anchor.y) / 2;
    mesh.scale.y = hypot2(dx, dy);
    mesh.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
  }

  private animateBlinkers(clockMs: number, reducedMotion: boolean): void {
    for (const { blink } of this.animated) {
      if (!blink) continue;
      const look = blinkLook(cycleState(blink.cycle, clockMs), clockMs, reducedMotion);
      blink.body.opacity = look.body;
      if (blink.glow) blink.glow.opacity = look.glow;
      if (blink.rim) blink.rim.opacity = look.rim;
    }
  }

  /** Streaks follow the gust the audio hears: the present push, plus the forecast so they show a moment early. */
  private animateWind(sim: Simulation, view: MagnoView, clockMs: number, dt: number): void {
    const wind = sim.level.wind;
    if (!wind) return;
    const camera = this.cameraRig.camera;
    const halfH = Math.tan((camera.fov * DEG) / 2) * camera.position.z;
    const present = Math.abs(windAcceleration(sim.level, clockMs, view.position.y)) / Math.abs(wind.strength || 1);
    const ahead = gustForecast(sim.level, clockMs, view.position.y);
    this.windStreaks.update(
      dt,
      { cx: camera.position.x, cy: camera.position.y, halfW: halfH * camera.aspect, halfH },
      { intensity: clamp(Math.max(present, ahead * 0.6), 0, 1), direction: wind.strength >= 0 ? 1 : -1 },
    );
  }

  private animateBeacon(): void {
    const beacon = this.beacon;
    if (!beacon) return;
    const loop = Math.sin((this.time / 1.8) * Math.PI * 2);
    beacon.children[1]!.rotation.y = this.time * 1.6;
    beacon.children[1]!.position.y = loop * 0.12;
    beacon.children[2]!.rotation.x = Math.PI / 2 + Math.sin(this.time * 1.1) * 0.3;
    beacon.children[2]!.rotation.y = this.time * 0.9;
    beacon.children[3]!.rotation.x = Math.PI / 2 - Math.sin(this.time * 0.9) * 0.3;
    beacon.children[3]!.rotation.y = -this.time * 0.7;
    (beacon.children[0] as Mesh).scale.x = 1 + loop * 0.04;
  }

  private animateGlow(): void {
    const pulse = 0.5 + 0.5 * Math.sin((this.time / 1.8) * Math.PI * 2);
    for (const mesh of this.glowMeshes) (mesh.material as MeshBasicMaterial).opacity = 0.06 + pulse * 0.16;
  }

  private updateFlags(sim: Simulation): void {
    this.flags.forEach((flag, index) => {
      const reached = sim.run.checkpoint >= index;
      if (reached === flag.reached) return;
      flag.reached = reached;
      const material = flag.cloth.material as MeshStandardMaterial;
      material.color.set(reached ? 0xffc84a : 0x6f7b86);
      material.emissive.set(reached ? 0x6a4a08 : 0x000000);
    });
  }

  dispose(): void {
    this.clearLevel();
    this.vfx.dispose();
    this.windStreaks.dispose();
    this.tetherGeometry.dispose();
    this.tetherMaterial.dispose();
    this.glowMaterial.dispose();
    this.rig.dispose();
    this.parGhost.dispose();
    this.personalGhost.dispose();
    this.friendGhost.dispose();
    this.bodyMaterial.dispose();
    this.glassMaterial.dispose();
    this.rimMaterial.dispose();
    this.post.dispose();
    this.renderer.dispose();
  }
}

/**
 * Patches a MeshStandardMaterial to apply a two-band hard terminator. The
 * patch is intentionally narrow: it does not touch the standard lighting
 * pipeline, it only multiplies the final outgoing diffuse light by a stepped
 * factor derived from the dot product of the surface normal and the scene's
 * first directional light. The result is the committed toon look without
 * abandoning the standard pipeline that drives every prop in the game.
 *
 * The patch is skipped at runtime if the shader failed to compile, so a
 * hostile driver never breaks the whole frame: the prop simply renders as it
 * did before the patch.
 */
function applyToonShading(material: MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <dithering_fragment>',
        `#if NUM_DIR_LIGHTS > 0
           {
             vec3 toonLightDir = normalize(directionalLights[0].direction);
             float toonNdotL = clamp(dot(normal, toonLightDir), 0.0, 1.0);
             float toonBand = step(0.5, toonNdotL);
             float toonEdge = smoothstep(0.45, 0.52, toonNdotL);
             // Shadow band pushed to 0.35 (was 0.5) for graphic punch: the
             // shadow side reads as a committed dark, not as a softened tint.
             float toonFactor = mix(0.35, 1.0, toonBand) * mix(0.85, 1.0, toonEdge);
             diffuseColor.rgb *= toonFactor;
           }
         #endif
         #include <dithering_fragment>`,
      );
  };
  material.needsUpdate = true;
}
