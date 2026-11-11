const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { spawn } = require('node:child_process');

const UPDATE_ROOT = 'https://timeclock.maskermedia.com/updates/ytp/win-x64/';
function versionParts(version) {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version)) throw new Error('Version không hợp lệ.');
  return version.split('.').map(Number);
}
function compareVersions(a, b) {
  const left = versionParts(a), right = versionParts(b);
  for (let i = 0; i < 4; i++) {
    const delta = (left[i] || 0) - (right[i] || 0);
    if (delta) return Math.sign(delta);
  }
  return 0;
}
function validateManifest(manifest) {
  versionParts(manifest.version);
  if (manifest.minimumVersion) versionParts(manifest.minimumVersion);
  const url = new URL(manifest.downloadUrl);
  const root = new URL(UPDATE_ROOT);
  if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname) || url.username || url.password || !url.pathname.endsWith('.zip')) {
    throw new Error('File cập nhật phải nằm trong ' + UPDATE_ROOT);
  }
  if (!/^[a-f\d]{64}$/i.test(manifest.sha256) || !Number.isSafeInteger(manifest.size) || manifest.size <= 0) {
    throw new Error('SHA-256 hoặc kích thước gói cập nhật không hợp lệ.');
  }
  if (manifest.mandatory !== undefined && typeof manifest.mandatory !== 'boolean') throw new Error('mandatory không hợp lệ.');
  return manifest;
}
async function checkForUpdate(currentVersion, fetcher = fetch) {
  const response = await fetcher(UPDATE_ROOT + 'latest.json', { signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Không thể kiểm tra cập nhật (HTTP ${response.status}).`);
  const manifest = validateManifest(await response.json());
  if (compareVersions(manifest.version, currentVersion) <= 0) return null;
  return { ...manifest, isMandatory: manifest.mandatory === true || Boolean(manifest.minimumVersion && compareVersions(currentVersion, manifest.minimumVersion) < 0) };
}
async function downloadUpdate(manifest, directory, onProgress = () => {}, fetcher = fetch) {
  validateManifest(manifest);
  fs.mkdirSync(directory, { recursive: true });
  const packagePath = path.join(directory, 'update.zip');
  const hash = crypto.createHash('sha256');
  let received = 0;
  try {
    const response = await fetcher(manifest.downloadUrl, { signal: AbortSignal.timeout(15 * 60 * 1000), redirect: 'error' });
    if (!response.ok || !response.body) throw new Error(`Không thể tải cập nhật (HTTP ${response.status}).`);
    async function* verify(source) {
      for await (const chunk of source) {
        received += chunk.length;
        if (received > manifest.size) throw new Error('Kích thước file cập nhật không khớp manifest.');
        hash.update(chunk);
        onProgress(received / manifest.size);
        yield chunk;
      }
    }
    await pipeline(Readable.fromWeb(response.body), verify, fs.createWriteStream(packagePath));
    if (received !== manifest.size || hash.digest('hex').toLowerCase() !== manifest.sha256.toLowerCase()) {
      throw new Error('Kích thước hoặc SHA-256 của file cập nhật không khớp manifest.');
    }
    return packagePath;
  } catch (error) {
    fs.rmSync(packagePath, { force: true });
    throw error;
  }
}
async function startInstaller({ packagePath, directory, targetExecutable, portable, userDataPath, pid = process.pid }) {
  const helper = path.join(directory, 'apply-update.ps1');
  fs.copyFileSync(path.join(__dirname, 'apply-update.ps1'), helper);
  const config = path.join(directory, 'install.json');
  const readyPath = path.join(directory, 'ready');
  fs.writeFileSync(config, JSON.stringify({ packagePath, targetExecutable, portable, userDataPath, pid }));
  // Start-Process creates a separate hidden Windows console. Directly spawned
  // PowerShell either exits under DETACHED_PROCESS or dies with its parent's console.
  const launcher = path.join(directory, 'launch-update.ps1');
  fs.writeFileSync(launcher, [
    'param([string]$ConfigPath)',
    "$ErrorActionPreference = 'Stop'",
    '$work = Split-Path -Parent $ConfigPath',
    'try {',
    "  $helper = Join-Path $work 'apply-update.ps1'",
    "  $arguments = @('-NoProfile', '-STA', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ('\"' + $helper + '\"'), '-ConfigPath', ('\"' + $ConfigPath + '\"'))",
    "  $process = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $arguments -WindowStyle Hidden -PassThru",
    "  [IO.File]::WriteAllText((Join-Path $work 'helper-pid'), [string]$process.Id)",
    '} catch {',
    "  [IO.File]::WriteAllText((Join-Path $work 'error.txt'), $_.Exception.Message, [Text.UTF8Encoding]::new($false))",
    '  exit 1',
    '}'
  ].join('\r\n'));
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', launcher, '-ConfigPath', config], {
    windowsHide: true, stdio: 'ignore'
  });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  // Keep the application and its modal open until the independent progress UI is ready.
  try {
    const deadline = Date.now() + 20000;
    while (!fs.existsSync(readyPath)) {
      const failure = path.join(directory, 'error.txt');
      if (fs.existsSync(failure)) throw new Error(fs.readFileSync(failure, 'utf8'));
      if ((child.exitCode !== null && child.exitCode !== 0) || Date.now() >= deadline) throw new Error('Không thể mở cửa sổ tiến trình cài đặt.');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    child.kill();
    try {
      const helperPid = Number(fs.readFileSync(path.join(directory, 'helper-pid'), 'utf8'));
      if (Number.isSafeInteger(helperPid) && helperPid > 0) process.kill(helperPid);
    } catch { /* The helper may have already exited. */ }
    throw error;
  }
  child.unref();
}
module.exports = { UPDATE_ROOT, compareVersions, validateManifest, checkForUpdate, downloadUpdate, startInstaller };
