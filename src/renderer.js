const urlForm = document.querySelector('#urlForm');
const urlInput = document.querySelector('#urlInput');
const player = document.querySelector('#player');
const emptyState = document.querySelector('#emptyState');
const status = document.querySelector('#status');
const youtubeHomeBtn = document.querySelector('#youtubeHomeBtn');
const pinBtn = document.querySelector('#pinBtn');
const compactBtn = document.querySelector('#compactBtn');
const cleanBtn = document.querySelector('#cleanBtn');
const loopBtn = document.querySelector('#loopBtn');
const showControlsBtn = document.querySelector('#showControlsBtn');
const compactHomeBtn = document.querySelector('#compactHomeBtn');
const compactPinBtn = document.querySelector('#compactPinBtn');
const compactLoopBtn = document.querySelector('#compactLoopBtn');
const compactCloseBtn = document.querySelector('#compactCloseBtn');
const opacityRange = document.querySelector('#opacityRange');

let compact = false;
let cleanMode = true;
let loopEnabled = localStorage.getItem('loopEnabled') === 'true';
let cleanupTimer;
let cleanupBusy = false;
let currentVideoId = null;
let compatibilityMode = false;
let browsingMode = false;
let lastAdStatus = '';
const { extractVideoId, extractBrowsableVideoId } = window.YouTubeUrl;
const YOUTUBE_HOME_URL = 'https://www.youtube.com/';

function setStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? '#ff7187' : '';
}

function playerUrl(id) {
  const params = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1'
  });
  return `https://www.youtube.com/embed/${id}?${params}`;
}

function watchUrl(id) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}&app=desktop`;
}

function stopPlayerHelpers() {
  clearInterval(cleanupTimer);
  cleanupTimer = null;
  cleanupBusy = false;
  lastAdStatus = '';
}

function showPlayerLayout() {
  browsingMode = false;
  document.body.classList.remove('browsing');
  youtubeHomeBtn.classList.remove('active');
  youtubeHomeBtn.setAttribute('aria-pressed', 'false');
}

function loadVideo(value) {
  const id = extractVideoId(value);
  if (!id) {
    setStatus('URL YouTube không hợp lệ', true);
    urlInput.focus();
    urlInput.select();
    return;
  }

  localStorage.setItem('lastVideoUrl', value.trim());
  showPlayerLayout();
  currentVideoId = id;
  compatibilityMode = false;
  player.src = playerUrl(id);
  player.classList.add('visible');
  emptyState.classList.add('hidden');
  setStatus('Đang tải video…');
}

async function openYouTubeHome() {
  stopPlayerHelpers();
  if (compact) {
    compact = false;
    document.body.classList.remove('compact');
    await window.desktop.setCompact(false);
  }
  browsingMode = true;
  currentVideoId = null;
  compatibilityMode = false;
  document.body.classList.add('browsing');
  youtubeHomeBtn.classList.add('active');
  youtubeHomeBtn.setAttribute('aria-pressed', 'true');
  player.classList.add('visible');
  emptyState.classList.add('hidden');
  player.src = YOUTUBE_HOME_URL;
  player.focus();
}

function openVideoFromBrowsing(event) {
  if (!browsingMode) return;
  const id = extractBrowsableVideoId(event.url);
  if (!id) return;
  loadVideo(event.url);
}

// Cài một helper chạy trực tiếp trong webview. Mutation/timer ở trong trang
// phản ứng nhanh hơn việc thăm dò từ renderer và bắt được nhiều biến thể nút Skip.
async function applyCleanMode() {
  if (!player.src || cleanupBusy) return;
  cleanupBusy = true;
  const script = `(() => {
    globalThis.__ytfpCleanEnabled = ${cleanMode};
    globalThis.__ytfpLoopEnabled = ${loopEnabled};
    if (!globalThis.__ytfpHelperState) {
      const state = globalThis.__ytfpHelperState = {
        adShowing: false,
        lastSkipAt: 0,
        savedMedia: null
      };

      const visible = (element) => Boolean(element && element.isConnected && element.getClientRects().length);
      const skipText = /^(skip|skip ad|skip ads|bỏ qua|bỏ qua quảng cáo)$/i;
      const directSelectors = [
        '.ytp-ad-skip-button',
        '.ytp-skip-ad-button',
        '.ytp-ad-skip-button-modern',
        '.ytp-ad-skip-button-slot button',
        '.ytp-ad-skip-button-container button',
        '.videoAdUiSkipButton',
        'button[id^="skip-button"]',
        'button[class*="skip-ad"]',
        '[role="button"][class*="skip-ad"]'
      ];

      const findSkipButton = () => {
        for (const selector of directSelectors) {
          const element = document.querySelector(selector);
          if (visible(element)) return element;
        }
        const candidates = document.querySelectorAll('button, [role="button"], tp-yt-paper-button');
        return [...candidates].find((element) => {
          if (!visible(element)) return false;
          const label = (element.getAttribute('aria-label') || element.title || element.textContent || '')
            .replace(/\\s+/g, ' ').trim();
          return skipText.test(label);
        });
      };

      const clickSkip = () => {
        const found = findSkipButton();
        if (!found) return false;
        const button = found.closest('button, [role="button"]') || found;
        for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
          button.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
        }
        button.click();
        state.lastSkipAt = Date.now();
        return true;
      };

      const tick = () => {
        const moviePlayer = document.querySelector('#movie_player, .html5-video-player');
        const adShowing = Boolean(moviePlayer?.classList.contains('ad-showing'));
        const video = moviePlayer?.querySelector('video');
        state.adShowing = adShowing;

        // Không loop video quảng cáo; chỉ áp dụng cho nội dung chính.
        if (video) video.loop = Boolean(globalThis.__ytfpLoopEnabled && !adShowing);

        if (globalThis.__ytfpCleanEnabled && adShowing) {
          clickSkip();
          if (video && !state.savedMedia) {
            state.savedMedia = {
              muted: video.muted,
              volume: video.volume,
              playbackRate: video.playbackRate
            };
          }
          if (video) {
            video.muted = true;
            try { video.playbackRate = 16; } catch {}
            if (Number.isFinite(video.duration) && video.duration > 0 && video.duration - video.currentTime > 0.1) {
              try { video.currentTime = Math.max(0, video.duration - 0.05); } catch {}
            }
          }
        } else {
          document.querySelector('#__ytfp_ad_cover')?.remove();
          if (state.savedMedia) {
            const video = moviePlayer?.querySelector('video');
            if (video) {
              video.muted = state.savedMedia.muted;
              video.volume = state.savedMedia.volume;
              try { video.playbackRate = state.savedMedia.playbackRate || 1; } catch {}
            }
            state.savedMedia = null;
          }
        }

        if (globalThis.__ytfpCleanEnabled) {
          for (const selector of ['.ytp-ad-overlay-container', '.ytp-ad-player-overlay']) {
            document.querySelectorAll(selector).forEach((element) => { element.style.display = 'none'; });
          }
        }
      };

      globalThis.__ytfpHelperTimer = setInterval(tick, 200);
      tick();
    }

    if (!globalThis.__ytfpCleanEnabled) {
      document.querySelector('#__ytfp_ad_cover')?.remove();
      const state = globalThis.__ytfpHelperState;
      const video = document.querySelector('#movie_player video, .html5-video-player video');
      if (state?.savedMedia && video) {
        video.muted = state.savedMedia.muted;
        video.volume = state.savedMedia.volume;
        try { video.playbackRate = state.savedMedia.playbackRate || 1; } catch {}
        state.savedMedia = null;
      }
    }
    const watchPlayer = location.pathname === '/watch' && document.querySelector('#movie_player');
    if (watchPlayer) {
      watchPlayer.style.cssText = 'position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:2147483647!important;background:#000!important;';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }
    const bodyText = document.body?.innerText || '';
    const unavailable = /this video is unavailable|video unavailable|không xem được video/i.test(bodyText);
    const errorCode = bodyText.match(/error code:\s*([\d-]+)/i)?.[1] || '';
    return {
      unavailable,
      errorCode,
      directWatch: location.pathname === '/watch',
      adShowing: globalThis.__ytfpHelperState?.adShowing || false,
      lastSkipAt: globalThis.__ytfpHelperState?.lastSkipAt || 0
    };
  })()`;
  try {
    const result = await player.executeJavaScript(script);
    if (result?.unavailable && !compatibilityMode && currentVideoId) {
      compatibilityMode = true;
      setStatus(`Embed lỗi ${result.errorCode || ''} — đang chuyển chế độ tương thích…`);
      player.src = watchUrl(currentVideoId);
    } else if (result?.adShowing && cleanMode) {
      lastAdStatus = 'Đang tự động bỏ qua quảng cáo…';
      setStatus(lastAdStatus);
    } else if (result?.lastSkipAt && Date.now() - result.lastSkipAt < 2500) {
      lastAdStatus = 'Đã tự động bỏ qua quảng cáo';
      setStatus(lastAdStatus);
    } else if (result?.directWatch && compatibilityMode && status.textContent === lastAdStatus) {
      lastAdStatus = '';
      setStatus('Đang phát ở chế độ tương thích');
    }
  } catch {}
  cleanupBusy = false;
}

urlForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loadVideo(urlInput.value);
});

player.addEventListener('dom-ready', () => {
  if (browsingMode) return;
  setStatus(compatibilityMode ? 'Đang mở chế độ tương thích…' : 'Đang phát');
  clearInterval(cleanupTimer);
  applyCleanMode();
  cleanupTimer = setInterval(applyCleanMode, 700);
});

player.addEventListener('will-navigate', openVideoFromBrowsing);
player.addEventListener('did-navigate-in-page', openVideoFromBrowsing);
window.desktop.onVideoSelected((url) => {
  if (browsingMode) loadVideo(url);
});

player.addEventListener('did-fail-load', (event) => {
  if (event.errorCode !== -3) setStatus('Không thể tải video', true);
});

pinBtn.addEventListener('click', async () => {
  const pinned = await window.desktop.setAlwaysOnTop(!pinBtn.classList.contains('pinned'));
  pinBtn.classList.toggle('pinned', pinned);
  pinBtn.title = pinned ? 'Bỏ ghim cửa sổ' : 'Ghim cửa sổ lên trên cùng';
  setStatus(pinned ? 'Đã ghim trên cùng' : 'Đã bỏ ghim');
});

compactPinBtn.addEventListener('click', () => pinBtn.click());
compactCloseBtn.addEventListener('click', () => window.desktop.close());
youtubeHomeBtn.addEventListener('click', openYouTubeHome);
compactHomeBtn.addEventListener('click', openYouTubeHome);

compactBtn.addEventListener('click', async () => {
  compact = true;
  document.body.classList.add('compact');
  await window.desktop.setCompact(true);
});

showControlsBtn.addEventListener('click', async () => {
  compact = false;
  document.body.classList.remove('compact');
  await window.desktop.setCompact(false);
});

cleanBtn.addEventListener('click', () => {
  cleanMode = !cleanMode;
  cleanBtn.classList.toggle('active', cleanMode);
  cleanBtn.textContent = cleanMode ? '✓ Chế độ gọn' : 'Chế độ gọn';
  setStatus(cleanMode ? 'Đã bật tự động Skip' : 'Đã tắt tự động Skip');
});

function updateLoopUi() {
  loopBtn.classList.toggle('active', loopEnabled);
  loopBtn.textContent = loopEnabled ? '↻ Loop: Bật' : '↻ Loop';
  loopBtn.setAttribute('aria-pressed', String(loopEnabled));
  compactLoopBtn.classList.toggle('active', loopEnabled);
  compactLoopBtn.setAttribute('aria-pressed', String(loopEnabled));
  compactLoopBtn.title = loopEnabled ? 'Tắt loop video' : 'Bật loop video';
  compactLoopBtn.setAttribute('aria-label', compactLoopBtn.title);
}

function toggleLoop() {
  loopEnabled = !loopEnabled;
  localStorage.setItem('loopEnabled', String(loopEnabled));
  updateLoopUi();
  applyCleanMode();
  setStatus(loopEnabled ? 'Đã bật loop video' : 'Đã tắt loop video');
}

loopBtn.addEventListener('click', toggleLoop);
compactLoopBtn.addEventListener('click', toggleLoop);

opacityRange.addEventListener('input', () => window.desktop.setOpacity(Number(opacityRange.value) / 100));
document.querySelector('#minBtn').addEventListener('click', () => window.desktop.minimize());
document.querySelector('#maxBtn').addEventListener('click', () => window.desktop.maximize());
document.querySelector('#closeBtn').addEventListener('click', () => window.desktop.close());

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && compact) showControlsBtn.click();
  if (event.key.toLowerCase() === 'p' && event.ctrlKey) pinBtn.click();
});

(async () => {
  updateLoopUi();
  const state = await window.desktop.getWindowState();
  pinBtn.classList.toggle('pinned', state.alwaysOnTop);
  opacityRange.value = String(Math.round(state.opacity * 100));
  const lastUrl = localStorage.getItem('lastVideoUrl');
  if (lastUrl) urlInput.value = lastUrl;
  urlInput.focus();
})();
