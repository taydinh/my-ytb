// Run with Electron, not node --test. Uses a temporary profile and hidden windows.
const { app, BrowserWindow, session, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const projectRoot = process.env.YTFP_APP_ROOT || path.join(__dirname, '..');
const { PlayerBlocker: ElectronBlocker } = require(path.join(projectRoot, 'src/electron-blocker'));
const { createAdblock } = require(path.join(projectRoot, 'src/adblock'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ytfp-smoke-'));
app.setPath('userData', profile);
const deadline = setTimeout(() => { console.error('Smoke test timed out'); app.exit(1); }, 45000);

app.whenReady().then(async () => {
  const playerSession = session.fromPartition('persist:youtube-player');
  const controller = createAdblock({ ElectronBlocker, session: playerSession, userData: profile,
    bundledPath: path.join(projectRoot, 'assets/adblock-engine.bin') });
  assert.equal(controller.initialize().active, true);
  assert.equal(playerSession.getPreloadScripts().length, 1);
  ipcMain.handle('adblock:get-state', () => controller.getState());
  ipcMain.handle('adblock:set-enabled', (_event, value) => controller.setEnabled(value));
  ipcMain.handle('youtube:get-metadata', (_event, videoId) => ({
    title: `Video ${videoId}`,
    channelName: 'Kênh metadata',
    channelUrl: 'https://www.youtube.com/@kenhmetadata'
  }));
  ipcMain.handle('window:get-state', () => ({ alwaysOnTop: false, opacity: 1 }));
  ipcMain.handle('window:get-pointer', () => null);
  let youtubePanelOpen = false;
  ipcMain.handle('window:set-youtube-panel', (_event, value) => { youtubePanelOpen = Boolean(value); return youtubePanelOpen; });
  ipcMain.handle('window:set-compact', () => {});
  const window = new BrowserWindow({ show: false, width: 980, height: 650,
    webPreferences: { preload: path.join(projectRoot, 'src/preload.js'), webviewTag: true,
      contextIsolation: true, nodeIntegration: false, sandbox: false } });
  const errors = [];
  window.webContents.on('console-message', event => {
    // Chromium's webview element emits an existing inline-style CSP diagnostic.
    if (event.level === 'error' && !event.message.startsWith('Refused to apply inline style')) errors.push(event.message);
  });
  await window.loadFile(path.join(projectRoot, 'src/index.html'));
  await window.webContents.executeJavaScript(`new Promise(resolve => {
    const poll = setInterval(() => { if (!document.querySelector('#adblockBtn').disabled) { clearInterval(poll); resolve(); } }, 20);
  })`);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('#adblockBtn').getAttribute('aria-pressed')`), 'true');
  await window.webContents.executeJavaScript(`document.querySelector('#favoritesMenuBtn').click()`);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('#favoritesSplitter').offsetWidth`), 7);
  assert.equal(await window.webContents.executeJavaScript(`(async () => {
    currentVideoId = 'new123video';
    currentVideoChannel = { channelName: '', channelUrl: '' };
    toggleCurrentFavorite();
    for (let i = 0; i < 50 && !favoriteVideos[0]?.channelUrl; i++) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    return favoriteVideos[0]?.channelName;
  })()`), 'Kênh metadata');
  await window.webContents.executeJavaScript(`favoriteVideos = []; persistFavorites()`);
  const favoriteDivider = await window.webContents.executeJavaScript(`(() => {
    const bounds = document.querySelector('#favoritesSplitter').getBoundingClientRect();
    return { x: Math.round(bounds.left + bounds.width / 2), y: Math.round(bounds.top + 80) };
  })()`);
  window.webContents.sendInputEvent({ type: 'mouseDown', ...favoriteDivider, button: 'left', clickCount: 1 });
  window.webContents.sendInputEvent({ type: 'mouseMove', x: 410, y: favoriteDivider.y });
  window.webContents.sendInputEvent({ type: 'mouseUp', x: 410, y: favoriteDivider.y, button: 'left', clickCount: 1 });
  await window.webContents.executeJavaScript(`new Promise(resolve => setTimeout(resolve, 100))`);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('#favoritesPanel').offsetWidth`), 410);
  assert.equal(await window.webContents.executeJavaScript(`localStorage.getItem('favoritesPanelWidth')`), '410');
  assert.equal(await window.webContents.executeJavaScript(`document.body.classList.contains('split-resizing')`), false);
  await window.webContents.executeJavaScript(`document.querySelector('#closeFavoritesBtn').click()`);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('#favoritesSplitter').offsetWidth`), 0);
  await window.webContents.executeJavaScript(`document.querySelector('#youtubeHomeBtn').click(); new Promise(resolve => setTimeout(resolve, 100))`);
  assert.equal(youtubePanelOpen, true);
  assert.equal(await window.webContents.executeJavaScript(`document.body.classList.contains('youtube-panel-open')`), true);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('#youtubePanel').getAttribute('aria-hidden')`), 'false');
  assert.equal(await window.webContents.executeJavaScript(`(() => {
    const panel = document.querySelector('#youtubePanel').getBoundingClientRect();
    const browser = document.querySelector('#youtubeBrowser').getBoundingClientRect();
    return Math.abs(panel.bottom - browser.bottom) < 2 && browser.top > panel.top;
  })()`), true);
  await window.webContents.executeJavaScript(`setYouTubePanelWidth(480)`);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('#youtubePanel').getBoundingClientRect().width`), 480);
  await window.webContents.executeJavaScript(`document.querySelector('#closeYoutubePanelBtn').click(); new Promise(resolve => setTimeout(resolve, 100))`);
  assert.equal(youtubePanelOpen, false);
  assert.equal(await window.webContents.executeJavaScript(`document.body.classList.contains('youtube-panel-open')`), false);
  await window.webContents.executeJavaScript(`(() => {
    favoriteVideos = [window.FavoritesStore.sanitize({
      id: 'abc123', title: 'Video có channel', channelName: 'Kênh thử nghiệm',
      channelUrl: 'https://www.youtube.com/@kenhthunghiem'
    })];
    renderFavorites();
    document.querySelector('#favoritesMenuBtn').click();
    document.querySelector('.favorite-channel').click();
    return new Promise(resolve => setTimeout(resolve, 100));
  })()`);
  assert.equal(youtubePanelOpen, true);
  assert.match(await window.webContents.executeJavaScript(`document.querySelector('#youtubeBrowser').src`), /youtube\.com\/@kenhthunghiem/);
  await window.webContents.executeJavaScript(`document.querySelector('#youtubeHomeBtn').click(); new Promise(resolve => setTimeout(resolve, 100))`);
  await window.webContents.executeJavaScript(`document.querySelector('#compactBtn').click(); new Promise(resolve => setTimeout(resolve, 100))`);
  assert.equal(youtubePanelOpen, false);
  assert.equal(await window.webContents.executeJavaScript(`document.body.classList.contains('compact')`), true);
  await window.webContents.executeJavaScript(`document.querySelector('#adblockBtn').click(); new Promise(resolve => setTimeout(resolve, 100))`);
  assert.equal(controller.getState().active, false);
  assert.equal(playerSession.getPreloadScripts().length, 0);
  await window.webContents.executeJavaScript(`document.querySelector('#adblockBtn').click(); new Promise(resolve => setTimeout(resolve, 100))`);
  assert.equal(controller.getState().active, true);
  assert.equal(playerSession.getPreloadScripts().length, 1);

  // Verify Snap control and Settings Modal
  assert.equal(await window.webContents.executeJavaScript(`Boolean(document.querySelector('#snapBtn'))`), true);
  assert.equal(await window.webContents.executeJavaScript(`Boolean(document.querySelector('#settingsBtn'))`), true);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('#snapBtn').getAttribute('aria-pressed')`), 'false');

  // Open settings modal
  await window.webContents.executeJavaScript(`document.querySelector('#settingsBtn').click()`);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('#settingsModal').getAttribute('aria-hidden')`), 'false');
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('#settingsModal').hidden`), false);

  // Test sensitivity slider and cooldown persistence in Settings
  await window.webContents.executeJavaScript(`(() => {
    const range = document.querySelector('#snapSensitivityRange');
    range.value = '75';
    range.dispatchEvent(new Event('input'));
    const select = document.querySelector('#snapCooldownSelect');
    select.value = '1200';
    select.dispatchEvent(new Event('change'));
  })()`);
  assert.equal(await window.webContents.executeJavaScript(`localStorage.getItem('snapSensitivity')`), '75');
  assert.equal(await window.webContents.executeJavaScript(`localStorage.getItem('snapCooldown')`), '1200');
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('#sensitivityValueLabel').textContent`), '75%');

  // Close settings modal
  await window.webContents.executeJavaScript(`document.querySelector('#closeSettingsBtn').click()`);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('#settingsModal').hidden`), true);

  // Verify visual HUD feedback
  await window.webContents.executeJavaScript(`showSnapFeedback('play')`);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('#snapFeedback').classList.contains('visible')`), true);
  assert.equal(await window.webContents.executeJavaScript(`document.querySelector('#snapFeedbackText').textContent`), 'Tiếp tục phát');

  assert.deepEqual(errors, []);
  if (process.env.YTFP_LIVE_SMOKE === '1') {
    app.on('web-contents-created', (_event, contents) => contents.setAudioMuted(true));
    playerSession.webRequest.onBeforeSendHeaders((details, callback) => callback({
      requestHeaders: { ...details.requestHeaders, Referer: 'https://www.youtube.com/' }
    }));
    await window.webContents.executeJavaScript(`loadVideo('https://www.youtube.com/watch?v=M7lc1UVf-VE')`);
    await new Promise(resolve => setTimeout(resolve, 12000));
    console.log('YouTube live smoke:', await window.webContents.executeJavaScript(`document.querySelector('#player').executeJavaScript(\`JSON.stringify({
      url: location.href, helper: Boolean(globalThis.__ytfpHelperState),
      video: Boolean(document.querySelector('video')), ready: document.querySelector('video')?.readyState,
      time: document.querySelector('video')?.currentTime,
      error: document.querySelector('.ytp-error-content-wrap')?.innerText || ''
    })\`)`));
    if (process.env.YTFP_SCREENSHOT) fs.writeFileSync(process.env.YTFP_SCREENSHOT, (await window.webContents.capturePage()).toPNG());
  }
  controller.setEnabled(false);

  // Real network request: block the fixture ad, keep content and existing header hook.
  const server = http.createServer((req, res) => { res.end(req.headers['x-test-header'] || 'content'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const testEngine = ElectronBlocker.parse('*/fixture-ad.js', { loadCosmeticFilters: false });
    playerSession.webRequest.onBeforeSendHeaders((details, callback) => callback({ requestHeaders: { ...details.requestHeaders, 'X-Test-Header': 'preserved' } }));
    testEngine.enableBlockingInSession(playerSession);
    await assert.rejects(playerSession.fetch(`${base}/fixture-ad.js`));
    assert.equal(await (await playerSession.fetch(`${base}/content`)).text(), 'preserved');
    testEngine.disableBlockingInSession(playerSession);
    assert.equal(await (await playerSession.fetch(`${base}/fixture-ad.js`)).text(), 'preserved');
  } finally { server.close(); }
  window.destroy();
  clearTimeout(deadline);
  console.log('PASS: Electron 38 UI, IPC, preload registration, toggle, actual network blocking and header coexistence');
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
