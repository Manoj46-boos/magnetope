import RAPIER from '@dimforge/rapier3d-compat';

let ready: Promise<typeof RAPIER> | null = null;

/** Initialises the WASM module once and shares it across worlds. */
export function loadRapier(): Promise<typeof RAPIER> {
  ready ??= RAPIER.init().then(() => RAPIER);
  return ready;
}
