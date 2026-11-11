// Invoked by scripts/test-update-electron.cjs using a temporary profile.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createUpdateWindow } = require('../src/update-window');
const { restoreUpdateProfile, flushUpdateProfile } = require('../src/update-profile');
const root = process.env.YTP_UPDATE_TEST_ROOT;
if (!root) throw new Error('Temporary test directory required');
app.commandLine.appendSwitch('ytp-user-data', path.join(root, 'existing profile'));
restoreUpdateProfile(app);
const deadline = setTimeout(() => app.exit(1), 30000);
const favorite = [{ id: 'dQw4w9WgXcQ', title: 'Video yêu thích', customTitle: true }];
const tick = () => new Promise(resolve => setTimeout(resolve, 100));
app.whenReady().then(async () => {
  const phase = process.env.YTP_UPDATE_TEST_PHASE;
  const directory = path.join(root, phase === 'seed' ? 'old-app' : 'new-app');
  fs.mkdirSync(directory, { recursive: true });
  const html = path.join(directory, 'index.html');
  fs.writeFileSync(html, '<!doctype html><html lang="vi"><meta charset="UTF-8"><title>Test profile</title><body>Profile persistence fixture</body></html>');
  const parent = new BrowserWindow({ show: false, width: 800, height: 600 });
  await parent.loadFile(html);
  const youtube = session.fromPartition('persist:youtube-player');
  if (phase === 'seed') {
    await parent.webContents.executeJavaScript(`localStorage.setItem('favoriteVideos', ${JSON.stringify(JSON.stringify(favorite))})`);
    await youtube.cookies.set({ url: 'https://www.youtube.com', name: 'ytp-update-test', value: 'retained-login', expirationDate: Date.now() / 1000 + 86400, secure: true });
    await flushUpdateProfile([session.defaultSession, youtube]);
    console.log('PASS: seeded favorites and persistent YouTube cookie');
  } else {
    assert.deepEqual(JSON.parse(await parent.webContents.executeJavaScript("localStorage.getItem('favoriteVideos')")), favorite);
    assert.equal((await youtube.cookies.get({ name: 'ytp-update-test' }))[0].value, 'retained-login');
    parent.show();
    parent.setAlwaysOnTop(true, 'floating');
    const popup = createUpdateWindow({ BrowserWindow, ipcMain, parent, currentVersion: '1.0.6',
      update: { version: '1.0.7', isMandatory: true, releaseNotes: ['Hiển thị tiến trình tải và cài đặt.', '<img src=x onerror=alert(1)>'] } });
    const choice = popup.waitForAction();
    while (!popup.window.isVisible()) await tick();
    assert.equal(parent.isEnabled(), false);
    assert.equal(popup.window.isModal(), true);
    assert.equal(popup.window.getParentWindow(), parent);
    assert.equal(popup.window.isAlwaysOnTop(), true);
    const read = code => popup.window.webContents.executeJavaScript(code);
    assert.equal(await read("document.querySelector('#secondary').textContent"), 'Thoát ứng dụng');
    assert.equal(await read("document.querySelectorAll('img').length"), 0);
    await read("document.querySelector('#primary').click()");
    assert.equal(await choice, 'install');
    popup.setState({ phase: 'downloading', percent: 46.7, status: 'Đang tải gói cập nhật…', primary: null, secondary: null });
    await tick();
    assert.equal(await read("document.querySelector('#percent').textContent"), '46%');
    assert.equal(await read("document.querySelector('#primary').hidden"), true);
    popup.window.close();
    assert.equal(popup.window.isDestroyed(), false);
    assert.equal(parent.isEnabled(), false);
    fs.writeFileSync(path.join(root, 'update-progress.png'), (await popup.window.webContents.capturePage()).toPNG());
    popup.setState({ phase: 'error', percent: 0, title: 'Chưa thể cập nhật', status: 'Lỗi mạng. Bạn có thể thử lại.', primary: 'Thử lại', secondary: 'Thoát ứng dụng' });
    const retry = popup.waitForAction();
    await tick();
    await read("document.querySelector('#primary').click()");
    assert.equal(await retry, 'install');
    popup.destroy();
    assert.equal(parent.isEnabled(), true);
    console.log('PASS: modal blocking, topmost, progress, close protection, retry, and cookies/favorites after process restart and app path change');
  }
  parent.destroy();
  clearTimeout(deadline);
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
