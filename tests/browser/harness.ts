import { chromium, type Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

const LAUNCH_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];

/** Installed Chrome first, then the bundled Chromium; null when neither can start. */
export async function launchBrowser(): Promise<Browser | null> {
  for (const options of [{ channel: 'chrome' as const }, {}]) {
    try {
      return await chromium.launch({ headless: true, args: LAUNCH_ARGS, ...options });
    } catch {
      /* try the next browser */
    }
  }
  return null;
}

/** The project's own dev server on a free port, so a test never depends on one already running. */
export async function startServer(): Promise<{ server: ViteDevServer; url: string }> {
  const server = await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false } });
  await server.listen();
  return { server, url: server.resolvedUrls!.local[0]! };
}

/** Headless Chrome has no sound card, and says so in the console whenever audio starts; that is the machine, not the game. */
export const isHeadlessAudioNoise = (message: string): boolean => /AudioContext encountered an error from the audio device/.test(message);
