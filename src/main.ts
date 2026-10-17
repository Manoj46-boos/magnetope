import './ui/style.css';
import './ui/screens.css';
import './ui/coach.css';
import { Game } from './game/game';
import { loadRapier } from './sim/rapier';

const host = document.getElementById('stage');
if (!host) throw new Error('Missing #stage host element');

// The physics engine downloads and compiles while the renderer and the interface are built.
void loadRapier();

Game.start(host)
  .then((game) => {
    if (__DEV_TOOLS__) (window as unknown as { __game: Game }).__game = game;
  })
  .catch((error: unknown) => {
    console.error(error);
  });
