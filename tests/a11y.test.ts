// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { TUNING } from '@/config/tuning';
import { SlowMoDirector } from '@/game/slowmo';
import { AUDIO_WITNESSES, CHIRP_WITNESSES, CUE_ROWS, SINGLE_CHANNEL_CUES, VISUAL_WITNESSES } from '@/game/cue-table';
import { setLanguage, t, isPseudo, PSEUDO_ID, pseudoTable } from '@/locale';
import { TABLES, type StringKey } from '@/locale/strings';
import { FlashGuard } from '@/render/flash-guard';
import { FieldLines } from '@/render/field-lines';
import { PALETTES } from '@/render/palette';
import { CameraRig } from '@/render/camera-rig';
import { layoutStage } from '@/render/stage';
import { DEFAULT_SETTINGS, UI_SCALES, type Settings } from '@/platform/settings';
import { sanitizeSave } from '@/platform/storage';
import type { MagnoView } from '@/sim/magno';
import type { Polarity } from '@/sim/magno';
import { auditRows, hslToRgb } from '@/ui/contrast';
import { ModalHost } from '@/ui/modal-host';
import { GameUi, type UiHandlers } from '@/ui/ui';

/**
 * The accessibility suite (premium PRD W12): the laws that make the game
 * playable by more people, each held by what the code actually does rather
 * than by what it claims. Polarity reads by shape, contrast clears its floors
 * against the brightest band a biome can put behind the interface, reduced
 * motion calms the presentation without ever touching the simulation's clock,
 * the flash ident obeys the eye's three-a-second law, the modals trap focus,
 * the cue table keeps its two senses, the first levels clear under one thumb,
 * and the pseudo locale stretches every string past the fit law's headroom.
 */

const read = (name: string): string => readFileSync(resolve(__dirname, `../src/ui/${name}`), 'utf8');
const token = (name: string): string => {
  const match = read('style.css').match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`style.css does not define --${name}`);
  return match[1]!.trim();
};

// ------------------------------------------------------------------ R-AC-05

describe('contrast floors (R-AC-05)', () => {
  const bands = Object.values(PALETTES).flatMap((p) => [
    { biome: `${p.biome} sky top`, color: hslToRgb(p.skyTop) },
    { biome: `${p.biome} horizon`, color: hslToRgb(p.skyHorizon) },
    { biome: `${p.biome} fog`, color: hslToRgb(p.fog) },
  ]);

  const rows = auditRows({
    ink: token('ink'),
    inkDim: token('ink-dim'),
    amber: token('amber'),
    cyan: token('cyan'),
    panel: token('panel'),
    pill: read('style.css').match(/\.timer \{[^}]*background:\s*([^;]+);/s)![1]!.trim(),
    chip: read('style.css').match(/\.rail \.summit svg \{[^}]*background:\s*([^;]+);/s)![1]!.trim(),
    button: read('style.css').match(/\.icon-btn \{[^}]*background:\s*([^;]+);/s)![1]!.trim(),
    bands,
  });

  it('audits a row for every reading surface the HUD owns', () => {
    expect(rows.length).toBeGreaterThanOrEqual(9);
  });

  it.each(rows)('$label clears $floor:1', (row) => {
    expect(row.ratio, `${row.label} sits at ${row.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(row.floor);
  });

  it('measures against the brightest band of any biome, not just the home sky', () => {
    const labels = rows.map((r) => r.label).join(' ');
    expect(labels).toContain('fog');
  });
});

// ------------------------------------------------------------------ R-AC-01

describe('polarity reads by shape, not hue alone (R-AC-01)', () => {
  const view = (polarity: Polarity): MagnoView => ({
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    angle: 0,
    visualAngle: 0,
    state: 'attached',
    polarity,
    charge01: 0,
    chargeLevel: 0,
    snapArmed: false,
    snapEngaged: false,
    snapTarget: null,
    attachNormal: { x: 0, y: 1 },
    limp: false,
    scramble: false,
    recoverPhase: 0,
    grounded: true,
    chaining: false,
    dropMeters: 0,
  });

  /** Drives the loops until the shape morph settles, then measures how wide and tall the four loops stand. */
  const extents = (lines: FieldLines, polarity: Polarity) => {
    for (let i = 0; i < 90; i++) lines.update(view(polarity), { x: 0, y: 0 }, 0, 1 / 60);
    const material = lines.objects[0]!.material as unknown as { uniforms: Record<string, { value: number }> };
    const arr = (lines.objects[0]!.geometry.getAttribute('position') as unknown as { array: Float32Array }).array;
    const xs = [...arr].filter((_, k) => k % 3 === 0);
    const ys = [...arr].filter((_, k) => k % 3 === 1);
    return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), flow: material.uniforms.uFlow!.value };
  };

  it('fans the loops wide for repel and pulls them tight for attract', () => {
    const attract = new FieldLines(12, 0);
    const repel = new FieldLines(12, 0);
    const a = extents(attract, 'attract');
    const r = extents(repel, 'repel');
    // The flare law: repel stands 1.28/0.82 = 1.56 times attract's loop size.
    expect(r.w / a.w).toBeGreaterThan(1.3);
    expect(r.h / a.h).toBeGreaterThan(1.3);
  });

  it('reverses the flow direction of the loops with the polarity', () => {
    const lines = new FieldLines(12, 0);
    const a = extents(lines, 'attract');
    const r = extents(lines, 'repel');
    expect(a.flow).toBe(1);
    expect(r.flow).toBe(-1);
  });
});

// ------------------------------------------------------------------ R-AC-09

describe('the flash ident obeys the eye law (R-AC-09)', () => {
  it('permits three beats in a rolling second and refuses the fourth', () => {
    const guard = new FlashGuard();
    expect(guard.permits(0)).toBe(true);
    expect(guard.permits(100)).toBe(true);
    expect(guard.permits(200)).toBe(true);
    expect(guard.permits(300)).toBe(false);
    expect(guard.permits(400)).toBe(false);
  });

  it('frees the window again once a full second has passed', () => {
    const guard = new FlashGuard();
    guard.permits(0);
    guard.permits(100);
    guard.permits(200);
    expect(guard.permits(1001)).toBe(true);
  });

  it('halves the veil lift under reduced motion', () => {
    document.body.innerHTML = '';
    const ui = buildUi();
    ui.syncSettings({ ...DEFAULT_SETTINGS, reducedMotion: false });
    ui.flash(0.35);
    const full = Number(ui.root.querySelector<HTMLElement>('.flash')!.style.opacity);
    ui.syncSettings({ ...DEFAULT_SETTINGS, reducedMotion: true });
    ui.flash(0.35);
    const calm = Number(ui.root.querySelector<HTMLElement>('.flash')!.style.opacity);
    expect(full).toBeGreaterThan(0);
    expect(calm).toBeCloseTo(full / 2, 5);
  });
});

// ------------------------------------------------------------------ R-AC-07

describe('the modals trap focus (R-AC-07)', () => {
  const buildHost = () => {
    document.body.innerHTML = '';
    const host = new ModalHost();
    const modal = document.createElement('div');
    const outside = document.createElement('button');
    outside.textContent = 'behind the overlay';
    const first = document.createElement('button');
    const second = document.createElement('button');
    const third = document.createElement('button');
    modal.append(first, second, third);
    document.body.append(outside, modal);
    host.open(modal);
    return { host, modal, outside, first, second, third };
  };

  const tab = (shift = false) =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true }));

  it('wraps Tab from the last item back to the first', () => {
    const { third, first } = buildHost();
    third.focus();
    tab();
    expect(document.activeElement).toBe(first);
  });

  it('wraps Shift+Tab from the first item back to the last', () => {
    const { first, third } = buildHost();
    first.focus();
    tab(true);
    expect(document.activeElement).toBe(third);
  });

  it('pulls focus back when it escaped behind the overlay', () => {
    const { outside, first } = buildHost();
    outside.focus();
    tab();
    expect(document.activeElement).toBe(first);
  });

  it('walks forward through the items in order', () => {
    const { first, second } = buildHost();
    first.focus();
    tab();
    expect(document.activeElement).toBe(second);
  });
});

// ------------------------------------------------------------------ R-AC-04

describe('every gameplay-critical cue speaks two senses (R-AC-04)', () => {
  it('covers the cues a player must not miss', () => {
    const cues = CUE_ROWS.map((r) => r.cue);
    for (const expected of ['gust incoming', 'charge full', 'weak metal about to give', 'catch landed', 'summit reached']) {
      expect(cues, `the cue table must carry "${expected}"`).toContain(expected);
    }
  });

  it('names a real visual witness and a real audio witness on every row', () => {
    for (const row of CUE_ROWS) {
      expect(VISUAL_WITNESSES, `${row.cue}: visual witness "${row.visual}" exists`).toHaveProperty(row.visual);
      const audioKnown = row.audio in AUDIO_WITNESSES || CHIRP_WITNESSES.includes(row.audio as never);
      expect(audioKnown, `${row.cue}: audio witness "${row.audio}" is a real voice`).toBe(true);
    }
  });

  it('keeps the single-channel list short, justified and honest', () => {
    expect(SINGLE_CHANNEL_CUES.length).toBeLessThanOrEqual(2);
    for (const entry of SINGLE_CHANNEL_CUES) expect(entry.reason.length).toBeGreaterThan(20);
  });
});

// ------------------------------------------------------------------ R-AC-02

describe('the reduced-motion profile calms the presentation, never the game (R-AC-02)', () => {
  it('halves the slow-motion depth instead of removing the aid', async () => {
    const { loadRapier } = await import('@/sim/rapier');
    await loadRapier();
    const calm = new SlowMoDirector();
    const full = new SlowMoDirector();
    calm.reducedMotion = true;
    expect(calm.request(40)).toBe(true);
    expect(full.request(40)).toBe(true);
    for (let i = 0; i < 40; i++) {
      calm.update(16);
      full.update(16);
    }
    const fullDepth = TUNING.fall.slowMoScale;
    expect(full.scale).toBeCloseTo(fullDepth, 2);
    expect(calm.scale).toBeCloseTo(1 - (1 - fullDepth) / 2, 2);
  });

  it('keeps camera kicks and shakes inside a fifth of their amplitude', () => {
    const measure = (reduced: boolean) => {
      const rig = new CameraRig();
      rig.reducedMotion = reduced;
      rig.setLayout(layoutStage(1280, 720));
      rig.snapTo({ x: 0, y: 5 });
      const opts = { falling: false, slowMo: 0, charge: 0, bounds: { minX: -20, maxX: 20 } };
      for (let i = 0; i < 240; i++) rig.update({ x: 0, y: 5 }, { x: 0, y: 0 }, 1 / 60, opts);
      const rest = rig.camera.position.clone();
      rig.kick({ x: 1, y: 0 });
      rig.shake('small', false);
      let peak = 0;
      for (let i = 0; i < 6; i++) {
        rig.update({ x: 0, y: 5 }, { x: 0, y: 0 }, 1 / 60, opts);
        peak = Math.max(peak, rig.camera.position.distanceTo(rest));
      }
      return peak;
    };
    const normal = measure(false);
    const calm = measure(true);
    expect(normal).toBeGreaterThan(0.4);
    expect(calm / normal).toBeLessThanOrEqual(0.2 + 0.02);
  });

  it('never lets the profile reach the simulation itself', () => {
    const simSources = ['magno.ts', 'simulation.ts', 'world.ts', 'fall.ts', 'wind.ts', 'motion.ts', 'replay.ts'];
    for (const file of simSources) {
      const source = readFileSync(resolve(__dirname, `../src/sim/${file}`), 'utf8');
      expect(source, `${file} must not know about the profile`).not.toContain('reducedMotion');
    }
  });

  it('collapses interface motion to near-instant in the reduced-motion block', () => {
    const css = read('style.css');
    const block = css.match(/\.reduced-motion \*,\n\.reduced-motion \*::before,\n\.reduced-motion \*::after \{([^}]+)\}/);
    expect(block, 'the reduced-motion block exists').not.toBeNull();
    expect(block![1]).toContain('animation-duration: 0.01ms !important');
    expect(block![1]).toContain('transition-duration: 0.01ms !important');
    expect(block![1]).toContain('animation-iteration-count: 1 !important');
  });
});

// ------------------------------------------------------------------ R-AC-03

/** An erratic one-thumb player: the stick is empty whenever the flip button is touched — one action at a time. */
function* oneThumbErratic(seed: number): Generator<{ tiltX: number; tiltY: number; flipDown: boolean; flipUp: boolean; flipHeld: boolean }> {
  let a = seed >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let held = false;
  let tiltX = 0;
  let tiltY = 0;
  for (;;) {
    const habit = random();
    const length = 4 + Math.floor(random() * 50);
    for (let i = 0; i < length; i++) {
      const wasHeld = held;
      if (habit < 0.3) held = i < length / 2;
      else if (habit < 0.5) held = random() < 0.5;
      else if (habit < 0.65) held = false;
      else held = i < length * 0.8 && random() < 0.97;
      const wantsTilt = habit >= 0.25;
      tiltX = wantsTilt ? Math.sin((i + habit * 100) / 7) : 0;
      tiltY = wantsTilt ? (habit < 0.85 ? random() * 2 - 1 : 1) : 0;
      const touching = held || held !== wasHeld;
      const frame = {
        tiltX: touching ? 0 : tiltX,
        tiltY: touching ? 0 : tiltY,
        flipHeld: held,
        flipDown: held && !wasHeld,
        flipUp: !held && wasHeld,
      };
      yield frame;
    }
  }
}

describe('the first levels stay whole under one thumb (R-AC-03)', () => {
  it('keeps a one-action-at-a-time player coherent across the on-ramp', async () => {
    const { loadRapier } = await import('@/sim/rapier');
    const { Simulation } = await import('@/sim/simulation');
    const { levelById } = await import('@/levels');
    const rapier = await loadRapier();
    for (const [id, seed] of [
      ['scrapyard-00', 101],
      ['scrapyard-01', 202],
      ['scrapyard-02', 303],
    ] as const) {
      const level = levelById(id);
      const sim = new Simulation(rapier, level);
      sim.magno.setAssist(true);
      const player = oneThumbErratic(seed);
      let lastCheckpoint = sim.run.checkpoint;
      let sawCleared = false;
      const ticks = 15 * TUNING.sim.hz;
      for (let tick = 0; tick < ticks; tick++) {
        const frame = player.next().value;
        if (frame.flipHeld || frame.flipDown || frame.flipUp) {
          expect(frame.tiltX === 0 && frame.tiltY === 0, `${id}: the one-thumb stream never steers while touching the button`).toBe(true);
        }
        sim.step(frame);
        const view = sim.magno.view;
        expect(Number.isFinite(view.position.x) && Number.isFinite(view.position.y), `${id}: finite at tick ${tick}`).toBe(true);
        expect(Math.abs(view.position.x) <= 400 && view.position.y <= level.summit.y + 400, `${id}: stays in the world at tick ${tick}`).toBe(true);
        expect(sim.run.checkpoint, `${id}: checkpoint never goes backwards`).toBeGreaterThanOrEqual(lastCheckpoint);
        lastCheckpoint = sim.run.checkpoint;
        if (sawCleared) expect(sim.run.cleared, `${id}: a cleared run stays cleared`).toBe(true);
        sawCleared = sawCleared || sim.run.cleared;
      }
      sim.dispose();
    }
  });

  it('finds a one-thumb clear of the first three levels, and the routes never steer while held (P-FT-03)', async () => {
    const { loadRapier } = await import('@/sim/rapier');
    const { Simulation } = await import('@/sim/simulation');
    const { levelById } = await import('@/levels');
    const { solveLevel } = await import('../tools/planner');
    const { ReplayPlayer } = await import('@/sim/replay');
    for (const id of ['scrapyard-00', 'scrapyard-01', 'scrapyard-02']) {
      const level = levelById(id);
      const result = await solveLevel(level, { maxExpansions: 600, oneThumb: true });
      expect(result.solved, `${id}: the planner clears it with a single thumb`).toBe(true);

      // The emitted route is the proof: replay it and hold the law on every tick.
      const sim = new Simulation(await loadRapier(), level);
      sim.magno.setAssist(true);
      const player = new ReplayPlayer(result.recording!);
      let heldWithTilt = 0;
      while (!player.done && !sim.run.cleared) {
        const frame = player.next();
        if (frame.flipHeld || frame.flipDown || frame.flipUp) {
          if (frame.tiltX !== 0 || frame.tiltY !== 0) heldWithTilt++;
        }
        sim.step(frame);
      }
      expect(sim.run.cleared, `${id}: the one-thumb route clears when replayed`).toBe(true);
      expect(heldWithTilt, `${id}: the route never steers on a tick the button is touched`).toBe(0);
      sim.dispose();
    }
  });

  it('offers the one-thumb furniture in settings: the button layout, steering range and the assist', () => {
    document.body.innerHTML = '';
    const ui = buildUi();
    ui.controls.show({ ...DEFAULT_SETTINGS, touchLayout: 'single', touchSensitivity: 0.75, assist: false, reducedMotion: true, uiScale: 1.25 });
    const segments = [...ui.controls.modal.querySelectorAll<HTMLElement>('[data-value]')];
    expect(segments.some((s) => s.dataset.value === 'single')).toBe(true);
    expect(ui.controls.modal.querySelector('.range')).not.toBeNull();
    const motion = ui.controls.modal.querySelector<HTMLButtonElement>('[data-setting="reducedMotion"]')!;
    expect(motion.getAttribute('aria-pressed')).toBe('true');
    const assist = ui.controls.modal.querySelector<HTMLButtonElement>('[data-setting="assist"]')!;
    expect(assist.getAttribute('aria-pressed')).toBe('false');
    const scale = ui.controls.modal.querySelector<HTMLElement>('[data-value="1.25"]')!;
    expect(scale.getAttribute('aria-checked')).toBe('true');
  });

  it('asks nothing of a double tap', () => {
    const source = readFileSync(resolve(__dirname, '../src/input/input.ts'), 'utf8');
    expect(source).not.toMatch(/dblclick|detail\s*===\s*2|doubleTap/i);
  });
});

// ------------------------------------------------------------------ R-AC-06

describe('the interface scale (R-AC-06)', () => {
  it('offers exactly one hundred, one hundred twenty-five and one hundred fifty percent', () => {
    expect(UI_SCALES).toEqual([1, 1.25, 1.5]);
  });

  it('survives a tampered save by falling back to the default', () => {
    const saved = sanitizeSave({ settings: { uiScale: 3 } });
    expect(saved.settings.uiScale).toBe(1);
    const kept = sanitizeSave({ settings: { uiScale: 1.5 } });
    expect(kept.settings.uiScale).toBe(1.5);
  });

  it('applies its own zoom token and keeps the stick finger-true', () => {
    document.body.innerHTML = '';
    const ui = buildUi();
    ui.syncSettings({ ...DEFAULT_SETTINGS, uiScale: 1.5 });
    expect(document.documentElement.style.getPropertyValue('--ui-scale')).toBe('1.5');
    const css = read('style.css');
    expect(css).toMatch(/#ui \{[^}]*transform: scale\(var\(--ui-scale/m);
    expect(css).toMatch(/\.stick-ring,[^}]*zoom: calc\(1 \/ var\(--ui-scale/m);
  });
});

// ------------------------------------------------------------------ R-LO-04

describe('the pseudo locale (R-LO-04)', () => {
  it('stretches every string past the headroom the fit law asks', () => {
    const pseudo = pseudoTable();
    for (const key of Object.keys(TABLES.en) as StringKey[]) {
      expect(pseudo[key], `${key} exists`).toBeTypeOf('string');
      expect(pseudo[key]!.length, `${key} grows past 1.4x`).toBeGreaterThanOrEqual(Math.ceil(TABLES.en[key]!.length * 1.4) + 2);
    }
  });

  it('brackets every string and wears the shipped diacritics', () => {
    const pseudo = pseudoTable();
    expect(pseudo.pause.startsWith('[')).toBe(true);
    expect(pseudo.pause.endsWith(']')).toBe(true);
    expect(pseudo.play).toMatch(/[áéíóúñçşğ]/);
  });

  it('keeps every placeholder the format strings fill', () => {
    const pseudo = pseudoTable();
    for (const key of Object.keys(TABLES.en) as StringKey[]) {
      const originals = [...TABLES.en[key]!.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      const stretched = [...pseudo[key]!.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(stretched, `${key} keeps its placeholders`).toEqual(originals);
    }
  });

  it('speaks through t() once chosen, and clears away for a real language', () => {
    setLanguage(PSEUDO_ID);
    expect(isPseudo()).toBe(true);
    expect(t('pause')).toMatch(/^\[/);
    setLanguage('de');
    expect(isPseudo()).toBe(false);
    expect(t('pause')).toBe(TABLES.de.pause);
  });
});

// ------------------------------------------------------------------ R-AC-08

describe('the cognitive load laws (R-AC-08)', () => {
  it('keeps the pause stack inside five decision rows', () => {
    document.body.innerHTML = '';
    const ui = buildUi();
    ui.openPause();
    const stack = ui.root.querySelector<HTMLElement>('.panel.pause .stack')!;
    const rows = [...stack.children].filter((c) => (c as HTMLElement).tagName === 'BUTTON' || c.classList.contains('pair'));
    expect(rows.length).toBeLessThanOrEqual(5);
    const buttons = stack.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4);
  });

  it('reaches settings from the pause menu in one input', () => {
    document.body.innerHTML = '';
    const ui = buildUi();
    ui.openPause();
    const controls = [...ui.root.querySelectorAll<HTMLButtonElement>('.panel.pause .stack button')].find((b) => b.dataset.opens === 'controls')!;
    controls.click();
    expect(ui.controls.isOpen).toBe(true);
  });

  it('leaves no modal on a timer', () => {
    document.body.innerHTML = '';
    const ui = buildUi();
    vi.useFakeTimers();
    try {
      ui.openPause();
      vi.advanceTimersByTime(15000);
      expect(ui.pauseOpen).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the play HUD wordless beyond the digits of the clock', () => {
    document.body.innerHTML = '';
    const ui = buildUi();
    ui.showHud(true);
    ui.updateHud({ altitudeFrac: 0.4, showRail: true, timeMs: 61230, parSeconds: 90, bestStars: 2, showStars: true });
    const words = (ui.root.querySelector('.hud') as HTMLElement).textContent ?? '';
    expect(words.trim()).toMatch(/^[\d\s:.·]*$/);
  });

  it('teaches the first minutes with no words at all: the coach hand is glyph-only (P-FT-10)', () => {
    document.body.innerHTML = '';
    const ui = buildUi();
    for (const cue of ['launch', 'snap'] as const) {
      for (const device of ['touch', 'keyboard', 'mouse'] as const) {
        ui.coach.show({ cue, device, direction: { x: 0.4, y: -0.9 }, anchor: { x: 120, y: 240 } });
        const text = ui.coach.root.textContent ?? '';
        expect(text.trim(), `${cue}/${device}: the coach speaks in glyphs, not words`).toMatch(/^[^\p{L}\d]*$/u);
        expect(ui.coach.root.querySelector('[data-i18n]'), `${cue}/${device}: no localized line rides the coach`).toBeNull();
      }
    }
    ui.coach.hide();
    expect(ui.coach.visible).toBe(false);
  });
});

// ------------------------------------------------------------- shared setup

function buildUi(): GameUi {
  const noop = vi.fn();
  const handlers: UiHandlers = {
    pause: noop,
    resume: noop,
    restart: noop,
    setSetting: noop,
    next: noop,
    retry: noop,
    skipOpener: noop,
    secondWind: noop,
    doubleScrap: noop,
    shareFall: noop,
    openMap: noop,
    openLocker: noop,
    watchEnding: noop,
    openExchange: noop,
    shareDuel: noop,
    tick: noop,
    stamp: noop,
    map: { select: noop, back: noop, openLocker: noop, share: noop, tick: noop },
    locker: { equip: noop, buy: noop, watch: noop, claim: noop, back: noop, tick: noop },
    exchange: { exportCode: async () => null, importCode: async () => ({ ok: false, reason: 'format' }) as never, removeFriend: noop, back: noop, tick: noop },
  };
  return new GameUi(document.body, handlers);
}

void ({} as Settings);
