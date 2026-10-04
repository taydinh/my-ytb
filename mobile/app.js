import { Browser } from '@capacitor/browser';

const urlForm = document.querySelector('#urlForm');
const urlInput = document.querySelector('#urlInput');
const player = document.querySelector('#player');
const emptyState = document.querySelector('#emptyState');
const loopBtn = document.querySelector('#loopBtn');
const status = document.querySelector('#status');
const youtubeBtn = document.querySelector('#youtubeBtn');
const pipBtn = document.querySelector('#pipBtn');
const historyBtn = document.querySelector('#historyBtn');
const historyDialog = document.querySelector('#historyDialog');
const historyCloseBtn = document.querySelector('#historyCloseBtn');
const historyList = document.querySelector('#historyList');

let currentVideoId = null;
let loopEnabled = localStorage.getItem('iosLoopEnabled') === 'true';
let historyDialogOpen = false;
const pendingMetadata = new Set();

const HISTORY_KEY = 'iosVideoHistory';
const HISTORY_LIMIT = 50;

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

function updateNativePlayer(videoId = null) {
  if (!nativePlayer) return;
  const rect = player.getBoundingClientRect();
  nativePlayer.postMessage({
    ...(videoId ? { videoId, loop: loopEnabled } : {}),
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    hidden: !currentVideoId || historyDialogOpen
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

function readHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((item) => item && typeof item.videoId === 'string').slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function addToHistory(videoId) {
  const entry = {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    playedAt: new Date().toISOString()
  };
  const history = readHistory().filter((item) => item.videoId !== videoId);
  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
  requestVideoMetadata(videoId);
}

function formatPlayedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (elapsedSeconds < 60) return 'Vừa xong';
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes} phút trước`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} giờ trước`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays <= 30) return `${elapsedDays} ngày trước`;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

function requestVideoMetadata(videoId) {
  if (!nativePlayer || pendingMetadata.has(videoId)) return;
  pendingMetadata.add(videoId);
  nativePlayer.postMessage({ action: 'getVideoMetadata', videoId });
}

function saveVideoMetadata(metadata) {
  if (!metadata || typeof metadata.videoId !== 'string') return;
  pendingMetadata.delete(metadata.videoId);
  const history = readHistory();
  const item = history.find((entry) => entry.videoId === metadata.videoId);
  if (!item) return;
  if (typeof metadata.title === 'string' && metadata.title.trim()) item.title = metadata.title.trim();
  if (typeof metadata.thumbnailUrl === 'string' && metadata.thumbnailUrl.startsWith('https://i.ytimg.com/')) {
    item.thumbnailUrl = metadata.thumbnailUrl;
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  if (historyDialogOpen) renderHistory();
}

function renderHistory() {
  const history = readHistory();
  historyList.replaceChildren();

  if (!history.length) {
    const empty = document.createElement('p');
    empty.className = 'history-empty';
    empty.textContent = 'Chưa có video nào trong History.';
    historyList.append(empty);
    return;
  }

  history.forEach((item, index) => {
    if (!item.title) requestVideoMetadata(item.videoId);
    const button = document.createElement('button');
    button.className = 'history-item';
    button.type = 'button';
    button.dataset.url = item.url || `https://www.youtube.com/watch?v=${item.videoId}`;

    const thumbnail = document.createElement('img');
    thumbnail.className = 'history-thumbnail';
    thumbnail.src = item.thumbnailUrl || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`;
    thumbnail.alt = '';
    thumbnail.loading = 'lazy';

    const details = document.createElement('span');
    details.className = 'history-details';
    const title = document.createElement('strong');
    title.textContent = item.title || `Video YouTube · ${item.videoId}`;
    const playedAt = document.createElement('small');
    playedAt.textContent = formatPlayedAt(item.playedAt);
    details.append(title, playedAt);

    const playIcon = document.createElement('span');
    playIcon.className = 'history-play';
    playIcon.textContent = '▶';
    playIcon.setAttribute('aria-hidden', 'true');
    button.setAttribute('aria-label', `${index + 1}. ${title.textContent}`);
    button.append(thumbnail, details, playIcon);
    historyList.append(button);
  });
}

function closeHistory() {
  historyDialog.close();
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
  addToHistory(videoId);
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

historyBtn.addEventListener('click', () => {
  historyDialogOpen = true;
  renderHistory();
  updateNativePlayer();
  historyDialog.showModal();
});

historyCloseBtn.addEventListener('click', closeHistory);

historyList.addEventListener('click', (event) => {
  const item = event.target.closest('.history-item');
  if (!item) return;
  closeHistory();
  loadVideo(item.dataset.url);
});

historyDialog.addEventListener('click', (event) => {
  if (event.target === historyDialog) closeHistory();
});

historyDialog.addEventListener('close', () => {
  historyDialogOpen = false;
  updateNativePlayer();
});

window.addEventListener('youtube:video-metadata', (event) => {
  saveVideoMetadata(event.detail);
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
