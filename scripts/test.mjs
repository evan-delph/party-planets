import { spawnSync } from 'node:child_process';
// grand.test.ts preserves the v0.5/v0.6 50-game specification for reference.
// The active v0.7 roster is covered by party-planets and the shared rules suite.
for (const name of [
  'planet',
  'rules',
  'party-planets',
  'board-update',
  'room-diamond',
  'controller-ui',
  'lottery-music',
  'arcade-overhaul',
]) {
  const run = spawnSync(
    process.execPath,
    ['scripts/test-loader.cjs', `tests/${name}.test.ts`],
    {
      stdio: 'inherit',
    },
  );
  if (run.status !== 0) process.exit(run.status ?? 1);
}
