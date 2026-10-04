const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');

test('Windows close hides the window so playback can continue', () => {
  assert.match(source, /mainWindow\.on\('close',[\s\S]*?event\.preventDefault\(\)[\s\S]*?mainWindow\.hide\(\)/);
  assert.match(source, /process\.platform === 'win32' && !isQuitting/);
});

test('tray offers restore and explicit exit actions', () => {
  assert.match(source, /new Tray\([\s\S]*?icon\.ico/);
  assert.match(source, /label: 'Mở ứng dụng', click: showMainWindow/);
  assert.match(source, /label: 'Thoát'[\s\S]*?isQuitting = true;[\s\S]*?app\.quit\(\)/);
});
