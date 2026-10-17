import { spawnSync } from 'node:child_process';

/** Runs the cold-load timing gate on its own, so no other suite competes for the CPU. */
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/load-time.test.ts'], {
  stdio: 'inherit',
  env: { ...process.env, MAGNETOPE_LOAD_GATE: '1' },
});
process.exit(result.status ?? 1);
