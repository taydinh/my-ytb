// Run with Electron, using an isolated profile and synthetic video frames.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ytp-ambient-'));
app.setPath('userData', path.join(directory, 'profile'));
const deadline = setTimeout(() => app.exit(1), 20000);
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1000, height: 650,
    webPreferences: { backgroundThrottling: false, offscreen: true } });
  await window.loadURL('data:text/html,<body style="margin:0;background:black"><div id="movie_player" class="html5-video-player"><div class="html5-video-container"><video muted autoplay playsinline></video></div></div></body>');
  await window.webContents.executeJavaScript(`(async () => {
    const source = document.createElement('canvas'); source.width = 640; source.height = 360;
    const context = source.getContext('2d');
    globalThis.paint = color => { context.fillStyle = color; context.fillRect(0, 0, 640, 360); };
    paint('red');
    const video = document.querySelector('video');
    video.srcObject = source.captureStream(30);
    document.querySelector('#movie_player').getVideoData = () => ({ video_id: 'dQw4w9WgXcQ', isLive: true });
    await video.play();
  })()`);
  const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer.js'), 'utf8');
  const template = renderer.match(/const script = (`[\s\S]*?`);\n\s*const source = player.src/)[1];
  const script = vm.runInNewContext(template, {
    cleanMode: false, loopEnabled: false, youtubeView: false, playerViewMode: 'ambient', pendingRestore: null, ambientSettings: require('../src/ambient-settings').DEFAULTS
  });
  await window.webContents.executeJavaScript(script);
  // Hidden windows intentionally skip background rendering; simulate an active document.
  await window.webContents.executeJavaScript("Object.defineProperty(document, 'hidden', { value: false, configurable: true }); void 0");
  const sample = () => window.webContents.executeJavaScript(`(() => {
    const canvas = document.querySelector('#__ytfp_ambient');
    return { color: Array.from(canvas.getContext('2d').getImageData(32, 18, 1, 1).data),
      opacity: canvas.style.opacity, ambientLayout: document.documentElement.classList.contains('__ytfp-ambient') };
  })()`);
  await new Promise(resolve => setTimeout(resolve, 600));
  const red = await sample();
  assert.ok(red.color[0] > 200 && red.color[2] < 50, JSON.stringify(red));
  assert.equal(red.opacity, '0.85');
  assert.equal(red.ambientLayout, true);
  await window.webContents.executeJavaScript("paint('blue')");
  await new Promise(resolve => setTimeout(resolve, 1600));
  const blue = await sample();
  assert.ok(blue.color[2] > 200 && blue.color[0] < 50, JSON.stringify(blue));
  fs.writeFileSync(path.join(directory, 'ambient.png'), (await window.webContents.capturePage()).toPNG());
  console.log(`PASS: Ambient Light follows real video frames. Screenshot: ${path.join(directory, 'ambient.png')}`);
  clearTimeout(deadline);
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
