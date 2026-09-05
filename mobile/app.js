import { Browser } from '@capacitor/browser';

const urlForm = document.querySelector('#urlForm');
const urlInput = document.querySelector('#urlInput');
const player = document.querySelector('#player');
const emptyState = document.querySelector('#emptyState');
const loopBtn = document.querySelector('#loopBtn');
const status = document.querySelector('#status');
const youtubeBtn = document.querySelector('#youtubeBtn');
const pipHelpBtn = document.querySelector('#pipHelpBtn');
const pipDialog = document.querySelector('#pipDialog');

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
  player.src = playerUrl(videoId);
  player.classList.add('visible');
  emptyState.hidden = true;
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
  if (currentVideoId) player.src = playerUrl(currentVideoId);
  setStatus(loopEnabled ? 'Đã bật loop' : 'Đã tắt loop');
});

youtubeBtn.addEventListener('click', async () => {
  try {
    await Browser.open({ url: 'https://www.youtube.com/' });
  } catch {
    window.open('https://www.youtube.com/', '_blank', 'noopener,noreferrer');
  }
});

pipHelpBtn.addEventListener('click', () => {
  if (typeof pipDialog.showModal === 'function') pipDialog.showModal();
  else setStatus('Mở video toàn màn hình và chọn nút PiP nếu YouTube cung cấp.');
});

renderLoopState();
const lastUrl = localStorage.getItem('iosLastVideoUrl');
if (lastUrl) urlInput.value = lastUrl;
