const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { restoreUpdateProfile, flushUpdateProfile } = require('../src/update-profile');

test('restart uses the existing profile and session directory; ordinary launches keep defaults', () => {
  const calls = [];
  const profile = path.resolve('test profile');
  const app = { commandLine: { getSwitchValue: () => profile }, setPath: (...args) => calls.push(args) };
  restoreUpdateProfile(app);
  assert.deepEqual(calls, [['userData', profile], ['sessionData', profile]]);
  calls.length = 0;
  app.commandLine.getSwitchValue = () => '';
  restoreUpdateProfile(app);
  assert.deepEqual(calls, []);
  app.commandLine.getSwitchValue = () => 'relative-profile';
  assert.throws(() => restoreUpdateProfile(app));
});
test('flushes local storage and awaits cookies in both app and YouTube sessions', async () => {
  const calls = [];
  await flushUpdateProfile(['app', 'youtube'].map(name => ({
    flushStorageData: () => calls.push(`${name}:storage`),
    cookies: { flushStore: async () => { await new Promise(resolve => setImmediate(resolve)); calls.push(`${name}:cookies`); } }
  })));
  assert.deepEqual(calls, ['app:storage', 'app:cookies', 'youtube:storage', 'youtube:cookies']);
});
