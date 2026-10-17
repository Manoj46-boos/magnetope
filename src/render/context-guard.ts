import { Emitter } from '@/core/emitter';

export interface ContextEvents {
  lost: undefined;
  restored: undefined;
}

/**
 * Phones drop the WebGL context when the tab is backgrounded or the GPU is under pressure.
 * Cancelling the default lost event is what lets the browser hand the context back; the game
 * listens here to stop drawing in the meantime and to rebuild its sizes once it returns.
 */
export class ContextGuard {
  readonly events = new Emitter<ContextEvents>();
  private isLost = false;
  private readonly onLost = (event: Event): void => {
    event.preventDefault();
    this.isLost = true;
    this.events.emit('lost', undefined);
  };
  private readonly onRestored = (): void => {
    this.isLost = false;
    this.events.emit('restored', undefined);
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
  }

  get lost(): boolean {
    return this.isLost;
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.events.clear();
  }
}
