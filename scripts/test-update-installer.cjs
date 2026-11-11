// Exercises the real PowerShell progress window after its Node parent exits.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

async function run() {
  if (process.platform !== 'win32') { console.log('Windows installer smoke skipped on this platform'); return; }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ytp-installer-smoke-'));
  const capture = path.join(root, 'restart-arguments.txt');
  const env = { ...process.env, YTP_HANDOFF_ROOT: root, YTP_RESTART_CAPTURE: capture };
  const build = `
$ErrorActionPreference = 'Stop'
$root = $env:YTP_HANDOFF_ROOT
New-Item -ItemType Directory -Path (Join-Path $root 'payload\\portable'), (Join-Path $root 'target'), (Join-Path $root 'profile gốc') -Force | Out-Null
$source = 'using System; using System.IO; public class RestartFixture { public static void Main(string[] args) { File.WriteAllLines(Environment.GetEnvironmentVariable("YTP_RESTART_CAPTURE"), args); } }'
Add-Type -TypeDefinition $source -OutputAssembly (Join-Path $root 'payload\\portable\\YTP.exe') -OutputType WindowsApplication
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $root 'payload'), (Join-Path $root 'update.zip'))
`;
  const built = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(build, 'utf16le').toString('base64')], {
    env, encoding: 'utf8', windowsHide: true, timeout: 20000
  });
  assert.equal(built.status, 0, built.stderr || built.error?.message);
  const profile = path.join(root, 'profile gốc');
  fs.writeFileSync(path.join(profile, 'sentinel'), 'existing user data');
  const service = path.resolve(__dirname, '../src/update-service.js');
  const config = { packagePath: path.join(root, 'update.zip'), directory: root, targetExecutable: path.join(root, 'target', 'YTP.exe'), portable: true, userDataPath: profile };
  const driver = path.join(root, 'parent.cjs');
  fs.writeFileSync(driver, `require(${JSON.stringify(service)}).startInstaller({ ...${JSON.stringify(config)}, pid: process.pid }).then(() => console.log('helper ready')).catch(e => { console.error(e); process.exitCode = 1; });`);
  const parent = spawnSync(process.execPath, [driver], { env, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(parent.status, 0, parent.stderr || parent.error?.message);
  assert.match(parent.stdout, /helper ready/);
  const deadline = Date.now() + 20000;
  while (true) {
    if (fs.existsSync(path.join(root, 'error.txt'))) throw new Error(fs.readFileSync(path.join(root, 'error.txt'), 'utf8'));
    let state;
    try { state = JSON.parse(fs.readFileSync(path.join(root, 'progress.json'), 'utf8')); } catch {}
    if (state?.phase === 'complete' && fs.existsSync(capture)) { assert.equal(state.percent, 100); break; }
    if (Date.now() >= deadline) throw new Error('Installer did not finish after its parent exited');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(fs.readFileSync(capture, 'utf8').trim(), '--ytp-user-data=' + profile);
  assert.equal(fs.readFileSync(path.join(profile, 'sentinel'), 'utf8'), 'existing user data');
  console.log('PASS: real progress popup, parent exit handoff, 100% installation, automatic restart and original Unicode profile argument');
  console.log('Test artifacts: ' + root);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
