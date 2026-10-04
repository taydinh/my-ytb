const test = require('node:test');
const assert = require('node:assert/strict');
const { registerWindowsAppIdentity } = require('../src/windows-app-identity');

test('registers the Windows media-session display name and executable icon', () => {
  const calls = [];
  const result = registerWindowsAppIdentity({
    appId: 'com.example.player',
    appName: 'Example Player',
    executablePath: 'C:\\Apps\\Example Player.exe',
    platform: 'win32',
    run(command, args, options) {
      calls.push({ command, args, options });
      return { status: 0 };
    }
  });

  assert.equal(result, true);
  assert.deepEqual(calls.map(({ args }) => [args[3], args[7]]), [
    ['DisplayName', 'Example Player'],
    ['IconUri', 'C:\\Apps\\Example Player.exe,0']
  ]);
  assert.deepEqual(calls.map(({ args }) => [args[3], args[5]]), [
    ['DisplayName', 'REG_EXPAND_SZ'],
    ['IconUri', 'REG_SZ']
  ]);
  assert.ok(calls.every(({ command, options }) => command === 'reg.exe' && options.windowsHide));
});

test('does not touch the registry on other platforms', () => {
  let called = false;
  assert.equal(registerWindowsAppIdentity({
    appId: 'com.example.player',
    appName: 'Example Player',
    platform: 'darwin',
    run() { called = true; }
  }), true);
  assert.equal(called, false);
});
