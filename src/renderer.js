const urlForm = document.querySelector('#urlForm');
const urlInput = document.querySelector('#urlInput');
const player = document.querySelector('#player');
const emptyState = document.querySelector('#emptyState');
const status = document.querySelector('#status');
const youtubeHomeBtn = document.querySelector('#youtubeHomeBtn');
const favoritesMenuBtn = document.querySelector('#favoritesMenuBtn');
const favoriteBtn = document.querySelector('#favoriteBtn');
const favoritesCount = document.querySelector('#favoritesCount');
const favoritesPanel = document.querySelector('#favoritesPanel');
const favoritesList = document.querySelector('#favoritesList');
const favoritesEmpty = document.querySelector('#favoritesEmpty');
const favoritesSummary = document.querySelector('#favoritesSummary');
const closeFavoritesBtn = document.querySelector('#closeFavoritesBtn');
const youtubePanel = document.querySelector('#youtubePanel');
const youtubeBrowser = document.querySelector('#youtubeBrowser');
const closeYoutubePanelBtn = document.querySelector('#closeYoutubePanelBtn');
const panelSplitter = document.querySelector('#panelSplitter');
const favoritesSplitter = document.querySelector('#favoritesSplitter');
let favoritesPanelWidth = Number(localStorage.getItem('favoritesPanelWidth')) || 340;
let resizingFavoritesPanel = false;

function setFavoritesPanelWidth(width, persist = true) {
  const mainWidth = document.querySelector('main').clientWidth;
  const otherWidth = youtubePanelOpen ? youtubePanel.offsetWidth + panelSplitter.offsetWidth : 0;
  const maximum = Math.max(220, mainWidth - otherWidth - 300 - favoritesSplitter.offsetWidth);
  const nextWidth = Math.round(Math.max(220, Math.min(Number(width) || 340, maximum)));
  document.documentElement.style.setProperty('--favorites-panel-width', `${nextWidth}px`);
  favoritesSplitter.setAttribute('aria-valuenow', String(nextWidth));
  favoritesSplitter.setAttribute('aria-valuemax', String(Math.round(maximum)));
  if (persist) {
    favoritesPanelWidth = nextWidth;
    localStorage.setItem('favoritesPanelWidth', String(nextWidth));
  }
}
const pinBtn = document.querySelector('#pinBtn');
const compactBtn = document.querySelector('#compactBtn');
const cleanBtn = document.querySelector('#cleanBtn');
const adblockBtn = document.querySelector('#adblockBtn');
const reloadPlayerBtn = document.querySelector('#reloadPlayerBtn');
const loopBtn = document.querySelector('#loopBtn');
const showControlsBtn = document.querySelector('#showControlsBtn');
const compactHomeBtn = document.querySelector('#compactHomeBtn');
const compactPinBtn = document.querySelector('#compactPinBtn');
const compactLoopBtn = document.querySelector('#compactLoopBtn');
const compactCloseBtn = document.querySelector('#compactCloseBtn');
const opacityRange = document.querySelector('#opacityRange');
const videoTitle = document.querySelector('#videoTitle');
const snapBtn = document.querySelector('#snapBtn');
const settingsBtn = document.querySelector('#settingsBtn');
const compactSnapBtn = document.querySelector('#compactSnapBtn');
const snapFeedback = document.querySelector('#snapFeedback');
const snapFeedbackText = document.querySelector('#snapFeedbackText');
const settingsModal = document.querySelector('#settingsModal');
const closeSettingsBtn = document.querySelector('#closeSettingsBtn');
const doneSettingsBtn = document.querySelector('#doneSettingsBtn');
const snapToggle = document.querySelector('#snapToggle');
const micStatusBadge = document.querySelector('#micStatusBadge');
const snapIndicator = document.querySelector('#snapIndicator');
const micMeterBar = document.querySelector('#micMeterBar');
const snapSensitivityRange = document.querySelector('#snapSensitivityRange');
const sensitivityValueLabel = document.querySelector('#sensitivityValueLabel');
const snapCooldownSelect = document.querySelector('#snapCooldownSelect');

let compact = false;
let cleanMode = true;
let loopEnabled = localStorage.getItem('loopEnabled') === 'true';
let snapEnabled = localStorage.getItem('snapControlEnabled') === 'true';
let snapSensitivity = Number(localStorage.getItem('snapSensitivity')) || 60;
let snapCooldown = Number(localStorage.getItem('snapCooldown')) || 800;
let snapDetector = null;
let snapFeedbackTimer = null;
let snapIndicatorTimer = null;
let cleanupTimer;
let cleanupBusy = false;
let currentVideoId = null;
let currentVideoDuration = 0;
let currentVideoChannel = { channelName: '', channelUrl: '' };
let favoritesPanelOpen = false;
let favoriteVideos = window.FavoritesStore.load(localStorage);
const favoriteMetadataRequests = new Set();
let draggedFavoriteId = null;
let compatibilityMode = false;
let youtubePanelOpen = false;
let lastAdStatus = '';
let adblockState = { enabled: true, active: false };
let lastContentMedia = null;
let pendingRestore = null;
const { extractVideoId, extractBrowsableVideoId } = window.YouTubeUrl;
const { getAction: getPlayerShortcutAction, isEditableTarget, createPlayerScript } = window.PlayerShortcuts;
const YOUTUBE_HOME_URL = 'https://www.youtube.com/';
const DEFAULT_YOUTUBE_PANEL_WIDTH = 620;
const MIN_YOUTUBE_PANEL_WIDTH = 360;
const MIN_PRIMARY_PANE_WIDTH = 420;
let youtubePanelWidth = Number(localStorage.getItem('youtubePanelWidth')) || DEFAULT_YOUTUBE_PANEL_WIDTH;
let resizingYoutubePanel = false;

const floatingControls = document.querySelector('.floating-controls');
let pointerCheckBusy = false;
// Native drag regions swallow DOM pointer events, including CSS :hover.
async function updateFloatingControlsHover() {
  if (pointerCheckBusy) return;
  if (!compact || youtubePanelOpen || document.hidden || !window.desktop.getPointer) {
    floatingControls.classList.remove('pointer-over');
    return;
  }
  pointerCheckBusy = true;
  try {
    const point = await window.desktop.getPointer();
    const bounds = floatingControls.getBoundingClientRect();
    floatingControls.classList.toggle('pointer-over', Boolean(
      compact && !youtubePanelOpen && !document.hidden && point &&
      point.x >= bounds.left && point.x < bounds.right &&
      point.y >= bounds.top && point.y < bounds.bottom
    ));
  } catch {
    floatingControls.classList.remove('pointer-over');
  } finally {
    pointerCheckBusy = false;
  }
}
const floatingHoverTimer = setInterval(updateFloatingControlsHover, 75);
window.addEventListener('beforeunload', () => clearInterval(floatingHoverTimer));

function setStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? '#ff7187' : '';
}

function setVideoTitle(title) {
  const text = String(title || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    videoTitle.hidden = true;
    videoTitle.textContent = '';
    videoTitle.removeAttribute('title');
    return;
  }
  videoTitle.hidden = false;
  videoTitle.textContent = text;
  videoTitle.title = text;
  updateCurrentFavoriteMetadata({ title: text });
}

function persistFavorites() {
  favoriteVideos = window.FavoritesStore.save(localStorage, favoriteVideos);
  renderFavorites();
  updateFavoriteButton();
}

function currentFavoriteIndex() {
  return favoriteVideos.findIndex((item) => item.id === currentVideoId);
}

function updateFavoriteButton() {
  const active = currentFavoriteIndex() >= 0;
  favoriteBtn.disabled = !currentVideoId;
  favoriteBtn.classList.toggle('active', active);
  favoriteBtn.setAttribute('aria-pressed', String(active));
  favoriteBtn.textContent = active ? '★' : '☆';
  favoriteBtn.title = !currentVideoId
    ? 'Hãy phát một video để thêm vào yêu thích'
    : active ? 'Bỏ khỏi danh sách yêu thích' : 'Thêm video đang phát vào yêu thích';
}

function updateCurrentFavoriteMetadata(metadata) {
  const index = currentFavoriteIndex();
  if (index < 0) return;
  const item = favoriteVideos[index];
  const title = String(metadata.title || '').trim();
  const duration = Math.max(0, Math.round(Number(metadata.duration) || 0));
  const nextTitle = (!item.customTitle && title) ? title : item.title;
  const nextDuration = duration || item.duration;
  const channelName = String(metadata.channelName || '').replace(/\s+/g, ' ').trim() || item.channelName;
  const channelUrl = window.FavoritesStore.sanitizeChannelUrl(metadata.channelUrl) || item.channelUrl;
  if (nextTitle === item.title && nextDuration === item.duration && channelName === item.channelName && channelUrl === item.channelUrl) return;
  favoriteVideos[index] = {
    ...item,
    title: nextTitle,
    duration: nextDuration,
    channelName,
    channelUrl
  };
  persistFavorites();
}

function createFavoriteAction(label, title, action, disabled = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'favorite-action';
  button.textContent = label;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.dataset.action = action;
  button.disabled = disabled;
  return button;
}

function renderFavorites() {
  favoritesList.replaceChildren();
  favoritesEmpty.hidden = favoriteVideos.length > 0;
  favoritesCount.textContent = String(favoriteVideos.length);
  favoritesSummary.textContent = `${favoriteVideos.length} video`;

  favoriteVideos.forEach((item, index) => {
    const row = document.createElement('article');
    row.className = 'favorite-item';
    row.draggable = true;
    row.dataset.id = item.id;
    row.classList.toggle('playing', item.id === currentVideoId);

    const handle = document.createElement('span');
    handle.className = 'favorite-drag-handle';
    handle.textContent = '⠿';
    handle.title = 'Kéo để đổi vị trí';

    const thumbnailButton = document.createElement('button');
    thumbnailButton.type = 'button';
    thumbnailButton.className = 'favorite-thumbnail';
    thumbnailButton.dataset.action = 'play';
    thumbnailButton.title = `Phát ${item.title}`;
    const image = document.createElement('img');
    image.src = item.thumbnail;
    image.alt = '';
    image.loading = 'lazy';
    const duration = document.createElement('span');
    duration.textContent = window.FavoritesStore.formatDuration(item.duration);
    thumbnailButton.append(image, duration);

    const details = document.createElement('div');
    details.className = 'favorite-details';
    const titleButton = document.createElement('button');
    titleButton.type = 'button';
    titleButton.className = 'favorite-title';
    titleButton.dataset.action = 'play';
    titleButton.textContent = item.title;
    titleButton.title = item.title;
    const channelButton = document.createElement('button');
    channelButton.type = 'button';
    channelButton.className = 'favorite-channel';
    channelButton.dataset.action = 'channel';
    channelButton.textContent = item.channelName || 'Đang tìm channel…';
    channelButton.title = item.channelName ? `Mở channel ${item.channelName} trong YouTube Home` : 'Chưa có thông tin channel';
    channelButton.disabled = !item.channelUrl;
    const actions = document.createElement('div');
    actions.className = 'favorite-actions';
    actions.append(
      createFavoriteAction('↑', 'Đưa lên trên', 'up', index === 0),
      createFavoriteAction('↓', 'Đưa xuống dưới', 'down', index === favoriteVideos.length - 1),
      createFavoriteAction('✎', 'Sửa tiêu đề', 'edit'),
      createFavoriteAction('×', 'Xóa khỏi yêu thích', 'delete')
    );
    details.append(titleButton, channelButton, actions);
    row.append(handle, thumbnailButton, details);
    favoritesList.append(row);
  });
}

async function openFavoritesPanel() {
  if (compact) {
    compact = false;
    document.body.classList.remove('compact');
    await window.desktop.setCompact(false);
  }
  favoritesPanelOpen = true;
  document.body.classList.add('favorites-panel-open');
  setFavoritesPanelWidth(favoritesPanelWidth, false);
  favoritesPanel.setAttribute('aria-hidden', 'false');
  favoritesMenuBtn.classList.add('active');
  favoritesMenuBtn.setAttribute('aria-expanded', 'true');
  enrichFavoriteChannels();
}

function closeFavoritesPanel() {
  favoritesPanelOpen = false;
  document.body.classList.remove('favorites-panel-open');
  favoritesPanel.setAttribute('aria-hidden', 'true');
  favoritesMenuBtn.classList.remove('active');
  favoritesMenuBtn.setAttribute('aria-expanded', 'false');
}

function toggleCurrentFavorite() {
  if (!currentVideoId) return;
  const index = currentFavoriteIndex();
  if (index >= 0) {
    favoriteVideos.splice(index, 1);
    setStatus('Đã bỏ video khỏi danh sách yêu thích');
  } else {
    favoriteVideos.unshift({
      id: currentVideoId,
      title: videoTitle.textContent || 'Video chưa có tiêu đề',
      duration: currentVideoDuration,
      addedAt: Date.now(),
      customTitle: false,
      channelName: currentVideoChannel.channelName,
      channelUrl: currentVideoChannel.channelUrl
    });
    setStatus('Đã thêm video vào danh sách yêu thích');
  }
  persistFavorites();
  if (index < 0 && !currentVideoChannel.channelUrl) refreshFavoriteMetadata(currentVideoId);
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
  // The player stays in the primary pane while YouTube Home is open beside it.
}

function setYouTubePanelWidth(width, persist = true) {
  const available = Math.max(240, document.querySelector('main').clientWidth - MIN_PRIMARY_PANE_WIDTH - panelSplitter.offsetWidth);
  const minimum = Math.min(MIN_YOUTUBE_PANEL_WIDTH, available);
  youtubePanelWidth = Math.round(Math.max(minimum, Math.min(Number(width) || DEFAULT_YOUTUBE_PANEL_WIDTH, available)));
  document.documentElement.style.setProperty('--youtube-panel-width', `${youtubePanelWidth}px`);
  panelSplitter.setAttribute('aria-valuenow', String(youtubePanelWidth));
  panelSplitter.setAttribute('aria-valuemax', String(Math.round(available)));
  if (persist) localStorage.setItem('youtubePanelWidth', String(youtubePanelWidth));
}

function loadVideo(value) {
  const id = extractVideoId(value);
  if (!id) {
    setStatus('URL YouTube không hợp lệ', true);
    urlInput.focus();
    urlInput.select();
    return;
  }

  const normalizedUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  urlInput.value = normalizedUrl;
  localStorage.setItem('lastVideoUrl', normalizedUrl);
  showPlayerLayout();
  currentVideoId = id;
  currentVideoDuration = 0;
  currentVideoChannel = { channelName: '', channelUrl: '' };
  lastContentMedia = null;
  pendingRestore = null;
  compatibilityMode = false;
  setVideoTitle('');
  updateFavoriteButton();
  renderFavorites();
  player.src = playerUrl(id);
  player.classList.add('visible');
  emptyState.classList.add('hidden');
  setStatus('Đang tải video…');
}

async function openYouTubeHome() {
  if (compact) {
    compact = false;
    document.body.classList.remove('compact');
    await window.desktop.setCompact(false);
  }
  if (youtubePanelOpen) {
    youtubeBrowser.focus();
    return;
  }
  youtubePanelOpen = true;
  document.body.classList.add('youtube-panel-open');
  youtubePanel.setAttribute('aria-hidden', 'false');
  youtubeHomeBtn.classList.add('active');
  youtubeHomeBtn.setAttribute('aria-pressed', 'true');
  youtubeHomeBtn.setAttribute('aria-expanded', 'true');
  await window.desktop.setYoutubePanel(true);
  setYouTubePanelWidth(youtubePanelWidth, false);
  if (!youtubeBrowser.src) youtubeBrowser.src = YOUTUBE_HOME_URL;
  youtubeBrowser.focus();
}

async function openChannelInYouTubeHome(channelUrl) {
  const safeUrl = window.FavoritesStore.sanitizeChannelUrl(channelUrl);
  if (!safeUrl) return;
  await openYouTubeHome();
  youtubeBrowser.src = safeUrl;
  youtubeBrowser.focus();
}

async function refreshFavoriteMetadata(videoId) {
  if (!window.desktop.getYouTubeMetadata || favoriteMetadataRequests.has(videoId)) return false;
  favoriteMetadataRequests.add(videoId);
  try {
    const metadata = await window.desktop.getYouTubeMetadata(videoId);
    const channelUrl = window.FavoritesStore.sanitizeChannelUrl(metadata?.channelUrl);
    const index = favoriteVideos.findIndex((item) => item.id === videoId);
    if (index < 0 || !channelUrl) return false;
    const item = favoriteVideos[index];
    favoriteVideos[index] = {
      ...item,
      title: !item.customTitle && metadata.title
        ? String(metadata.title).replace(/\s+/g, ' ').trim()
        : item.title,
      channelName: String(metadata.channelName || '').replace(/\s+/g, ' ').trim(),
      channelUrl
    };
    persistFavorites();
    return true;
  } catch {
    return false;
  } finally {
    favoriteMetadataRequests.delete(videoId);
  }
}

async function enrichFavoriteChannels() {
  for (const item of favoriteVideos.filter((favorite) => !favorite.channelUrl)) {
    await refreshFavoriteMetadata(item.id);
  }
}

async function closeYouTubeHome() {
  if (!youtubePanelOpen) return;
  youtubePanelOpen = false;
  document.body.classList.remove('youtube-panel-open');
  youtubePanel.setAttribute('aria-hidden', 'true');
  youtubeHomeBtn.classList.remove('active');
  youtubeHomeBtn.setAttribute('aria-pressed', 'false');
  youtubeHomeBtn.setAttribute('aria-expanded', 'false');
  await window.desktop.setYoutubePanel(false);
}

function openVideoFromBrowsing(event) {
  if (!youtubePanelOpen) return;
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
    if (!globalThis.__ytfpHelperState?.restored) globalThis.__ytfpRestore = ${JSON.stringify(pendingRestore)};

    // /watch is the fallback used when YouTube refuses the embed player. Keep
    // that fallback visually identical to an embed instead of exposing the
    // responsive watch page (recommendations/comments can otherwise cover the
    // video when the host window is maximized).
    const forceWatchPlayerLayout = () => {
      if (location.pathname !== '/watch') return null;
      const watchPlayer = document.querySelector('#movie_player, .html5-video-player');
      if (!watchPlayer) return null;

      const important = (element, properties) => {
        if (!element?.style?.setProperty) return;
        for (const [name, value] of Object.entries(properties)) {
          element.style.setProperty(name, value, 'important');
        }
      };
      important(document.documentElement, { width: '100%', height: '100%', overflow: 'hidden', background: '#000' });
      important(document.body, { width: '100%', height: '100%', margin: '0', overflow: 'hidden', background: '#000' });
      important(watchPlayer, {
        position: 'fixed', inset: '0', width: '100vw', height: '100vh',
        'min-width': '0', 'min-height': '0', 'max-width': 'none', 'max-height': 'none',
        margin: '0', transform: 'none', 'z-index': '2147483647', background: '#000'
      });

      const videoContainer = watchPlayer.querySelector('.html5-video-container');
      important(videoContainer, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
      const video = watchPlayer.querySelector('video');
      important(video, {
        position: 'absolute', inset: '0', width: '100%', height: '100%',
        'object-fit': 'contain', transform: 'none'
      });

      // Some YouTube surfaces also use the maximum z-index. Hide the watch-page
      // chrome explicitly so DOM order cannot put it above the player.
      for (const selector of [
        'ytd-masthead', '#secondary', '#below', '#comments', '#chat-container',
        '#panels', '#related', '#playlist', '#cinematics', 'ytd-miniplayer',
        'tp-yt-app-drawer', 'ytd-popup-container'
      ]) {
        document.querySelectorAll(selector).forEach((element) => important(element, { display: 'none' }));
      }
      return watchPlayer;
    };

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
        if (Date.now() - state.lastSkipAt < 500) return false;
        const found = findSkipButton();
        if (!found) return false;
        const button = found.closest('button, [role="button"]') || found;
        if (button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
        button.click();
        state.lastSkipAt = Date.now();
        return true;
      };

      const tick = () => {
        forceWatchPlayerLayout();
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
          const restore = globalThis.__ytfpRestore;
          if (!adShowing && video && video.readyState >= 1 && restore) {
            if (Number.isFinite(video.duration) && video.duration > 0) {
              video.currentTime = Math.min(restore.time, Math.max(0, video.duration - 0.1));
              video.muted = restore.muted;
              video.volume = restore.volume;
              video.playbackRate = restore.rate;
              if (restore.paused) video.pause();
              else video.play().catch(() => {});
              state.restored = true;
              globalThis.__ytfpRestore = null;
            }
          }
          if (!adShowing && video && video.readyState >= 1 && Number.isFinite(video.duration) && !moviePlayer?.getVideoData?.().isLive) {
            state.contentMedia = {
              time: video.currentTime, muted: video.muted, volume: video.volume,
              rate: video.playbackRate, paused: video.paused, duration: video.duration
            };
          }
        }

        if (globalThis.__ytfpCleanEnabled) {
          for (const selector of ['.ytp-ad-overlay-container', '.ytp-ad-player-overlay']) {
            document.querySelectorAll(selector).forEach((element) => { element.style.display = 'none'; });
          }
        }
      };

      globalThis.__ytfpHelperTimer = setInterval(tick, 200);
      let mutationTimer;
      const observer = new MutationObserver(() => {
        if (mutationTimer) return;
        mutationTimer = setTimeout(() => { mutationTimer = null; tick(); }, 50);
      });
      observer.observe(document.documentElement, {
        subtree: true, childList: true, attributes: true,
        attributeFilter: ['class', 'disabled', 'aria-disabled']
      });
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
    const watchPlayer = forceWatchPlayerLayout();
    // Prefer the player error panel; page recommendations can mention errors too.
    const errorPanel = document.querySelector('.ytp-error-content-wrap, .ytp-error');
    const errorText = errorPanel?.innerText || (location.pathname.startsWith('/embed/') ? document.body?.innerText || '' : '');
    // These regexes run inside a template string: preserve their backslashes.
    const errorCode = errorText.match(/(?:error code|mã lỗi)\\s*:\\s*(\\d+(?:\\s*-\\s*\\d+)*)/i)?.[1]?.replace(/\\s+/g, '') || '';
    const unavailable = Boolean(errorPanel?.innerText?.trim()) || Boolean(errorCode) ||
      /this video is unavailable|video unavailable|this video isn't available|không xem được video|video này không hoạt động|video không có sẵn/i.test(errorText);
    const videoData = document.querySelector('#movie_player, .html5-video-player')?.getVideoData?.() || {};
    const pageTitle = (document.querySelector('.ytp-title-link, .ytp-title-text')?.textContent || '')
      .replace(/\\s+/g, ' ').trim();
    const playerTitle = String(videoData.title || '').replace(/\\s+/g, ' ').trim();
    return {
      unavailable,
      errorCode,
      directWatch: location.pathname === '/watch',
      adShowing: globalThis.__ytfpHelperState?.adShowing || false,
      contentMedia: globalThis.__ytfpHelperState?.contentMedia || null,
      restored: globalThis.__ytfpHelperState?.restored || false,
      lastSkipAt: globalThis.__ytfpHelperState?.lastSkipAt || 0,
      title: globalThis.__ytfpHelperState?.adShowing ? '' : (playerTitle || pageTitle),
      channelName: globalThis.__ytfpHelperState?.adShowing ? '' : String(videoData.author || '').replace(/\\s+/g, ' ').trim(),
      channelUrl: globalThis.__ytfpHelperState?.adShowing || !videoData.channelId ? '' : 'https://www.youtube.com/channel/' + videoData.channelId,
      duration: (!globalThis.__ytfpHelperState?.adShowing && Number.isFinite(globalThis.__ytfpHelperState?.contentMedia?.duration))
        ? globalThis.__ytfpHelperState.contentMedia.duration : 0
    };
  })()`;
  const source = player.src;
  try {
    const result = await player.executeJavaScript(script);
    if (source !== player.src) return;
    if (result?.contentMedia) lastContentMedia = result.contentMedia;
    if (result?.restored) pendingRestore = null;
    if (result?.title) setVideoTitle(result.title);
    if (result?.channelUrl) {
      currentVideoChannel = { channelName: result.channelName || '', channelUrl: result.channelUrl };
      updateCurrentFavoriteMetadata(currentVideoChannel);
    }
    if (result?.duration) {
      currentVideoDuration = Math.round(result.duration);
      updateCurrentFavoriteMetadata({ duration: currentVideoDuration });
    }
    if (result?.unavailable && !compatibilityMode && currentVideoId) {
      compatibilityMode = true;
      setStatus(`Embed lỗi ${result.errorCode || ''} — đang chuyển chế độ tương thích…`);
      player.src = watchUrl(currentVideoId);
    } else if (result?.unavailable && compatibilityMode) {
      setStatus(`YouTube không phát được video${result.errorCode ? ` (${result.errorCode})` : ''}. Thử tắt Chặn quảng cáo và Chế độ gọn, rồi Tải lại.`, true);
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
  } catch {} finally { cleanupBusy = false; }
}

urlForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loadVideo(urlInput.value);
});

player.addEventListener('dom-ready', () => {
  window.desktop.registerPlayerShortcuts(player.getWebContentsId()).catch(() => {});
  setStatus(compatibilityMode ? 'Đang mở chế độ tương thích…' : 'Đang phát');
  clearInterval(cleanupTimer);
  applyCleanMode();
  cleanupTimer = setInterval(applyCleanMode, 700);
});

youtubeBrowser.addEventListener('will-navigate', openVideoFromBrowsing);
youtubeBrowser.addEventListener('did-navigate-in-page', openVideoFromBrowsing);
youtubeBrowser.addEventListener('ipc-message', (event) => {
  if (event.channel !== 'youtube-video-selected' || !youtubePanelOpen) return;
  const [url] = event.args || [];
  if (extractBrowsableVideoId(url)) loadVideo(url);
});
window.desktop.onVideoSelected((selection) => {
  const url = typeof selection === 'string' ? selection : selection?.url;
  const sourceId = typeof selection === 'object' ? selection?.sourceId : null;
  if (!youtubePanelOpen || !url) return;
  if (sourceId && sourceId !== youtubeBrowser.getWebContentsId()) return;
  loadVideo(url);
});

player.addEventListener('did-fail-load', (event) => {
  if (event.errorCode !== -3) setStatus('Không thể tải video', true);
});

function updatePinUi(pinned) {
  pinBtn.classList.toggle('pinned', pinned);
  compactPinBtn.classList.toggle('active', pinned);
  for (const button of [pinBtn, compactPinBtn]) {
    button.title = pinned ? 'Bỏ ghim cửa sổ' : 'Ghim cửa sổ lên trên cùng';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', String(pinned));
  }
}

pinBtn.addEventListener('click', async () => {
  const pinned = await window.desktop.setAlwaysOnTop(!pinBtn.classList.contains('pinned'));
  updatePinUi(pinned);
  setStatus(pinned ? 'Đã ghim trên cùng' : 'Đã bỏ ghim');
});

compactPinBtn.addEventListener('click', () => pinBtn.click());
compactCloseBtn.addEventListener('click', () => window.desktop.close());
youtubeHomeBtn.addEventListener('click', openYouTubeHome);
favoritesMenuBtn.addEventListener('click', () => favoritesPanelOpen ? closeFavoritesPanel() : openFavoritesPanel());
favoriteBtn.addEventListener('click', toggleCurrentFavorite);
closeFavoritesBtn.addEventListener('click', closeFavoritesPanel);
compactHomeBtn.addEventListener('click', openYouTubeHome);
closeYoutubePanelBtn.addEventListener('click', closeYouTubeHome);

favoritesList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  const row = event.target.closest('.favorite-item');
  if (!button || !row) return;
  const index = favoriteVideos.findIndex((item) => item.id === row.dataset.id);
  if (index < 0) return;
  const action = button.dataset.action;
  if (action === 'play') {
    loadVideo(favoriteVideos[index].id);
  } else if (action === 'channel') {
    openChannelInYouTubeHome(favoriteVideos[index].channelUrl);
  } else if (action === 'delete') {
    const [removed] = favoriteVideos.splice(index, 1);
    persistFavorites();
    setStatus(`Đã xóa “${removed.title}” khỏi yêu thích`);
  } else if (action === 'edit') {
    const title = window.prompt('Sửa tiêu đề video:', favoriteVideos[index].title);
    if (title?.trim()) {
      favoriteVideos[index].title = title.replace(/\s+/g, ' ').trim();
      favoriteVideos[index].customTitle = true;
      persistFavorites();
    }
  } else if (action === 'up' || action === 'down') {
    const target = action === 'up' ? index - 1 : index + 1;
    favoriteVideos = window.FavoritesStore.move(favoriteVideos, index, target);
    persistFavorites();
  }
});

favoritesList.addEventListener('dragstart', (event) => {
  const row = event.target.closest('.favorite-item');
  if (!row) return;
  draggedFavoriteId = row.dataset.id;
  row.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', draggedFavoriteId);
});
favoritesList.addEventListener('dragover', (event) => {
  const row = event.target.closest('.favorite-item');
  if (!row || row.dataset.id === draggedFavoriteId) return;
  event.preventDefault();
  row.classList.add('drag-over');
});
favoritesList.addEventListener('dragleave', (event) => event.target.closest('.favorite-item')?.classList.remove('drag-over'));
favoritesList.addEventListener('drop', (event) => {
  const row = event.target.closest('.favorite-item');
  if (!row || !draggedFavoriteId) return;
  event.preventDefault();
  const from = favoriteVideos.findIndex((item) => item.id === draggedFavoriteId);
  const to = favoriteVideos.findIndex((item) => item.id === row.dataset.id);
  favoriteVideos = window.FavoritesStore.move(favoriteVideos, from, to);
  draggedFavoriteId = null;
  persistFavorites();
});
favoritesList.addEventListener('dragend', () => {
  draggedFavoriteId = null;
  favoritesList.querySelectorAll('.dragging, .drag-over').forEach((row) => row.classList.remove('dragging', 'drag-over'));
});

favoritesSplitter.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  resizingFavoritesPanel = true;
  document.body.classList.add('split-resizing');
  favoritesSplitter.setPointerCapture(event.pointerId);
  event.preventDefault();
});
window.addEventListener('pointermove', (event) => {
  if (!resizingFavoritesPanel) return;
  setFavoritesPanelWidth(event.clientX - document.querySelector('main').getBoundingClientRect().left);
});
function finishFavoritesPanelResize(event) {
  if (!resizingFavoritesPanel) return;
  resizingFavoritesPanel = false;
  document.body.classList.remove('split-resizing');
  if (event?.pointerId !== undefined && favoritesSplitter.hasPointerCapture(event.pointerId)) {
    favoritesSplitter.releasePointerCapture(event.pointerId);
  }
}
window.addEventListener('pointerup', finishFavoritesPanelResize);
window.addEventListener('pointercancel', finishFavoritesPanelResize);
window.addEventListener('blur', finishFavoritesPanelResize);
favoritesSplitter.addEventListener('lostpointercapture', finishFavoritesPanelResize);
favoritesSplitter.addEventListener('dblclick', () => setFavoritesPanelWidth(340));
favoritesSplitter.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  setFavoritesPanelWidth(favoritesPanel.offsetWidth + (event.key === 'ArrowRight' ? 24 : -24));
  event.preventDefault();
});

panelSplitter.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  resizingYoutubePanel = true;
  document.body.classList.add('split-resizing');
  panelSplitter.setPointerCapture?.(event.pointerId);
  event.preventDefault();
});

window.addEventListener('pointermove', (event) => {
  if (!resizingYoutubePanel) return;
  const bounds = document.querySelector('main').getBoundingClientRect();
  setYouTubePanelWidth(bounds.right - event.clientX);
});

function finishYoutubePanelResize(event) {
  if (!resizingYoutubePanel) return;
  resizingYoutubePanel = false;
  document.body.classList.remove('split-resizing');
  if (event?.pointerId !== undefined && panelSplitter.hasPointerCapture?.(event.pointerId)) {
    panelSplitter.releasePointerCapture(event.pointerId);
  }
}

window.addEventListener('pointerup', finishYoutubePanelResize);
window.addEventListener('pointercancel', finishYoutubePanelResize);
panelSplitter.addEventListener('dblclick', () => setYouTubePanelWidth(DEFAULT_YOUTUBE_PANEL_WIDTH));
panelSplitter.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  setYouTubePanelWidth(youtubePanelWidth + (event.key === 'ArrowLeft' ? 24 : -24));
  event.preventDefault();
});

window.addEventListener('resize', () => {
  if (favoritesPanelOpen) setFavoritesPanelWidth(favoritesPanelWidth, false);
  if (youtubePanelOpen) setYouTubePanelWidth(youtubePanelWidth, false);
});

compactBtn.addEventListener('click', async () => {
  await closeYouTubeHome();
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
  cleanBtn.setAttribute('aria-pressed', String(cleanMode));
  cleanBtn.textContent = cleanMode ? '✓ Chế độ gọn' : 'Chế độ gọn';
  setStatus(cleanMode ? 'Đã bật tự động Skip' : 'Đã tắt tự động Skip');
  applyCleanMode();
});

function updateAdblockUi(state) {
  adblockState = state;
  adblockBtn.classList.toggle('active', state.active);
  adblockBtn.setAttribute('aria-pressed', String(state.enabled));
  adblockBtn.textContent = state.enabled
    ? (state.active ? '✓ Chặn quảng cáo' : 'Chặn quảng cáo: Lỗi')
    : 'Chặn quảng cáo: Tắt';
  adblockBtn.title = state.error || 'Nếu video gặp lỗi, tắt chặn rồi nhấn Tải lại. Bộ lọc mới áp dụng đầy đủ sau khi tải lại.';
}

adblockBtn.addEventListener('click', async () => {
  adblockBtn.disabled = true;
  try {
    updateAdblockUi(await window.desktop.setAdblockEnabled(!adblockState.enabled));
    setStatus(adblockState.error || (adblockState.enabled
      ? 'Đã bật chặn quảng cáo. Tải lại nếu cần áp dụng đầy đủ.'
      : 'Đã tắt bộ chặn. Nhấn Tải lại nếu video vẫn gặp lỗi; tự Skip theo Chế độ gọn.'), Boolean(adblockState.error));
  } catch { setStatus('Không lưu được lựa chọn chặn quảng cáo.', true); }
  finally { adblockBtn.disabled = false; }
});

reloadPlayerBtn.addEventListener('click', async () => {
  if (!player.src) return;
  reloadPlayerBtn.disabled = true;
  try {
    // Query immediately before reload, excluding ad media and live streams.
    const media = await player.executeJavaScript(`(() => {
      const root = document.querySelector('#movie_player, .html5-video-player');
      const video = root?.querySelector('video');
      if (!video || root.classList.contains('ad-showing') || !Number.isFinite(video.duration) || root.getVideoData?.().isLive) return null;
      return { time: video.currentTime, muted: video.muted, volume: video.volume,
        rate: video.playbackRate, paused: video.paused };
    })()`).catch(() => null);
    pendingRestore = media || lastContentMedia;
    player.reload();
    setStatus('Đang tải lại trình phát…');
  } finally { reloadPlayerBtn.disabled = false; }
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

function runPlayerShortcut(action) {
  if (!player.src || !action) return;
  player.executeJavaScript(createPlayerScript(action)).catch(() => {});
}

window.desktop.onPlayerShortcut((shortcut) => {
  if (shortcut?.sourceId !== player.getWebContentsId()) return;
  runPlayerShortcut(shortcut.action);
});

function showSnapFeedback(action) {
  if (!snapFeedback || !snapFeedbackText) return;
  snapFeedbackText.textContent = action === 'play' ? 'Tiếp tục phát' : 'Tạm dừng';
  snapFeedback.hidden = false;
  void snapFeedback.offsetWidth;
  snapFeedback.classList.add('visible');
  clearTimeout(snapFeedbackTimer);
  snapFeedbackTimer = setTimeout(() => {
    snapFeedback.classList.remove('visible');
    snapFeedbackTimer = setTimeout(() => {
      snapFeedback.hidden = true;
    }, 250);
  }, 1200);
}

function flashSnapIndicator() {
  if (!snapIndicator) return;
  snapIndicator.classList.add('flash');
  clearTimeout(snapIndicatorTimer);
  snapIndicatorTimer = setTimeout(() => {
    snapIndicator.classList.remove('flash');
  }, 600);
}

async function handleSnapDetected() {
  flashSnapIndicator();
  if (!player.src) return;
  try {
    const action = await player.executeJavaScript(`(() => {
      const root = document.querySelector('#movie_player, .html5-video-player');
      const video = root?.querySelector('video') || document.querySelector('video');
      if (!video) return null;
      if (video.paused) {
        const p = typeof root?.playVideo === 'function' ? root.playVideo() : video.play();
        p?.catch?.(() => {});
        return 'play';
      } else {
        if (typeof root?.pauseVideo === 'function') root.pauseVideo();
        else video.pause();
        return 'pause';
      }
    })()`);

    if (action) {
      showSnapFeedback(action);
      setStatus(action === 'play' ? '🤌 Búng tay: Tiếp tục phát' : '🤌 Búng tay: Tạm dừng');
    }
  } catch (err) {
    console.error('Lỗi khi điều khiển phát video bằng búng tay:', err);
  }
}

function handleSnapVolume(data) {
  if (!settingsModal || settingsModal.hidden) return;
  if (micMeterBar) {
    micMeterBar.style.width = `${Math.min(100, Math.max(0, data.level))}%`;
  }
}

function updateSnapStateUi(state, detail) {
  if (!micStatusBadge) return;
  if (state === 'listening') {
    micStatusBadge.textContent = '🟢 Đang lắng nghe';
    micStatusBadge.className = 'status-badge listening';
    micStatusBadge.removeAttribute('title');
    snapBtn?.classList.add('active');
    snapBtn?.setAttribute('aria-pressed', 'true');
    compactSnapBtn?.classList.add('active');
    compactSnapBtn?.setAttribute('aria-pressed', 'true');
    if (snapToggle) snapToggle.checked = true;
  } else if (state === 'error') {
    micStatusBadge.textContent = '🔴 Lỗi micro';
    micStatusBadge.className = 'status-badge error';
    micStatusBadge.title = detail?.message || 'Không thể truy cập microphone';
    snapBtn?.classList.remove('active');
    snapBtn?.setAttribute('aria-pressed', 'false');
    compactSnapBtn?.classList.remove('active');
    compactSnapBtn?.setAttribute('aria-pressed', 'false');
    if (snapToggle) snapToggle.checked = false;
    if (detail?.message) setStatus(detail.message, true);
  } else {
    micStatusBadge.textContent = '⚪ Đã tắt';
    micStatusBadge.className = 'status-badge idle';
    micStatusBadge.removeAttribute('title');
    snapBtn?.classList.remove('active');
    snapBtn?.setAttribute('aria-pressed', 'false');
    compactSnapBtn?.classList.remove('active');
    compactSnapBtn?.setAttribute('aria-pressed', 'false');
    if (snapToggle) snapToggle.checked = false;
    if (micMeterBar) micMeterBar.style.width = '0%';
  }
}

async function toggleSnapControl(enable) {
  const target = typeof enable === 'boolean' ? enable : !snapEnabled;
  snapEnabled = target;
  localStorage.setItem('snapControlEnabled', String(snapEnabled));
  if (snapEnabled) {
    try {
      if (!snapDetector && window.SnapDetector) {
        initSnapDetector();
      }
      if (snapDetector) {
        await snapDetector.start();
        setStatus('Đã bật điều khiển bằng búng tay');
      }
    } catch (err) {
      snapEnabled = false;
      localStorage.setItem('snapControlEnabled', 'false');
      updateSnapStateUi('error', err);
    }
  } else {
    if (snapDetector) snapDetector.stop();
    setStatus('Đã tắt điều khiển bằng búng tay');
  }
}

function openSettingsModal() {
  if (!settingsModal) return;
  settingsModal.hidden = false;
  settingsModal.setAttribute('aria-hidden', 'false');
  settingsBtn.setAttribute('aria-expanded', 'true');
  closeSettingsBtn.focus();
}

function closeSettingsModal() {
  if (!settingsModal) return;
  settingsModal.hidden = true;
  settingsModal.setAttribute('aria-hidden', 'true');
  settingsBtn.setAttribute('aria-expanded', 'false');
  settingsBtn.focus();
}

function initSnapDetector() {
  if (typeof window.SnapDetector !== 'function') return;
  snapDetector = new window.SnapDetector({
    sensitivity: snapSensitivity,
    cooldownMs: snapCooldown,
    onSnap: handleSnapDetected,
    onVolume: handleSnapVolume,
    onError: (err) => updateSnapStateUi('error', err),
    onStateChange: (state, detail) => updateSnapStateUi(state, detail)
  });
}

snapBtn?.addEventListener('click', () => toggleSnapControl());
compactSnapBtn?.addEventListener('click', () => toggleSnapControl());
settingsBtn?.addEventListener('click', openSettingsModal);
closeSettingsBtn?.addEventListener('click', closeSettingsModal);
doneSettingsBtn?.addEventListener('click', closeSettingsModal);
settingsModal?.addEventListener('click', (event) => {
  if (event.target === settingsModal) closeSettingsModal();
});
snapToggle?.addEventListener('change', () => toggleSnapControl(snapToggle.checked));
snapSensitivityRange?.addEventListener('input', () => {
  snapSensitivity = Number(snapSensitivityRange.value) || 60;
  if (sensitivityValueLabel) sensitivityValueLabel.textContent = `${snapSensitivity}%`;
  localStorage.setItem('snapSensitivity', String(snapSensitivity));
  if (snapDetector) snapDetector.setSensitivity(snapSensitivity);
});
snapCooldownSelect?.addEventListener('change', () => {
  snapCooldown = Number(snapCooldownSelect.value) || 800;
  localStorage.setItem('snapCooldown', String(snapCooldown));
  if (snapDetector) snapDetector.setCooldown(snapCooldown);
});

window.addEventListener('keydown', (event) => {
  const shortcutAction = isEditableTarget(event.target) ? null : getPlayerShortcutAction(event);
  if (shortcutAction) {
    event.preventDefault();
    runPlayerShortcut(shortcutAction);
    return;
  }
  if (event.key === 'Escape') {
    if (settingsModal && !settingsModal.hidden) {
      closeSettingsModal();
      return;
    }
    if (compact) showControlsBtn.click();
    else if (youtubePanelOpen) closeYouTubeHome();
    else if (favoritesPanelOpen) closeFavoritesPanel();
  }
  if (event.key.toLowerCase() === 'p' && event.ctrlKey) pinBtn.click();
});

(async () => {
  renderFavorites();
  enrichFavoriteChannels();
  updateFavoriteButton();
  updateLoopUi();
  if (snapSensitivityRange) snapSensitivityRange.value = String(snapSensitivity);
  if (sensitivityValueLabel) sensitivityValueLabel.textContent = `${snapSensitivity}%`;
  if (snapCooldownSelect) snapCooldownSelect.value = String(snapCooldown);
  initSnapDetector();
  if (snapEnabled && snapDetector) {
    snapDetector.start().catch((err) => {
      snapEnabled = false;
      localStorage.setItem('snapControlEnabled', 'false');
      updateSnapStateUi('error', err);
    });
  } else {
    updateSnapStateUi('idle');
  }

  try {
    updateAdblockUi(await window.desktop.getAdblockState());
    if (adblockState.error) setStatus(adblockState.error, true);
    adblockBtn.disabled = false;
  } catch { adblockBtn.textContent = 'Bộ chặn không khả dụng'; }
  const state = await window.desktop.getWindowState();
  updatePinUi(state.alwaysOnTop);
  opacityRange.value = String(Math.round(state.opacity * 100));
  const lastUrl = localStorage.getItem('lastVideoUrl');
  if (lastUrl) urlInput.value = lastUrl;
  urlInput.focus();
})();
