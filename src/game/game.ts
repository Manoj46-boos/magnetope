import { AudioDirector } from '@/audio/director';
import { AudioEngine } from '@/audio/engine';
import { COSMETICS, DEFAULT_FIELD_ID, DEFAULT_SKIN_ID, cosmeticById, gradeRank, isGrade, setOf } from '@/config/cosmetics';
import { TUNING } from '@/config/tuning';
import { FixedStepper } from '@/core/stepper';
import { BackGuard } from '@/input/back-button';
import { InputManager } from '@/input/input';
import { ALL_LEVELS, levelById } from '@/levels';
import { loadParGhost } from '@/levels/par-ghosts';
import { getLocale, setLanguage, t, tf } from '@/locale';
import { createPlatformSdk, type PlatformSdk } from '@/platform/sdk';
import { TouchMode, readPointerEnvironment } from '@/platform/device';
import { FaultGuard } from '@/platform/fault-guard';
import { SdkBus } from '@/platform/sdk-bus';
import type { Settings } from '@/platform/settings';
import { SaveStore } from '@/platform/storage';
import { AttemptRecorder, Telemetry } from '@/platform/telemetry';
import { CLASSIC_SKIN, skinFromLook } from '@/render/magno-rig';
import { ContextGuard } from '@/render/context-guard';
import { detectTier, stepDown, type QualityTier } from '@/render/quality';
import { SceneRenderer } from '@/render/scene-renderer';
import { thumbnailLevel, thumbnailVariant } from '@/render/thumbnail-scene';
import type { FallReport } from '@/sim/fall';
import { guideDirection } from '@/sim/ghost';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer, type Recording } from '@/sim/replay';
import { Simulation, type RunSummary } from '@/sim/simulation';
import type { BiomeId } from '@/sim/types';
import { GameUi } from '@/ui/ui';
import type { CoachDevice } from '@/ui/coach-overlay';
import type { ClimbSummary } from '@/ui/ending-screen';
import { Coach } from './coach';
import { GhostDirector, type FlipMoment } from './ghost-director';
import { Opener } from './opener';
import { GhostExchange } from './ghost-exchange';
import { HighlightStrip, type FallHighlight } from './highlights';
import { FLAG, HudReveal } from './hud-reveal';
import { claimEarned, claimSpotlight, completesSet, equip, nextDangle, purchase, unlockByReward } from './locker';
import { buildMap, isPlayable, nextPlayableId, resumeLevelId } from './map-model';
import { biomeAnnouncement, scrapForClear, totalStars } from './progress';
import { deliverShareCard, renderDuelCard, renderShareCard, type DuelCardSpec, type ShareCardSpec } from './share-card';
import { EndingDirector } from './ending';
import { SlowMoDirector } from './slowmo';
import { HitStop } from './hit-stop';
import { SessionLog } from './session-log';
import { SpectacleLedger } from './spectacle';

interface FriendRun {
  name: string;
  durationMs: number;
}

type Phase = 'play' | 'paused' | 'cleared' | 'ending' | 'busy';

const CLEAR_CARD_DELAY_MS = 1250;
const RETRY_AD_FALLS = 3;
const QUALITY_PATIENCE_S = 4;
/** A lost graphics context that has not come back by then is not coming back. */
const CONTEXT_GRACE_MS = 6000;
/** After the last summit the film waits this long for MAGNO to settle onto something. */
const ENDING_SETTLE_MS = 3000;
const SHAREABLE_FALL_METERS = 3;
const TICK_MS = 1000 / TUNING.sim.hz;
/** The first catch of the game plays at half speed for under a second (PRD 16.2). */
const FIRST_CATCH_SCALE = 0.5;
const FIRST_CATCH_HOLD_MS = 900;
/** Used by the tutorial hand when no par ghost is available to point the way. */
const DEFAULT_HEADING = { x: 0.35, y: 1 };
/** The calendar day the replay decay counts, in the player's own clock (R-EC-10). */
const dayKeyOf = (date: Date): string => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

const order = ALL_LEVELS.map((l) => l.id);

export interface GameDeps {
  sdk?: PlatformSdk;
  save?: SaveStore;
  clock?: () => Date;
}

/**
 * Application controller. It owns the run lifecycle and wires the headless
 * simulation to rendering, audio, input, the SDK event broker and the UI.
 */
export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ui: GameUi;
  private readonly save: SaveStore;
  private readonly bus: SdkBus;
  private readonly sdk: PlatformSdk;
  private readonly clock: () => Date;
  private readonly audioEngine = new AudioEngine();
  private readonly audio = new AudioDirector(this.audioEngine);
  private readonly slowMo = new SlowMoDirector();
  private readonly hitStop = new HitStop();
  private readonly spectacle = new SpectacleLedger();
  /** Development only: frames advance when asked, so captures do not depend on machine speed. */
  private manualClock = false;
  private readonly stepper = new FixedStepper(TUNING.sim.hz, TUNING.sim.maxStepsPerFrame);
  private readonly ghosts = new GhostDirector(loadParGhost);
  private readonly exchange: GhostExchange;
  private readonly highlights = new HighlightStrip();
  private readonly sessionLog = new SessionLog();
  private readonly telemetry: Telemetry;
  private readonly attempts: AttemptRecorder;
  private readonly hudReveal: HudReveal;
  private coach = new Coach(false, () => undefined);
  private opener!: Opener;
  private openerCamera = false;
  /** True while the composition scene owns the frame: no opener, no player input, pause cycles included. */
  private thumbnailActive = false;
  private renderer!: SceneRenderer;
  private contextGuard!: ContextGuard;
  private contextTimer = -1;
  private fatal = false;
  private readonly faults = new FaultGuard((error) => console.error(error));
  private input!: InputManager;
  private backGuard: BackGuard | null = null;
  private sim: Simulation | null = null;
  private rapier!: Awaited<ReturnType<typeof loadRapier>>;

  private phase: Phase = 'busy';
  private alpha = 0;
  private lastStamp = 0;
  private rafId = 0;
  private consecutiveFalls = 0;
  private clearTimer = -1;
  private lastClear: { summary: RunSummary; levelId: string; scrap: number; doubled: boolean; friend: FriendRun | null; deltaAtFlip: number | null } | null = null;
  private lastFall: FallHighlight | null = null;
  private lastFlip: FlipMoment | null = null;
  private currentLevelId = '';
  private lastBiome: BiomeId | null = null;
  private hudShown = false;
  /** R-AN-06: the visit has had its first play input; the record is made once. */
  private inputRecorded = false;
  private slowFrameSeconds = 0;
  private simUnsubscribe: Array<() => void> = [];
  private touchMode: TouchMode | null = null;
  private scripted: ReplayPlayer | null = null;
  private endingDirector: EndingDirector | null = null;
  private endingSettleMs = -1;

  private constructor(host: HTMLElement, deps: GameDeps) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'view';
    this.canvas.tabIndex = -1;
    host.appendChild(this.canvas);

    this.save = deps.save ?? new SaveStore();
    this.exchange = new GhostExchange(this.save, (id) => this.onFriendChanged(id));
    this.sdk = deps.sdk ?? createPlatformSdk();
    this.clock = deps.clock ?? (() => new Date());
    this.bus = new SdkBus(this.sdk);
    this.telemetry = new Telemetry({
      send: (batch) => batch.forEach((r) => this.sdk.measure(r.category, r.what, r.action)),
      canFlush: () => this.phase !== 'play' && this.bus.state !== 'ad',
    });
    this.attempts = new AttemptRecorder(this.telemetry);
    this.hudReveal = new HudReveal(new Set(this.save.data.seen), (flag) => this.markSeen(flag));

    this.ui = new GameUi(host, {
      pause: () => this.pause(),
      resume: () => void this.resume(),
      restart: () => void this.restart(),
      setSetting: (key, value) => this.setSetting(key, value),
      next: () => void this.advance(),
      retry: () => void this.restart(),
      secondWind: () => void this.secondWind(),
      doubleScrap: () => void this.doubleScrap(),
      shareFall: () => void this.shareHighlight(this.lastFall),
      openMap: () => this.openMap(),
      openLocker: () => this.openLocker(),
      watchEnding: () => this.replayEnding(),
      openExchange: () => this.openExchange(),
      shareDuel: () => void this.shareDuel(),
      tick: () => this.audio.tick(),
      stamp: (i) => this.audio.starStamp(i, this.lastClear?.summary.stars),
      map: {
        select: (id) => this.playFromMap(id),
        back: () => this.ui.map.hide(),
        openLocker: () => this.openLocker(),
        share: (h) => void this.shareHighlight(h),
        tick: () => this.audio.tick(),
      },
      exchange: {
        exportCode: (alias) => this.exchange.exportCode(this.currentLevelId, alias),
        importCode: (code) => this.exchange.importCode(code),
        removeFriend: () => this.exchange.removeFriend(this.currentLevelId),
        back: () => this.ui.exchange.hide(),
        tick: () => this.audio.tick(),
      },
      locker: {
        equip: (id) => this.equipCosmetic(id),
        buy: (id) => this.buyCosmetic(id),
        watch: (id) => void this.watchCosmetic(id),
        claim: (id) => this.claimSpotlightItem(id),
        back: () => this.ui.locker.hide(),
        tick: () => this.audio.tick(),
      },
    });

    this.opener = new Opener({
      hop: () => {
        if (!this.settings.reducedMotion) this.renderer.attentionHop();
      },
      firstCatch: () => {
        // The presentation beat halves its dive for the reduced-motion player, same law as a fall's.
        const scale = this.settings.reducedMotion ? 1 - (1 - FIRST_CATCH_SCALE) / 2 : FIRST_CATCH_SCALE;
        const granted = this.slowMo.beat(scale, FIRST_CATCH_HOLD_MS);
        if (!granted) return;
        this.markSeen(FLAG.firstCatch);
        this.spectacle.mark('first-catch');
        this.renderer.triggerFlash(0.55);
      },
      hudReveal: () => {
        this.hudShown = true;
        this.ui.showHud(true);
      },
      interruptBeat: () => this.slowMo.release(),
    });
  }

  static async start(host: HTMLElement, deps: GameDeps = {}): Promise<Game> {
    const game = new Game(host, deps);
    try {
      await game.boot();
    } catch (error) {
      game.fail();
      throw error;
    }
    return game;
  }

  get settings(): Settings {
    return this.save.data.settings;
  }

  // ------------------------------------------------------------------- boot

  private async boot(): Promise<void> {
    this.ui.setLoading(0.1);
    await this.sdk.init();
    this.ui.setLoading(0.3);

    this.applyLanguage();
    this.touchMode = new TouchMode(readPointerEnvironment(window), (on) => this.ui.setTouchControls(on));

    const tier = this.pickTier();
    this.renderer = new SceneRenderer(this.canvas, tier, (kind) => this.renderer.cameraRig.shake(kind, this.inputCritical()), (beat) => this.audio.chirp(beat));
    this.ui.root.classList.toggle('tier-low', tier === 'low');
    this.contextGuard = new ContextGuard(this.canvas);
    this.contextGuard.events.on('lost', () => this.onContextLost());
    this.contextGuard.events.on('restored', () => this.onContextRestored());
    this.input = new InputManager(this.canvas.parentElement!, {
      playerScreen: () => this.renderer.playerScreen(),
      settings: () => this.settings,
    });
    this.input.attach();
    this.backGuard = new BackGuard({ history: window.history, events: window, onBack: () => this.onHardwareBack() });
    this.bindInput();
    this.bindPlatform();
    this.ui.setLoading(0.55);

    this.rapier = await loadRapier();
    this.ui.setLoading(0.8);

    this.applySettings();
    this.applyCosmetics();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());

    // R-AN-09: the visit's own label — first-time or returning, with the locale,
    // device class and tier it booted on — so every number can be read per segment.
    // The pipe-separated words are the channel's own alphabet: no key=value pairs.
    this.telemetry.record(
      'boot',
      Object.keys(this.save.data.stars).length === 0 ? 'fresh' : 'return',
      `${getLocale()}|${this.touchMode?.touch ? 'touch' : 'desktop'}|${tier}`,
    );

    this.startLevel(resumeLevelId(ALL_LEVELS, this.save.data));
    this.ui.setLoading(1);
    this.sdk.loadingFinished();
    this.ui.hideLoading();
    performance.mark('magnetope:playable');
    this.ui.setTouchControls(this.touchUi);
    this.ui.setTouchRest(this.touchUi);
    if (!this.save.persistent) this.ui.toast(t('noSave'));
    this.claimRewards();

    this.lastStamp = performance.now();
    this.rafId = requestAnimationFrame((now) => this.loop(now));
  }

  private bindInput(): void {
    this.input.events.on('activity', ({ device }) => {
      this.touchMode?.noteActivity(device);
      this.audioEngine.unlock();
      if (this.phase === 'play' && !this.ui.modalOpen) {
        this.bus.onPlayerInput();
        if (!this.inputRecorded) {
          this.inputRecorded = true;
          this.telemetry.record('input', 'first', String(Math.round(this.telemetry.ageMs / 1000)));
        }
        this.opener.noteInput();
        if (!this.hudShown) {
          this.hudShown = true;
          this.ui.showHud(true);
          this.ui.setTouchRest(false);
        }
        if (this.ui.fallCardOpen && this.sim?.magno.view.state === 'attached') this.ui.hideFall();
      }
    });
    this.input.events.on('pause', () => {
      if (this.ui.dismissOverlayScreen()) return;
      if (this.phase === 'paused') void this.resume();
      else this.pause();
    });
    this.input.events.on('retry', () => {
      if (this.phase === 'play') void this.restart();
    });
    this.input.events.on('interrupt', () => this.pause());
  }

  /** A touch counts as a user activation only on release, and browsers keep just the history entries made during one. */
  private readonly armBackGuard = (): void => {
    if (this.touchUi) this.backGuard?.arm();
  };

  /** The Android back button: close the top screen, else pause. With neither to do it leaves the page. */
  private onHardwareBack(): boolean {
    if (this.ui.dismissOverlayScreen()) return true;
    if (this.phase !== 'play') return false;
    this.pause();
    return true;
  }

  private bindPlatform(): void {
    window.addEventListener('pointerup', this.armBackGuard);
    this.bus.events.on('adStart', () => this.audioEngine.setAdDuck(true));
    this.bus.events.on('adEnd', () => this.audioEngine.setAdDuck(false));
    this.save.events.on('degraded', () => this.ui.toast(t('noSave')));
  }

  private get touchUi(): boolean {
    return this.touchMode?.touch ?? false;
  }

  private pickTier(): QualityTier {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
    let rendererName = '';
    let maxTexture = 4096;
    if (gl) {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      rendererName = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
      maxTexture = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE));
    }
    return detectTier({
      hardwareConcurrency: navigator.hardwareConcurrency ?? 4,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      coarsePointer: this.touchUi,
      maxTextureSize: maxTexture,
      rendererName,
    });
  }

  // ------------------------------------------------------------------ levels

  private startLevel(id: string): void {
    this.teardownSim();
    const level = levelById(id);
    this.currentLevelId = id;
    const sim = new Simulation(this.rapier, level);
    this.sim = sim;
    sim.magno.setAssist(this.settings.assist);
    this.slowMo.reset();
    this.hitStop.reset();
    this.stepper.reset();
    this.clearTimer = -1;
    this.endingSettleMs = -1;
    this.lastClear = null;
    this.lastFlip = null;
    this.scripted = null;

    this.ghosts.begin(id, this.save.data.ghosts[id], this.save.data.friends[id]);
    this.attempts.begin(id);
    const coached = !this.save.data.seen.includes(FLAG.coach) && id === order[0];
    this.coach = new Coach(coached, () => this.markSeen(FLAG.coach));

    this.renderer.load(sim);
    const enteringBiome = this.lastBiome !== level.biome && level.index === 0;
    this.announceBiome(level.biome);
    // A shot still playing in the level being left would strand the camera on a
    // dead framing: this startLevel hands the renderer back, and the new level's
    // opener re-arms on its own first tick.
    this.stopOpenerCamera();
    this.opener.beginLevel({
      establish: enteringBiome && !this.settings.reducedMotion,
      beat: id === order[0] && !this.save.data.seen.includes(FLAG.firstCatch),
      spawn: level.spawn,
      summit: { x: level.summit.x, y: level.summit.y },
      follow: this.renderer.cameraRig.restFocus(level.spawn),
      followHeight: this.renderer.cameraRig.baseVisibleHeight,
    });
    if (enteringBiome && !this.settings.reducedMotion) this.spectacle.mark('establish');
    this.audio.bind(sim);
    this.bindSimEvents(sim);
    this.ui.hideClear();
    this.ui.hideFall();
    this.ui.closeScreens();
    this.ui.coach.hide();
    this.input.reset();
    this.input.setEnabled(true);
    this.audioEngine.resume();
    this.phase = 'play';
    this.alpha = 0;
    this.renderer.captureStep();
  }

  /** Shows the title card when a new biome begins and clears it on a retry, so a restart never repeats it. */
  private announceBiome(biome: BiomeId): void {
    const card = biomeAnnouncement(this.lastBiome, biome);
    this.lastBiome = biome;
    if (card) {
      this.ui.banner.show(card.name, t(card.tagline));
      // R-AU-01/03: the announcement is the motif, re-harmonized in the biome's own key.
      this.audio.biomeCall();
    } else {
      this.ui.banner.hide();
    }
  }

  private teardownSim(): void {
    this.simUnsubscribe.forEach((off) => off());
    this.simUnsubscribe = [];
    this.audio.unbind();
    this.sim?.dispose();
    this.sim = null;
  }

  private bindSimEvents(sim: Simulation): void {
    const on = sim.events.on.bind(sim.events);
    this.simUnsubscribe.push(
      on('slowMo', (e) => {
        // R-SM-06: a fall straight after a staged moment stays at full speed.
        if (!this.spectacle.clear) return;
        if (this.slowMo.request(e.heightMeters)) {
          this.spectacle.mark('slow-mo');
          this.ui.hideFall();
        }
      }),
      on('impact', (e) => {
        if (this.slowMo.active && e.speed > 3) {
          this.slowMo.release();
          this.renderer.triggerFlash(1);
        }
      }),
      on('saved', () => this.slowMo.release()),
      on('respawn', () => {
        this.slowMo.release();
        this.renderer.cameraRig.snapTo(sim.magno.view.position);
        this.renderer.captureStep();
      }),
      on('fall', (report) => this.onFall(sim, report)),
      on('attach', () => {
        this.coach.onAttach();
        this.opener.onCatch();
        if (this.ui.fallCardOpen) this.ui.hideFall();
      }),
      on('repel', (e) => {
        this.coach.onRepel();
        this.opener.onLaunch();
        // R-RT-07: the flip is the landmark the clear card's ghost delta reads.
        this.lastFlip = { point: e.point, timeMs: sim.run.timeMs };
        // R-GF-01/06: only a full-power release earns the freeze, never during
        // an input-critical window and never on top of a slow-mo beat.
        if (e.power >= 1 && !this.inputCritical() && !this.slowMo.active) this.hitStop.request();
      }),
      on('snapEngage', () => {
        this.opener.mark('snap');
      }),
      on('summit', (summary) => {
        this.opener.mark('clear');
        this.onSummit(summary);
      }),
    );
  }

  private onFall(sim: Simulation, report: FallReport): void {
    this.slowMo.release();
    this.consecutiveFalls++;
    const level = sim.level;
    this.attempts.fall(report.heightMeters, sim.magno.view.position, report.grade);
    this.save.update((s) => {
      if (!s.bestFall || report.heightMeters > s.bestFall.heightMeters) {
        s.bestFall = { heightMeters: report.heightMeters, grade: report.grade };
      }
      const known = s.bestGrade[level.id];
      if (!known || gradeRank(report.grade) > gradeRank(known)) s.bestGrade[level.id] = report.grade;
    });

    this.lastFall = {
      levelId: level.id,
      levelName: level.name,
      biome: level.biome,
      heightMeters: report.heightMeters,
      bounces: report.bounces,
      junk: report.junkDisplaced,
      grade: report.grade,
      score: report.score,
    };
    if (report.heightMeters >= SHAREABLE_FALL_METERS) this.highlights.add(this.lastFall);
    this.sessionLog.recordFall(this.lastFall);
    this.claimRewards();

    if (this.phase === 'play') {
      this.ui.showFall({
        heightMeters: report.heightMeters,
        bounces: report.bounces,
        junk: report.junkDisplaced,
        grade: report.grade,
        offerSecondWind: report.heightMeters >= 8 && !sim.run.cleared,
        shareable: report.heightMeters >= SHAREABLE_FALL_METERS,
      });
      // R-CH-06: only a spectacular fail earns MAGNO's own verdict — the deadpan
      // blip lands with the grade badge the card is about to show.
      if (gradeRank(report.grade) >= gradeRank('A')) this.audio.chirp('deadpan');
      // R-AU-05: the card's own word for the small grades; the spectacular ones keep the stage for the deadpan.
      this.audio.fallVerdict(report.grade);
    }
  }

  private onSummit(summary: RunSummary): void {
    const id = this.currentLevelId;
    const prior = this.save.data.stars[id] ?? 0;
    const firstClear = prior === 0;
    const assistOff = !this.settings.assist;
    // R-EC-10: the day's own tally decides whether this replay still pays in full.
    const day = dayKeyOf(this.clock());
    const tally = this.save.data.clearTally[id];
    const sameDayClears = tally?.day === day ? tally.clears : 0;
    const award = scrapForClear(summary.stars, firstClear, assistOff, sameDayClears);
    const previousBest = this.save.data.bestMs[id];
    const newBest = previousBest === undefined || summary.clearTimeMs < previousBest;
    const ghost = this.sim && summary.underPar && newBest ? this.ghosts.encodeRun(this.sim, id) : null;
    const friend = this.ghosts.race;
    // R-RT-07: how the run stood against the player's own ghost at the flip.
    const deltaAtFlip = this.lastFlip ? this.ghosts.deltaAtFlip(this.lastFlip) : null;

    this.save.update((s) => {
      s.stars[id] = Math.max(s.stars[id] ?? 0, summary.stars);
      if (newBest) s.bestMs[id] = Math.round(summary.clearTimeMs);
      if (ghost) s.ghosts[id] = ghost;
      s.scrap += award.amount;
      s.clearTally[id] = { day, clears: sameDayClears + 1 };
    });
    // R-AU-05: the run went on record — the toast rides the clear card's own verdict chain.
    if (ghost) {
      this.audio.ghostToast();
      this.telemetry.record('ghost', id, 'set');
    }
    if (award.amount > 0) this.telemetry.record('scrap', 'earn', String(award.amount));
    this.lastClear = { summary, levelId: id, scrap: award.amount, doubled: false, friend, deltaAtFlip };
    this.consecutiveFalls = 0;
    this.attempts.finish('clear', summary.clearTimeMs, summary.stars);
    // R-RT-04: the session's own tally, read back at the natural break.
    this.sessionLog.recordClear(summary.stars);
    if (deltaAtFlip !== null) this.sessionLog.recordDelta({ levelName: levelById(id).name, aheadMs: deltaAtFlip });

    this.bus.stop();
    this.input.setEnabled(false);
    this.slowMo.release();
    this.ui.coach.hide();
    this.clearTimer = CLEAR_CARD_DELAY_MS;
  }

  private presentClear(): void {
    const clear = this.lastClear;
    if (!clear) return;
    const level = levelById(clear.levelId);
    // R-EC-04: the next unlock, rotating; the dangle reader's own numerator (R-AN-04).
    const dangle = nextDangle(this.save.data, this.clock(), this.sessionLog.clearCount);
    if (dangle) this.telemetry.record('dangle', dangle.id, 'shown');
    this.phase = 'cleared';
    this.ui.hideFall();
    this.ui.showClear({
      levelName: level.name,
      stars: clear.summary.stars,
      newBest: (this.save.data.bestMs[clear.levelId] ?? Infinity) <= Math.round(clear.summary.clearTimeMs),
      timeMs: clear.summary.clearTimeMs,
      parSeconds: level.parSeconds,
      scrap: clear.scrap,
      hasNext: nextPlayableId(ALL_LEVELS, this.save.data, clear.levelId) !== null,
      canDouble: !clear.doubled,
      finale: Boolean(level.finale),
      friend: clear.friend && {
        name: clear.friend.name,
        beaten: clear.summary.clearTimeMs < clear.friend.durationMs,
        marginMs: Math.abs(clear.friend.durationMs - clear.summary.clearTimeMs),
      },
      // R-RT-07: the player's own ghost, at the flip; R-EC-04: the next unlock, rotating.
      ghostDelta: clear.deltaAtFlip !== null ? { aheadMs: Math.round(clear.deltaAtFlip) } : null,
      dangle,
    });
    this.claimRewards();
    this.telemetry.flush();
  }

  // ------------------------------------------------------------------ ending

  /** The clear card follows every summit except the last, where the film comes first. */
  private afterSummit(sim: Simulation): void {
    if (sim.level.finale) this.endingSettleMs = 0;
    else this.presentClear();
  }

  private waitForSettle(sim: Simulation, realDt: number): void {
    this.endingSettleMs += realDt * 1000;
    if (sim.magno.view.state !== 'attached' && this.endingSettleMs < ENDING_SETTLE_MS) return;
    this.endingSettleMs = -1;
    this.beginEnding();
  }

  /** Hands the camera back if the opener was holding a directed shot. */
  private stopOpenerCamera(): void {
    if (!this.openerCamera) return;
    this.openerCamera = false;
    this.renderer.releaseCamera();
  }

  private beginEnding(): void {
    if (!this.sim || this.phase === 'ending') return;
    this.phase = 'ending';
    this.spectacle.mark('ending');
    this.hudShown = false;
    this.ui.showHud(false);
    this.ui.hideFall();
    this.ui.hideClear();
    this.ui.closeScreens();
    this.ui.banner.hide();
    this.opener.suspend();
    this.stopOpenerCamera();
    this.renderer.beginEnding();

    const director = new EndingDirector();
    this.endingDirector = director;
    director.events.on('click', () => {
      this.renderer.burstAtChest();
      this.audio.endingCue('seat');
    });
    director.events.on('beat', (beat) => {
      if (beat === 'bloom' || beat === 'pullback' || beat === 'credits') this.audio.endingCue(beat);
    });
    director.events.on('done', ({ skipped }) => this.finishEnding(skipped));
    this.ui.ending.show(this.climbSummary(), () => director.skip());
  }

  private finishEnding(skipped: boolean): void {
    const director = this.endingDirector;
    this.endingDirector = null;
    this.ui.ending.hide();
    this.renderer.endEnding();
    this.audio.stopEnding();
    this.telemetry.record('ending', skipped ? 'skipped' : 'watched', String(Math.round(director?.elapsed ?? 0)));
    this.lastStamp = performance.now();
    this.presentClear();
  }

  private replayEnding(): void {
    if (this.phase !== 'cleared' || !this.sim?.level.finale) return;
    this.beginEnding();
  }

  private climbSummary(): ClimbSummary {
    const data = this.save.data;
    return {
      stars: totalStars(data),
      maxStars: ALL_LEVELS.length * 3,
      levelsCleared: ALL_LEVELS.filter((l) => (data.stars[l.id] ?? 0) > 0).length,
      totalLevels: ALL_LEVELS.length,
      bestFall: data.bestFall ? { heightMeters: data.bestFall.heightMeters, grade: data.bestFall.grade } : null,
    };
  }

  // ----------------------------------------------------------------- actions

  private pause(): void {
    if (this.phase !== 'play') return;
    this.phase = 'paused';
    this.bus.stop();
    this.input.setEnabled(false);
    this.ui.coach.hide();
    this.opener.suspend();
    this.stopOpenerCamera();
    this.ui.syncSettings(this.settings);
    this.ui.openPause();
    this.audioEngine.suspend();
    this.telemetry.flush();
  }

  private async resume(): Promise<void> {
    if (this.phase !== 'paused') return;
    this.phase = 'busy';
    this.ui.closeScreens();
    this.audioEngine.resume();
    await this.bus.commercialBreak();
    this.input.reset();
    // A capture stage keeps its hands off the controls, even across a pause cycle
    this.input.setEnabled(!this.thumbnailActive);
    this.phase = 'play';
    this.lastStamp = performance.now();
  }

  private async restart(): Promise<void> {
    if (this.phase === 'busy') return;
    const id = this.currentLevelId;
    this.attempts.finish('restart', this.sim?.run.timeMs ?? 0);
    this.phase = 'busy';
    this.ui.hideFall();
    this.ui.closeScreens();
    if (this.consecutiveFalls >= RETRY_AD_FALLS) {
      this.consecutiveFalls = 0;
      await this.bus.commercialBreak();
    } else {
      this.bus.stop();
    }
    this.startLevel(id);
    this.lastStamp = performance.now();
  }

  private async advance(): Promise<void> {
    const next = nextPlayableId(ALL_LEVELS, this.save.data, this.currentLevelId);
    if (!next || this.phase === 'busy') return;
    this.phase = 'busy';
    this.ui.hideClear();
    await this.bus.commercialBreak();
    this.startLevel(next);
    this.lastStamp = performance.now();
  }

  private async secondWind(): Promise<void> {
    const sim = this.sim;
    if (!sim || this.phase !== 'play') return;
    const report = sim.lastFallReport;
    this.phase = 'busy';
    this.ui.hideFall();
    const granted = await this.bus.rewardedBreak();
    this.phase = 'play';
    this.lastStamp = performance.now();
    if (!granted || this.sim !== sim) return;
    // Height insurance: the fall that triggered the offer no longer costs the no-fall star.
    if (report?.beyondSafetyLine) sim.run.beyondSafetyLine = Math.max(0, sim.run.beyondSafetyLine - 1);
    sim.run.fallCount = Math.max(0, sim.run.fallCount - 1);
    this.consecutiveFalls = Math.max(0, this.consecutiveFalls - 1);
    sim.respawn('second-wind');
  }

  private async doubleScrap(): Promise<void> {
    const clear = this.lastClear;
    if (!clear || clear.doubled || this.phase !== 'cleared') return;
    const granted = await this.bus.rewardedBreak();
    if (!granted || this.lastClear !== clear) return;
    this.save.update((s) => {
      s.scrap += clear.scrap;
    });
    if (clear.scrap > 0) this.telemetry.record('scrap', 'earn', String(clear.scrap));
    this.lastClear = { ...clear, scrap: clear.scrap * 2, doubled: true };
    this.presentClear();
  }

  // --------------------------------------------------------------- map, locker

  private mapView() {
    return {
      biomes: buildMap(ALL_LEVELS, this.save.data),
      stars: totalStars(this.save.data),
      scrap: this.save.data.scrap,
      collection: { owned: this.save.data.owned.length, total: COSMETICS.length },
      session: this.sessionLog.summary,
      highlights: this.highlights.list,
      currentLevelId: this.currentLevelId,
    };
  }

  private openMap(): void {
    if (this.phase !== 'paused' && this.phase !== 'cleared') return;
    this.ui.map.show(this.mapView());
    this.telemetry.flush();
  }

  private openLocker(): void {
    if (this.phase !== 'paused' && this.phase !== 'cleared') return;
    this.ui.locker.show({ save: this.save.data, today: this.clock() });
  }

  private openExchange(): void {
    if (this.phase !== 'paused' && this.phase !== 'cleared') return;
    this.ui.exchange.show(this.exchange.view(this.currentLevelId));
  }

  private onFriendChanged(levelId: string): void {
    if (levelId === this.currentLevelId) this.ghosts.setFriend(levelId, this.save.data.friends[levelId]);
    if (this.ui.exchange.isOpen) this.ui.exchange.update(this.exchange.view(this.currentLevelId));
  }

  private playFromMap(levelId: string): void {
    if (!isPlayable(ALL_LEVELS, this.save.data, levelId)) return;
    this.attempts.finish('leave', this.sim?.run.timeMs ?? 0);
    this.consecutiveFalls = 0;
    this.bus.stop();
    this.startLevel(levelId);
    this.lastStamp = performance.now();
  }

  private refreshLocker(): void {
    this.ui.locker.update({ save: this.save.data, today: this.clock() });
  }

  private equipCosmetic(id: string): void {
    if (!equip(this.save, id)) return;
    this.applyCosmetics();
    this.refreshLocker();
  }

  private buyCosmetic(id: string): void {
    const item = cosmeticById(id);
    const willComplete = item !== undefined && completesSet(this.save.data, item);
    const result = purchase(this.save, id, this.clock());
    if (!result.ok) {
      if (result.reason === 'funds') this.ui.toast(t('noFunds'), 2200);
      return;
    }
    this.telemetry.record('scrap', 'spend', String(result.spent));
    this.telemetry.record('cosmetic', id, 'unlock');
    if (willComplete) this.ui.toast(`${item!.name} — ${t('setComplete')}`, 2600);
    this.audio.starStamp(2);
    this.equipCosmetic(id);
  }

  private async watchCosmetic(id: string): Promise<void> {
    const item = cosmeticById(id);
    const willComplete = item !== undefined && completesSet(this.save.data, item);
    if (!(await this.bus.rewardedBreak())) return;
    const result = unlockByReward(this.save, id, this.clock());
    if (!result.ok) return;
    this.telemetry.record('cosmetic', id, 'unlock');
    if (willComplete) this.ui.toast(`${item!.name} — ${t('setComplete')}`, 2600);
    this.audio.starStamp(2);
    this.equipCosmetic(id);
  }

  /** The week's spotlight look, claimed free from the locker (R-RT-05). */
  private claimSpotlightItem(id: string): void {
    const item = cosmeticById(id);
    const willComplete = item !== undefined && completesSet(this.save.data, item);
    const result = claimSpotlight(this.save, id, this.clock());
    if (!result.ok) return;
    this.telemetry.record('cosmetic', id, 'unlock');
    if (willComplete) this.ui.toast(`${item!.name} — ${t('setComplete')}`, 2600);
    this.audio.starStamp(2);
    this.equipCosmetic(id);
  }

  /** Moves any newly satisfied reward-path cosmetics into the locker and tells the player. */
  private claimRewards(): void {
    const gained = claimEarned(this.save);
    if (gained.length === 0) return;
    for (const item of gained) this.telemetry.record('cosmetic', item.id, 'unlock');
    this.ui.toast(`${t('newUnlock')}: ${gained.map((g) => g.name).join(', ')}`);
    if (this.ui.locker.isOpen) this.refreshLocker();
  }

  private applyCosmetics(): void {
    const { skin, field } = this.save.data.equipped;
    const skinItem = cosmeticById(skin);
    const fieldItem = cosmeticById(field);
    this.renderer.setSkin(skinItem?.kind === 'skin' && skinItem.id !== DEFAULT_SKIN_ID ? skinFromLook(skinItem.look) : CLASSIC_SKIN);
    this.renderer.setFieldColors(fieldItem?.kind === 'field' && fieldItem.id !== DEFAULT_FIELD_ID ? fieldItem.look : null);
    // R-EC-05: a complete set equipped turns the idle beat into the set's flourish.
    const set = skinItem ? setOf(skinItem) : null;
    this.renderer.setFullSet(set !== null && set.pieces.every((piece) => this.save.data.owned.includes(piece.id)));
  }

  // -------------------------------------------------------------------- share

  private async shareHighlight(highlight: FallHighlight | null): Promise<void> {
    if (!highlight || !isGrade(highlight.grade)) return;
    const spec: ShareCardSpec = {
      grade: highlight.grade,
      heightMeters: highlight.heightMeters,
      bounces: highlight.bounces,
      junk: highlight.junk,
      levelName: highlight.levelName,
      biome: highlight.biome,
      labels: { fall: t('fallHeight'), bounces: t('bounces'), junk: t('junk'), meters: t('meters') },
    };
    const blob = await renderShareCard(spec);
    if (!blob) return;
    const name = `magnetope-${highlight.grade.toLowerCase()}-${Math.round(highlight.heightMeters)}m.png`;
    const outcome = await deliverShareCard(blob, name, { navigator, document, urls: URL });
    if (outcome === 'saved') this.ui.toast(t('cardSaved'), 2600);
  }

  private async shareDuel(): Promise<void> {
    const clear = this.lastClear;
    if (!clear?.friend || clear.summary.clearTimeMs >= clear.friend.durationMs) return;
    const level = levelById(clear.levelId);
    const spec: DuelCardSpec = {
      friend: clear.friend.name,
      timeMs: clear.summary.clearTimeMs,
      friendMs: clear.friend.durationMs,
      levelName: level.name,
      biome: level.biome,
      labels: { title: tf('duelTitle', { n: clear.friend.name }), ahead: t('duelAhead'), you: t('you') },
    };
    const blob = await renderDuelCard(spec);
    if (!blob) return;
    const outcome = await deliverShareCard(blob, `magnetope-${level.id}-duel.png`, { navigator, document, urls: URL });
    if (outcome === 'saved') this.ui.toast(t('cardSaved'), 2600);
  }

  // ---------------------------------------------------------------- settings

  private markSeen(flag: string): void {
    if (this.save.data.seen.includes(flag)) return;
    this.save.update((s) => {
      s.seen.push(flag);
    });
  }

  private setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.save.update((s) => {
      s.settings[key] = value;
    });
    this.applySettings();
    if (key === 'language') this.applyLanguage();
  }

  private applySettings(): void {
    const s = this.settings;
    this.audioEngine.setSound(s.sound);
    this.audioEngine.setMusic(s.music);
    // Slow motion halves its depth instead of switching off (R-AC-02); a frozen
    // frame is the one beat reduced motion keeps refusing outright.
    this.slowMo.reducedMotion = s.reducedMotion;
    this.hitStop.disabled = s.reducedMotion;
    this.sim?.magno.setAssist(s.assist);
    this.ui.syncSettings(s);
  }

  private applyLanguage(): void {
    const tag = this.settings.language === 'auto' ? this.sdk.getLanguage() : this.settings.language;
    setLanguage(tag);
    this.ui.applyLocale();
  }

  private inputCritical(): boolean {
    const view = this.sim?.magno.view;
    return Boolean(view && (view.snapEngaged || view.snapArmed));
  }

  private resize(): void {
    const vv = window.visualViewport;
    const w = vv?.width ?? window.innerWidth;
    const h = vv?.height ?? window.innerHeight;
    this.renderer.resize(w, h, window.devicePixelRatio || 1);
  }

  // -------------------------------------------------------------------- loop

  private loop(now: number): void {
    this.rafId = requestAnimationFrame((n) => this.loop(n));
    const realDt = Math.min((now - this.lastStamp) / 1000, 0.1);
    this.lastStamp = now;
    if (!this.manualClock) this.guardedTick(realDt);
  }

  /** A frame that throws is contained: skipped, then the level is rebuilt, then the game gives up cleanly. */
  private guardedTick(realDt: number): void {
    if (this.fatal || this.contextGuard.lost) return;
    try {
      this.tick(realDt);
      this.faults.ok();
    } catch (error) {
      const action = this.faults.fail(error, performance.now());
      if (action === 'fatal') this.fail();
      else if (action === 'restart') void this.restart();
    }
  }

  private onContextLost(): void {
    this.pause();
    this.contextTimer = window.setTimeout(() => this.fail(), CONTEXT_GRACE_MS);
  }

  private onContextRestored(): void {
    window.clearTimeout(this.contextTimer);
    this.contextTimer = -1;
    this.resize();
    this.lastStamp = performance.now();
  }

  /** Last resort: stop the loop's work, silence the game and offer a reload. */
  private fail(): void {
    if (this.fatal) return;
    this.fatal = true;
    window.clearTimeout(this.contextTimer);
    this.bus.stop();
    this.audioEngine.suspend();
    this.ui.showFatal(() => window.location.reload());
  }

  /** One frame of the game at the given real-time step: simulation, rendering, audio and HUD. */
  private tick(realDt: number): void {
    const sim = this.sim;
    if (!sim) return;

    this.slowMo.update(realDt * 1000);
    this.hitStop.update(realDt * 1000);
    this.spectacle.update(realDt * 1000);

    if (this.phase === 'play' && !this.ui.modalOpen && !this.thumbnailActive) {
      const { framing } = this.opener.update(realDt * 1000, sim.run.started);
      if (framing) {
        this.renderer.directCamera(framing);
        this.openerCamera = true;
      } else if (this.openerCamera) {
        this.renderer.releaseCamera();
        this.openerCamera = false;
      }
    }

    if (this.phase === 'play' && !this.ui.modalOpen) {
      const { steps, alpha } = this.stepper.advance(realDt, this.hitStop.active ? 0 : this.slowMo.scale);
      for (let i = 0; i < steps; i++) {
        const frame = this.scripted && !this.scripted.done ? this.scripted.next() : this.input.sample();
        if (this.scripted && (frame.flipDown || frame.tiltX !== 0 || frame.tiltY !== 0)) this.bus.onPlayerInput();
        sim.step(frame);
        this.ghosts.capture(sim);
        this.renderer.captureStep();
      }
      this.alpha = alpha;
    }

    if (this.clearTimer >= 0) {
      this.clearTimer -= realDt * 1000;
      if (this.clearTimer < 0) this.afterSummit(sim);
    }
    if (this.endingSettleMs >= 0) this.waitForSettle(sim, realDt);
    if (this.phase === 'ending') this.endingDirector?.update(realDt);

    const filming = this.phase === 'ending' && this.endingDirector !== null;
    const live = this.phase === 'play' || this.clearTimer >= 0 || this.phase === 'cleared';
    const timeScale = this.hitStop.active ? 0 : this.slowMo.scale;
    const visualDt = filming ? realDt : live ? realDt * Math.max(timeScale, 0.2) : 0;
    const view = sim.magno.view;
    const heldMs = view.state === 'charging' ? view.charge01 * TUNING.repel.chargeMs : 0;
    this.renderer.setChargeMeterVisible(this.hudReveal.chargeMeterVisible(sim.level, heldMs));
    const runMs = sim.run.started ? sim.run.timeMs + (this.phase === 'play' && !sim.run.cleared ? this.alpha * TICK_MS : 0) : 0;
    this.renderer.frame({
      alpha: this.alpha,
      dt: visualDt,
      reducedMotion: this.settings.reducedMotion,
      slowMo: this.slowMo.strength,
      rimTint: this.settings.rimTint,
      ghosts: this.ghosts.poses(runMs, this.settings.ghosts),
      ending: filming ? this.endingDirector!.frame : null,
    });
    if (filming) this.ui.ending.render(this.endingDirector!.frame);

    this.audio.update({
      running: this.phase === 'play' && sim.run.started,
      timeScale: this.slowMo.scale,
      dt: realDt,
      slowMo: this.slowMo.active,
    });

    this.ui.setSlowMo(this.slowMo.strength, this.settings.reducedMotion);
    this.ui.flash(this.renderer.flash);
    this.updateHud(sim);
    this.updateCoach(sim, realDt);
    if (this.touchUi) this.ui.updateTouch(this.input);
    this.watchPerformance(realDt);
  }

  private updateHud(sim: Simulation): void {
    const level = sim.level;
    const view = sim.magno.view;
    const climb = Math.max(1, level.summit.y - level.spawn.y);
    const bestStars = this.save.data.stars[level.id] ?? 0;
    this.ui.updateHud({
      altitudeFrac: (view.position.y - level.spawn.y) / climb,
      showRail: this.hudReveal.railVisible(sim.run.maxAltitude - level.spawn.y),
      timeMs: bestStars > 0 ? sim.run.timeMs : null,
      parSeconds: level.parSeconds,
      bestStars,
      showStars: this.hudReveal.starTrackerVisible(this.save.data),
    });
  }

  /** Shows the ghost hand while the tutorial still has something to teach, and as the idle ladder's first rung. */
  private updateCoach(sim: Simulation, realDt: number): void {
    const playing = this.phase === 'play' && !this.ui.modalOpen && !sim.run.cleared;
    // While the opening shot owns the camera, the stage stays clear: the hand
    // has its say the moment the move is done (or is skipped by any input).
    const cue = playing && !this.opener.presenting ? this.coach.update(realDt * 1000, sim.magno.view.state) ?? (this.opener.hand ? 'launch' : null) : null;
    const anchor = this.renderer.playerScreen();
    if (!cue || !anchor) {
      if (this.ui.coach.visible) this.ui.coach.hide();
      return;
    }
    const track = this.ghosts.parTrack;
    const heading = (track && guideDirection(track, sim.magno.view.position)) ?? DEFAULT_HEADING;
    const length = Math.hypot(heading.x, heading.y) || 1;
    this.ui.coach.show({
      cue,
      device: this.coachDevice(),
      direction: { x: heading.x / length, y: -heading.y / length },
      anchor,
    });
  }

  private coachDevice(): CoachDevice {
    if (this.touchUi) return 'touch';
    return this.input.device === 'mouse' ? 'mouse' : 'keyboard';
  }

  /** Steps the tier down if the resolution floor still cannot hold a playable frame rate. */
  private watchPerformance(realDt: number): void {
    if (this.phase !== 'play') return;
    if (realDt * 1000 > 34) this.slowFrameSeconds += realDt;
    else this.slowFrameSeconds = Math.max(0, this.slowFrameSeconds - realDt * 2);
    if (this.slowFrameSeconds > QUALITY_PATIENCE_S && this.renderer.tier !== 'low') {
      this.slowFrameSeconds = 0;
      const lowered = stepDown(this.renderer.tier);
      this.renderer.setQuality(lowered);
      this.ui.root.classList.toggle('tier-low', lowered === 'low');
    }
  }

  // ----------------------------------------------------------------- testing

  /** Development-only handle for automated end-to-end checks; compiled out of production builds. */
  get debug() {
    if (!__DEV_TOOLS__) return null;
    return {
      sim: this.sim,
      phase: this.phase,
      bus: this.bus,
      sdk: this.sdk,
      save: this.save,
      telemetry: this.telemetry,
      openerLog: this.opener.log,
      slowScale: () => this.slowMo.scale,
      /** R-AU-09: the level the mix has decided on for the bed, and whether any voice may sound. */
      musicDb: () => this.audioEngine.musicTargetDb,
      soundOn: () => this.audioEngine.audible,
      ending: () => this.endingDirector,
      beginEnding: () => this.beginEnding(),
      setQuality: (tier: QualityTier) => {
        this.renderer.setQuality(tier);
        this.ui.root.classList.toggle('tier-low', tier === 'low');
      },
      renderer: this.renderer,
      settings: this.settings,
      /** Stops the real-time loop; `advance` then drives every frame. */
      holdClock: (held: boolean) => {
        this.manualClock = held;
        this.renderer.holdResolution(held);
        this.lastStamp = performance.now();
      },
      advance: (seconds: number) => this.tick(seconds),
      startLevel: (id: string) => this.startLevel(id),
      setUiVisible: (visible: boolean) => this.ui.root.classList.toggle('photo', !visible),
      /** Boots the composition scene for card and ident capture; `null` hands play back. */
      thumbnail: (variant: string | null, ident = false) => {
        const id = variant ? thumbnailVariant(variant) : null;
        if (!id) {
          this.thumbnailActive = false;
          this.renderer.exitThumbnail();
          this.input.setEnabled(this.phase === 'play');
          return;
        }
        this.startLevel(thumbnailLevel(id));
        this.thumbnailActive = true;
        this.opener.suspend();
        this.stopOpenerCamera();
        this.input.setEnabled(false);
        this.renderer.enterThumbnail(id, ident);
        this.renderer.captureStep();
      },
      /** Restarts the level and feeds the recording through the real game loop. */
      autoplay: (recording: Recording) => {
        this.startLevel(this.currentLevelId);
        this.scripted = new ReplayPlayer(recording);
      },
    };
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    window.clearTimeout(this.contextTimer);
    this.contextGuard?.dispose();
    this.teardownSim();
    window.removeEventListener('pointerup', this.armBackGuard);
    this.backGuard?.dispose();
    this.input.dispose();
    this.renderer.dispose();
  }
}
