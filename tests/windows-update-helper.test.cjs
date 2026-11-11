const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Windows helper replaces installed and portable files with Unicode paths', { skip: process.platform !== 'win32' }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ytp-helper-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
foreach ($mode in @('portable', 'installed')) {
  $caseRoot = Join-Path $env:YTP_HELPER_TEST_ROOT $mode
  $payload = Join-Path $caseRoot 'payload'
  $target = Join-Path $caseRoot 'Yêu Từ Pé'
  $work = Join-Path $caseRoot 'work'
  $profile = Join-Path $caseRoot 'profile'
  New-Item -ItemType Directory -Path $target, $work, $profile, (Join-Path $payload 'app'), (Join-Path $payload 'portable') -Force | Out-Null
  'cookies-and-favorites' | Set-Content -LiteralPath (Join-Path $profile 'sentinel.txt')
  $fixture = Join-Path $env:SystemRoot 'System32\\where.exe'
  Copy-Item -LiteralPath $fixture -Destination (Join-Path $payload 'app\\where.exe')
  Copy-Item -LiteralPath $fixture -Destination (Join-Path $payload 'portable\\YTP.exe')
  'updated' | Set-Content -LiteralPath (Join-Path $payload 'app\\marker.txt')
  'old' | Set-Content -LiteralPath (Join-Path $target 'where.exe')
  $zip = Join-Path $caseRoot 'update.zip'
  [IO.Compression.ZipFile]::CreateFromDirectory($payload, $zip)
  $configFile = Join-Path $work 'install.json'
  $json = @{packagePath=$zip; targetExecutable=(Join-Path $target 'where.exe'); portable=($mode -eq 'portable'); pid=2147483647; showProgress=($env:YTP_TEST_VISIBLE_PROGRESS -eq '1'); userDataPath=$profile} | ConvertTo-Json
  [IO.File]::WriteAllText($configFile, $json, [Text.UTF8Encoding]::new($false))
  & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $env:YTP_HELPER_SOURCE -ConfigPath $configFile
  if ($LASTEXITCODE -ne 0) { throw 'Helper failed' }
  if ([Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $target 'where.exe'))) -ne [Convert]::ToBase64String([IO.File]::ReadAllBytes($fixture))) { throw 'Replacement failed' }
  if ($mode -eq 'installed' -and (Get-Content -LiteralPath (Join-Path $target 'marker.txt')) -ne 'updated') { throw 'Payload missing' }
  if ((Get-Content -LiteralPath (Join-Path $profile 'sentinel.txt')) -ne 'cookies-and-favorites') { throw 'User data modified' }
  $progress = Get-Content -LiteralPath (Join-Path $work 'progress.json') -Raw | ConvertFrom-Json
  if ($progress.phase -ne 'complete' -or $progress.percent -ne 100) { throw 'Progress did not complete' }
}
# Reject any package entry targeting the profile and roll back previously copied files.
$caseRoot = Join-Path $env:YTP_HELPER_TEST_ROOT 'rollback'
$payload = Join-Path $caseRoot 'payload'
$target = Join-Path $caseRoot 'target'
$profile = Join-Path $target 'protected'
$work = Join-Path $caseRoot 'work'
New-Item -ItemType Directory -Path $work, $profile, (Join-Path $payload 'app\\protected') -Force | Out-Null
Copy-Item -LiteralPath $fixture -Destination (Join-Path $payload 'app\\where.exe')
'must-not-replace-cookie' | Set-Content -LiteralPath (Join-Path $payload 'app\\protected\\cookie.txt')
'original-executable' | Set-Content -LiteralPath (Join-Path $target 'where.exe')
'original-cookie' | Set-Content -LiteralPath (Join-Path $profile 'cookie.txt')
$zip = Join-Path $caseRoot 'update.zip'
[IO.Compression.ZipFile]::CreateFromDirectory($payload, $zip)
$configFile = Join-Path $work 'install.json'
$json = @{packagePath=$zip; targetExecutable=(Join-Path $target 'where.exe'); portable=$false; pid=2147483647; showProgress=$false; userDataPath=$profile} | ConvertTo-Json
[IO.File]::WriteAllText($configFile, $json, [Text.UTF8Encoding]::new($false))
& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $env:YTP_HELPER_SOURCE -ConfigPath $configFile
if ($LASTEXITCODE -ne 1) { throw 'Unsafe profile overwrite was not rejected' }
if ((Get-Content -LiteralPath (Join-Path $target 'where.exe')) -ne 'original-executable') { throw 'Rollback did not restore executable' }
if ((Get-Content -LiteralPath (Join-Path $profile 'cookie.txt')) -ne 'original-cookie') { throw 'Profile was overwritten' }
$progress = Get-Content -LiteralPath (Join-Path $work 'progress.json') -Raw | ConvertFrom-Json
if ($progress.phase -ne 'error') { throw 'Missing error progress state' }
exit 0
`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    windowsHide: true, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, YTP_HELPER_TEST_ROOT: root, YTP_HELPER_SOURCE: path.resolve(__dirname, '../src/apply-update.ps1') }
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});
