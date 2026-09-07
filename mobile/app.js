import { Browser } from '@capacitor/browser';

const urlForm = document.querySelector('#urlForm');
const urlInput = document.querySelector('#urlInput');
const player = document.querySelector('#player');
const emptyState = document.querySelector('#emptyState');
const loopBtn = document.querySelector('#loopBtn');
const status = document.querySelector('#status');
const youtubeBtn = document.querySelector('#youtubeBtn');
const pipBtn = document.querySelector('#pipBtn');

let currentVideoId = null;
let loopEnabled = localStorage.getItem('iosLoopEnabled') === 'true';

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function playerUrl(videoId) {
  const params = new URLSearchParams({
    autoplay: '1',
    playsinline: '1',
    rel: '0'
  });
  if (loopEnabled) {
    params.set('loop', '1');
    params.set('playlist', videoId);
  }
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params}`;
}

const nativePlayer = window.webkit?.messageHandlers?.youtubePlayer;

function updateNativePlayer(videoId) {
  if (!nativePlayer) return;
  const rect = player.getBoundingClientRect();
  nativePlayer.postMessage({
    ...(videoId ? { videoId, loop: loopEnabled } : {}),
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    hidden: !currentVideoId
  });
}

function playVideo(videoId) {
  player.classList.add('visible');
  emptyState.hidden = true;
  if (nativePlayer) {
    updateNativePlayer(videoId);
  } else {
    player.src = playerUrl(videoId);
  }
}

if (nativePlayer) {
  new ResizeObserver(() => updateNativePlayer()).observe(player);
  window.addEventListener('resize', () => updateNativePlayer());
  window.addEventListener('scroll', () => updateNativePlayer(), true);
}

function renderLoopState() {
  loopBtn.classList.toggle('active', loopEnabled);
  loopBtn.setAttribute('aria-pressed', String(loopEnabled));
  loopBtn.textContent = loopEnabled ? '↻ Loop: Bật' : '↻ Loop';
}

function loadVideo(value) {
  const videoId = window.YouTubeUrl.extractVideoId(value);
  if (!videoId) {
    setStatus('Đường dẫn YouTube không hợp lệ', true);
    urlInput.focus();
    urlInput.select();
    return;
  }

  currentVideoId = videoId;
  const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
  localStorage.setItem('iosLastVideoUrl', normalizedUrl);
  urlInput.value = normalizedUrl;
  playVideo(videoId);
  setStatus('Đang phát');
}

urlForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loadVideo(urlInput.value);
});

loopBtn.addEventListener('click', () => {
  loopEnabled = !loopEnabled;
  localStorage.setItem('iosLoopEnabled', String(loopEnabled));
  renderLoopState();
  if (currentVideoId) playVideo(currentVideoId);
  setStatus(loopEnabled ? 'Đã bật loop' : 'Đã tắt loop');
});

window.addEventListener('youtube:video-selected', (event) => {
  if (typeof event.detail?.url === 'string') loadVideo(event.detail.url);
});

youtubeBtn.addEventListener('click', async () => {
  if (nativePlayer) {
    nativePlayer.postMessage({ action: 'openBrowser' });
    return;
  }
  try {
    await Browser.open({ url: 'https://www.youtube.com/' });
  } catch {
    window.open('https://www.youtube.com/', '_blank', 'noopener,noreferrer');
  }
});

pipBtn.addEventListener('click', () => {
  if (!currentVideoId) {
    setStatus('Hãy phát video trước khi bật PiP.', true);
    return;
  }
  if (!nativePlayer) {
    setStatus('Hãy dùng nút PiP trong trình phát hoặc mở ứng dụng iOS.', true);
    return;
  }
  setStatus('Đang yêu cầu phát PiP…');
  nativePlayer.postMessage({ action: 'startPiP' });
});

window.addEventListener('youtube:pip-status', (event) => {
  const messages = {
    active: 'Đang phát PiP',
    inline: 'Đã trở về trình phát',
    unavailable: 'Chưa bật được PiP. Hãy chạm phát video rồi thử lại; nếu cần, mở toàn màn hình và nhấn PiP.'
  };
  const state = event.detail?.state;
  if (messages[state]) setStatus(messages[state], state === 'unavailable');
});

renderLoopState();
const lastUrl = localStorage.getItem('iosLastVideoUrl');
if (lastUrl) urlInput.value = lastUrl;
