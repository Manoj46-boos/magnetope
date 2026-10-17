import { describe, expect, it } from 'vitest';
import { CLICK_SECONDS, ENDING_SECONDS, ENDING_SPANS, EndingDirector, endingFrame, type EndingBeat } from '@/game/ending';

const STEP = 1 / 60;

function play(director: EndingDirector, seconds: number): void {
  for (let t = 0; t < seconds; t += STEP) director.update(STEP);
}

function record(director: EndingDirector) {
  const log = { clicks: 0, beats: [] as EndingBeat[], done: [] as boolean[] };
  director.events.on('click', () => log.clicks++);
  director.events.on('beat', (b) => log.beats.push(b));
  director.events.on('done', ({ skipped }) => log.done.push(skipped));
  return log;
}

describe('ending timeline', () => {
  it('runs for exactly one minute as five back-to-back beats', () => {
    expect(ENDING_SECONDS).toBe(60);
    expect(ENDING_SPANS[0]!.from).toBe(0);
    expect(ENDING_SPANS.at(-1)!.to).toBe(60);
    ENDING_SPANS.slice(1).forEach((span, i) => expect(span.from).toBe(ENDING_SPANS[i]!.to));
  });

  it('starts with the core resting above its pedestal and nothing else in motion', () => {
    const frame = endingFrame(0);
    expect(frame.corePath).toBe(0);
    expect(frame.coreLoose).toBe(true);
    expect(frame.chestGlow).toBe(0);
    expect(frame.bloomAlpha).toBe(0);
    expect(frame.mountain).toBe(0);
    expect(frame.credits).toBe(0);
  });

  it('lifts the core off the pedestal before it travels', () => {
    expect(endingFrame(5).coreLift).toBeGreaterThan(1);
    expect(endingFrame(5).corePath).toBe(0);
    expect(endingFrame(8).corePath).toBeGreaterThan(0.2);
  });

  it('seats the core in the chest at the click and not before', () => {
    const before = endingFrame(CLICK_SECONDS - 0.05);
    const at = endingFrame(CLICK_SECONDS);
    expect(before.coreLoose).toBe(true);
    expect(before.chestGlow).toBe(0);
    expect(before.corePath).toBeGreaterThan(0.99);
    expect(at.coreLoose).toBe(false);
    expect(at.corePath).toBe(1);
    expect(at.coreLift).toBeCloseTo(0, 6);
  });

  it('lights the chest the instant the core is home and keeps it lit to the end', () => {
    expect(endingFrame(CLICK_SECONDS + 0.4).chestGlow).toBeGreaterThan(0.9);
    expect(endingFrame(40).chestGlow).toBeGreaterThan(0.7);
    expect(endingFrame(60).chestGlow).toBeGreaterThan(0.7);
  });

  it('only grows the field-line bloom after the click, and never shrinks it', () => {
    expect(endingFrame(CLICK_SECONDS - 0.1).bloom).toBe(0);
    let last = 0;
    for (let s = CLICK_SECONDS; s <= 60; s += 0.25) {
      const bloom = endingFrame(s).bloom;
      expect(bloom).toBeGreaterThanOrEqual(last);
      last = bloom;
    }
    expect(last).toBeCloseTo(1, 1);
  });

  it('holds the camera on MAGNO through the bloom and pulls back only after it', () => {
    expect(endingFrame(21.9).pull).toBe(0);
    expect(endingFrame(35).pull).toBeGreaterThan(0.2);
    expect(endingFrame(48).pull).toBe(1);
    let last = 0;
    for (let s = 0; s <= 60; s += 0.25) {
      const pull = endingFrame(s).pull;
      expect(pull).toBeGreaterThanOrEqual(last);
      last = pull;
    }
  });

  it('reveals the mountain while the camera is already moving, and the credits only once it is done', () => {
    expect(endingFrame(26).mountain).toBe(0);
    expect(endingFrame(31).mountain).toBeGreaterThan(0.3);
    expect(endingFrame(36).mountain).toBe(1);
    expect(endingFrame(47).credits).toBe(0);
    expect(endingFrame(60).credits).toBe(1);
  });

  it('draws the cinematic bars in over the first second and a bit', () => {
    expect(endingFrame(0).letterbox).toBe(0);
    expect(endingFrame(0.6).letterbox).toBeGreaterThan(0.3);
    expect(endingFrame(1.3).letterbox).toBe(1);
  });

  it('reports the beat for any instant and clamps outside the film', () => {
    expect(endingFrame(-5).seconds).toBe(0);
    expect(endingFrame(500).seconds).toBe(60);
    expect(endingFrame(3).beat).toBe('rise');
    expect(endingFrame(7).beat).toBe('seat');
    expect(endingFrame(15).beat).toBe('bloom');
    expect(endingFrame(30).beat).toBe('pullback');
    expect(endingFrame(59).beat).toBe('credits');
  });
});

describe('ending director', () => {
  it('plays the whole film at 60 frames a second: one click, five beats in order, finished once', () => {
    const director = new EndingDirector();
    const log = record(director);
    play(director, 61);
    expect(log.clicks).toBe(1);
    expect(log.beats).toEqual(['rise', 'seat', 'bloom', 'pullback', 'credits']);
    expect(log.done).toEqual([false]);
    expect(director.finished).toBe(true);
    expect(director.elapsed).toBe(60);
  });

  it('clicks at ten seconds, not a frame earlier', () => {
    const director = new EndingDirector();
    const log = record(director);
    play(director, CLICK_SECONDS - 0.05);
    expect(log.clicks).toBe(0);
    play(director, 0.1);
    expect(log.clicks).toBe(1);
  });

  it('can be skipped at the very first instant, and says so', () => {
    const director = new EndingDirector();
    const log = record(director);
    director.skip();
    expect(log.done).toEqual([true]);
    expect(log.clicks).toBe(0);
    expect(director.finished).toBe(true);
  });

  it('can be skipped mid-film and then stays finished', () => {
    const director = new EndingDirector();
    const log = record(director);
    play(director, 17);
    director.skip();
    play(director, 10);
    director.skip();
    expect(log.done).toEqual([true]);
    expect(log.clicks).toBe(1);
    expect(director.frame.seconds).toBe(60);
  });

  it('survives a hitch: one huge frame still clicks once and finishes once', () => {
    const director = new EndingDirector();
    const log = record(director);
    director.update(0.016);
    director.update(120);
    expect(log.clicks).toBe(1);
    expect(log.done).toEqual([false]);
  });

  it('ignores a clock that runs backwards', () => {
    const director = new EndingDirector();
    play(director, 3);
    const before = director.elapsed;
    director.update(-4);
    expect(director.elapsed).toBe(before);
  });

  it('serves the frame for the current instant', () => {
    const director = new EndingDirector();
    play(director, 12);
    expect(director.frame).toEqual(endingFrame(director.elapsed));
    expect(director.frame.beat).toBe('bloom');
  });
});
