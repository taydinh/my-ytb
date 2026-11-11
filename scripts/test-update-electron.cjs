const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ytp-update-electron-'));
const env = { ...process.env, YTP_UPDATE_TEST_ROOT: root };
delete env.ELECTRON_RUN_AS_NODE;
for (const phase of ['seed', 'verify']) {
  const result = spawnSync(require('electron'), [path.resolve(__dirname, '../tests/windows-update-electron-smoke.cjs')], {
    env: { ...env, YTP_UPDATE_TEST_PHASE: phase }, encoding: 'utf8', timeout: 40000, windowsHide: true
  });
  process.stdout.write(result.stdout || '');
  if (result.status !== 0) {
    process.stderr.write(result.stderr || String(result.error || 'Electron smoke failed'));
    process.exit(1);
  }
}
console.log(`Screenshot and test profile: ${root}`);
