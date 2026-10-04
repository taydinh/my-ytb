const { spawnSync } = require('node:child_process');

function registerWindowsAppIdentity({
  appId,
  appName,
  executablePath = process.execPath,
  platform = process.platform,
  run = spawnSync
}) {
  if (platform !== 'win32') return true;

  const registryKey = `HKCU\\Software\\Classes\\AppUserModelId\\${appId}`;
  const values = [
    ['DisplayName', appName, 'REG_EXPAND_SZ'],
    ['IconUri', `${executablePath},0`, 'REG_SZ']
  ];

  return values.every(([name, value, type]) => {
    const result = run('reg.exe', [
      'ADD', registryKey,
      '/v', name,
      '/t', type,
      '/d', value,
      '/f'
    ], { windowsHide: true, stdio: 'ignore' });
    return !result.error && result.status === 0;
  });
}

module.exports = { registerWindowsAppIdentity };
