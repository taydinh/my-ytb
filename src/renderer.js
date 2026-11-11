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
const viewModeBtn = document.querySelector('#viewModeBtn');
const viewModeMenu = document.querySelector('#viewModeMenu');
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
let playerViewMode = ['youtube', 'ambient'].includes(localStorage.getItem('playerViewMode'))
  ? localStorage.getItem('playerViewMode') : 'video';
let youtubeView = playerViewMode === 'youtube';
let loopEnabled = localStorage.getItem('loopEnabled') === 'true';
let snapEnabled = localStorage.getItem('snapControlEnabled') === 'true';
let snapSensitivity = Number(localStorage.getItem('snapSensitivity')) || 60;
let snapCooldown = Number(localStorage.getItem('snapCooldown')) || 800;
let snapDetector = null;
let snapFeedbackTimer = null;
let snapIndicatorTimer = null;
let cleanupTimer;
let cleanupBusy = false;
let cleanupQueued = false;
let currentVideoId = null;
let currentVideoDuration = 0;
let currentVideoChannel = { channelName: '', channelUrl: '' };
let favoritesPanelOpen = false;
let favoriteVideos = window.FavoritesStore.load(localStorage);
let favoriteLists = window.FavoritesStore.loadLists(localStorage);
let selectedFavoriteList = 'all';
let listDialogVideoId = null;
let editingFavoriteListId = null;
let deletingFavoriteListId = null;
const renameFavoriteListBtn = document.querySelector('#renameFavoriteListBtn');
const deleteFavoriteListBtn = document.querySelector('#deleteFavoriteListBtn');
const deleteFavoriteListDialog = document.querySelector('#deleteFavoriteListDialog');
const favoriteListFilter = document.querySelector('#favoriteListFilter');
const favoriteListDialog = document.querySelector('#favoriteListDialog');
const favoriteListDestination = document.querySelector('#favoriteListDestination');
const favoriteListName = document.querySelector('#favoriteListName');

function visibleFavoriteVideos() {
  return favoriteVideos.filter((item) => selectedFavoriteList === 'all' ||
    (selectedFavoriteList === 'unassigned' ? !favoriteLists.some((list) => list.id === item.listId) : item.listId === selectedFavoriteList));
}

const playFavoriteListBtn = document.querySelector('#playFavoriteListBtn');
const favoritePlaybackMode = { value: 'off' };
const favoritePlaybackModeBtn = document.querySelector('#favoritePlaybackModeBtn');
const favoritePlaybackModeMenu = document.querySelector('#favoritePlaybackModeMenu');
favoritePlaybackMode.value = ['off', 'all', 'shuffle'].includes(localStorage.getItem('favoritePlaybackMode'))
  ? localStorage.getItem('favoritePlaybackMode') : 'off';
let playlistQueue = null;
let playlistGeneration = 0;

function updateFavoritePlaybackMode() {
  const labels = { off: 'Không lặp', all: 'Lặp tất cả', shuffle: 'Phát ngẫu nhiên' };
  favoritePlaybackModeBtn.textContent = `${favoritePlaybackMode.value === 'shuffle' ? '⤨' : '↻'} ${labels[favoritePlaybackMode.value]} ▾`;
  for (const option of favoritePlaybackModeMenu.querySelectorAll('[data-playback-mode]')) {
    option.setAttribute('aria-pressed', String(option.dataset.playbackMode === favoritePlaybackMode.value));
  }
}
updateFavoritePlaybackMode();
favoritePlaybackModeBtn.addEventListener('click', () => {
  if (favoritePlaybackModeMenu.matches(':popover-open')) {
    favoritePlaybackModeMenu.hidePopover();
    return;
  }
  favoritePlaybackModeMenu.showPopover();
  const rect = favoritePlaybackModeBtn.getBoundingClientRect();
  favoritePlaybackModeMenu.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - favoritePlaybackModeMenu.offsetWidth - 8))}px`;
  favoritePlaybackModeMenu.style.top = `${Math.max(8, Math.min(rect.bottom + 6, innerHeight - favoritePlaybackModeMenu.offsetHeight - 8))}px`;
  favoritePlaybackModeMenu.querySelector('[aria-pressed="true"]').focus();
});
favoritePlaybackModeMenu.addEventListener('toggle', (event) => {
  favoritePlaybackModeBtn.setAttribute('aria-expanded', String(event.newState === 'open'));
});
favoritePlaybackModeMenu.addEventListener('click', (event) => {
  const option = event.target.closest('[data-playback-mode]');
  if (!option) return;
  favoritePlaybackMode.value = option.dataset.playbackMode;
  localStorage.setItem('favoritePlaybackMode', favoritePlaybackMode.value);
  updateFavoritePlaybackMode();
  favoritePlaybackModeMenu.hidePopover();
  favoritePlaybackModeBtn.focus();
});
window.addEventListener('resize', () => favoritePlaybackModeMenu.hidePopover());
new ResizeObserver(() => favoritePlaybackModeMenu.hidePopover()).observe(favoritesPanel);
playFavoriteListBtn.addEventListener('click', () => {
  playlistQueue = visibleFavoriteVideos().map((item) => item.id);
  if (!playlistQueue.length) { playlistQueue = null; return; }
  const index = favoritePlaybackMode.value === 'shuffle' ? Math.floor(Math.random() * playlistQueue.length) : 0;
  loadVideo(playlistQueue[index], true);
});

function advanceFavoritePlaylist(endedId) {
  if (!playlistQueue || loopEnabled || endedId !== currentVideoId) return false;
  const previousIndex = playlistQueue.indexOf(endedId);
  const remaining = playlistQueue.filter((id) => favoriteVideos.some((item) => item.id === id));
  let nextId;
  if (favoritePlaybackMode.value === 'shuffle') {
    const choices = remaining.filter((id) => id !== endedId);
    nextId = choices.length ? choices[Math.floor(Math.random() * choices.length)] : remaining[0];
  } else {
    nextId = playlistQueue.slice(previousIndex + 1).find((id) => remaining.includes(id));
    if (!nextId && favoritePlaybackMode.value === 'all') nextId = remaining[0];
  }
  if (nextId) loadVideo(nextId, true);
  else { playlistQueue = null; setStatus('Đã phát hết danh sách'); }
  return true;
}

function openFavoriteListDialog(videoId = null) {
  editingFavoriteListId = null;
  document.querySelector('#favoriteListNameLabel').textContent = 'Tên danh sách mới';
  listDialogVideoId = videoId;
  document.querySelector('#favoriteListDialogTitle').textContent = videoId ? 'Chuyển vào danh sách' : 'Tạo danh sách';
  favoriteListDestination.hidden = !videoId;
  document.querySelector('#favoriteListDestinationLabel').hidden = !videoId;
  favoriteListDestination.replaceChildren(new Option('Chưa có danh sách', ''), ...favoriteLists.map((list) => new Option(list.name, list.id)), new Option('+ Tạo danh sách mới', 'new'));
  const item = favoriteVideos.find((video) => video.id === videoId);
  favoriteListDestination.value = favoriteLists.some((list) => list.id === item?.listId) ? item.listId : '';
  favoriteListName.value = '';
  favoriteListName.required = !videoId;
  favoriteListName.disabled = Boolean(videoId);
  document.querySelector('#favoriteListError').textContent = '';
  favoriteListDialog.showModal();
  (videoId ? favoriteListDestination : favoriteListName).focus();
}

renameFavoriteListBtn.addEventListener('click', () => {
  const list = favoriteLists.find((item) => item.id === selectedFavoriteList);
  if (!list) return;
  openFavoriteListDialog();
  editingFavoriteListId = list.id;
  document.querySelector('#favoriteListDialogTitle').textContent = 'Sửa tên danh sách';
  document.querySelector('#favoriteListNameLabel').textContent = 'Tên danh sách';
  favoriteListName.value = list.name;
  favoriteListName.select();
});
deleteFavoriteListBtn.addEventListener('click', () => {
  const list = favoriteLists.find((item) => item.id === selectedFavoriteList);
  if (!list) return;
  deletingFavoriteListId = list.id;
  const count = favoriteVideos.filter((video) => video.listId === list.id).length;
  document.querySelector('#deleteFavoriteListDescription').textContent = `Danh sách “${list.name}” có ${count} video. Chọn cách xóa:`;
  document.querySelector('#deleteFavoriteListForm').reset();
  deleteFavoriteListDialog.showModal();
  document.querySelector('#cancelDeleteFavoriteListBtn').focus();
});
document.querySelector('#cancelDeleteFavoriteListBtn').addEventListener('click', () => deleteFavoriteListDialog.close());
document.querySelector('#deleteFavoriteListForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const removeVideos = new FormData(event.currentTarget).get('deleteListMode') === 'with-videos';
  const result = window.FavoritesStore.removeList(favoriteLists, favoriteVideos, deletingFavoriteListId, removeVideos);
  favoriteLists = window.FavoritesStore.saveLists(localStorage, result.lists);
  favoriteVideos = result.videos;
  selectedFavoriteList = 'all';
  persistFavorites();
  deleteFavoriteListDialog.close();
  setStatus(removeVideos ? 'Đã xóa danh sách và các video trong danh sách khỏi yêu thích' : 'Đã xóa danh sách, giữ lại video trong yêu thích');
});

favoriteListDestination.addEventListener('change', () => {
  favoriteListName.disabled = favoriteListDestination.value !== 'new';
  favoriteListName.required = !favoriteListName.disabled;
  if (!favoriteListName.disabled) favoriteListName.focus();
});
document.querySelector('#createFavoriteListBtn').addEventListener('click', () => openFavoriteListDialog());
document.querySelector('#cancelFavoriteListBtn').addEventListener('click', () => favoriteListDialog.close());
favoriteListFilter.addEventListener('change', () => {
  selectedFavoriteList = favoriteListFilter.value;
  renderFavorites();
});
document.querySelector('#favoriteListForm').addEventListener('submit', (event) => {
  event.preventDefault();
  let listId = favoriteListDestination.value;
  if (!listDialogVideoId || listId === 'new') {
    const name = favoriteListName.value.replace(/\s+/g, ' ').trim();
    if (!name) {
      document.querySelector('#favoriteListError').textContent = 'Vui lòng nhập tên danh sách.';
      return;
    }
    const existing = favoriteLists.find((list) => list.id !== editingFavoriteListId && list.name.toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'));
    if (existing) {
      document.querySelector('#favoriteListError').textContent = 'Tên danh sách đã tồn tại. Vui lòng chọn tên khác.';
      return;
    }
    if (editingFavoriteListId) {
      favoriteLists = window.FavoritesStore.saveLists(localStorage, favoriteLists.map((list) => list.id === editingFavoriteListId ? { ...list, name } : list));
      renderFavorites();
      favoriteListDialog.close();
      setStatus('Đã sửa tên danh sách');
      return;
    }
    listId = crypto.randomUUID();
    favoriteLists = window.FavoritesStore.saveLists(localStorage, [...favoriteLists, { id: listId, name }]);
  }
  const item = favoriteVideos.find((video) => video.id === listDialogVideoId);
  if (item) item.listId = listId;
  else selectedFavoriteList = listId;
  persistFavorites();
  favoriteListDialog.close();
  setStatus(item ? 'Đã chuyển video vào danh sách' : 'Đã tạo danh sách');
});

let historyVideos = window.HistoryStore.load(localStorage);
let historyMode = false;
let historyRecorded = false;
const historyMenuBtn = document.querySelector('#historyMenuBtn');
const favoriteMetadataRequests = new Set();
let draggedFavoriteId = null;
let compatibilityMode = false;
let youtubePanelOpen = false;
// Last status written by the player itself; ticks may overwrite only this, never user-action messages.
let playerStatus = '';
// Videos whose embed was refused this session: open them on /watch directly next time.
const embedBlockedIds = new Set();
let adblockState = { enabled: true, active: false };
let ambientSettings = window.AmbientSettings.load(localStorage);
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

function setPlayerStatus(message, isError = false) {
  playerStatus = message;
  setStatus(message, isError);
}

function updatePlayerStatus(message) {
  if (status.textContent === playerStatus && message !== playerStatus) setPlayerStatus(message);
}

function playerSource(id) {
  return youtubeView || embedBlockedIds.has(id) ? watchUrl(id) : playerUrl(id);
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
  updateHistoryMetadata(metadata);
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

function updateHistoryMetadata(metadata) {
  const index = historyVideos.findIndex((item) => item.id === currentVideoId);
  if (index < 0) return;
  const previous = historyVideos[index];
  const next = window.FavoritesStore.sanitize({ ...previous,
    title: metadata.title || previous.title,
    duration: metadata.duration || previous.duration,
    channelName: metadata.channelName || previous.channelName,
    channelUrl: metadata.channelUrl || previous.channelUrl
  });
  if (JSON.stringify(next) === JSON.stringify(previous)) return;
  historyVideos[index] = next;
  historyVideos = window.HistoryStore.save(localStorage, historyVideos);
  if (historyMode) renderFavorites();
}

function recordHistory() {
  if (historyRecorded || !currentVideoId) return;
  historyRecorded = true;
  const previous = historyVideos.find((item) => item.id === currentVideoId)
    || favoriteVideos.find((item) => item.id === currentVideoId) || {};
  historyVideos = window.HistoryStore.record(localStorage, historyVideos, {
    ...previous, id: currentVideoId,
    title: videoTitle.textContent || previous.title,
    duration: currentVideoDuration || previous.duration,
    channelName: currentVideoChannel.channelName || previous.channelName,
    channelUrl: currentVideoChannel.channelUrl || previous.channelUrl
  });
  renderFavorites();
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
  const items = historyMode ? historyVideos : visibleFavoriteVideos();
  document.querySelector('#favoriteListToolbar').hidden = historyMode;
  favoritesEmpty.classList.toggle('filtered-empty', !historyMode);
  favoriteListFilter.replaceChildren(new Option('Tất cả', 'all'), new Option('Chưa có danh sách', 'unassigned'), ...favoriteLists.map((list) => new Option(list.name, list.id)));
  favoriteListFilter.value = selectedFavoriteList;
  const hasSelectedList = favoriteLists.some((list) => list.id === selectedFavoriteList);
  playFavoriteListBtn.disabled = visibleFavoriteVideos().length === 0;
  renameFavoriteListBtn.disabled = !hasSelectedList;
  deleteFavoriteListBtn.disabled = !hasSelectedList;
  favoritesEmpty.hidden = items.length > 0;
  favoritesPanel.querySelector('strong').textContent = historyMode ? 'History' : 'Video yêu thích';
  favoritesEmpty.querySelector('strong').textContent = historyMode ? 'Chưa có lịch sử xem' : (selectedFavoriteList === 'all' ? 'Chưa có video yêu thích' : 'Danh sách chưa có video');
  favoritesEmpty.querySelector('p').textContent = historyMode ? '100 video đã xem gần nhất sẽ xuất hiện tại đây.' : (selectedFavoriteList === 'all' ? 'Phát một video rồi nhấn ngôi sao trên thanh công cụ.' : 'Dùng nút thư mục ở mỗi video trong Tất cả để chuyển vào danh sách.');
  closeFavoritesBtn.title = closeFavoritesBtn.ariaLabel = historyMode ? 'Đóng History' : 'Đóng danh sách yêu thích';
  favoritesCount.textContent = String(favoriteVideos.length);
  favoritesSummary.textContent = historyMode ? `${items.length}/100 video · Mới nhất trước` : `${items.length} video`;

  items.forEach((item, index) => {
    const row = document.createElement('article');
    row.className = 'favorite-item';
    row.draggable = !historyMode;
    row.classList.toggle('history-item', historyMode);
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
    const assignedList = favoriteLists.find((list) => list.id === item.listId);
    const listAction = createFavoriteAction('▱', assignedList ? `Trong danh sách: ${assignedList.name} · Chuyển danh sách` : 'Chuyển vào danh sách', 'list');
    listAction.classList.toggle('in-list', Boolean(assignedList));
    if (!historyMode) actions.append(
      createFavoriteAction('↑', 'Đưa lên trên', 'up', index === 0),
      createFavoriteAction('↓', 'Đưa xuống dưới', 'down', index === items.length - 1),
      createFavoriteAction('✎', 'Sửa tiêu đề', 'edit'),
      listAction,
      createFavoriteAction('×', 'Xóa khỏi yêu thích', 'delete')
    );
    details.append(titleButton, channelButton, actions);
    if (!historyMode) row.append(handle);
    row.append(thumbnailButton, details);
    favoritesList.append(row);
  });
}

async function openFavoritesPanel(showHistory = false) {
  historyMode = showHistory;
  renderFavorites();
  if (compact) {
    compact = false;
    document.body.classList.remove('compact');
    await window.desktop.setCompact(false);
  }
  favoritesPanelOpen = true;
  document.body.classList.add('favorites-panel-open');
  setFavoritesPanelWidth(favoritesPanelWidth, false);
  favoritesPanel.setAttribute('aria-hidden', 'false');
  favoritesMenuBtn.classList.toggle('active', !historyMode);
  favoritesMenuBtn.setAttribute('aria-expanded', String(!historyMode));
  historyMenuBtn.classList.toggle('active', historyMode);
  historyMenuBtn.setAttribute('aria-expanded', String(historyMode));
  enrichFavoriteChannels();
}

function closeFavoritesPanel() {
  favoritesPanelOpen = false;
  document.body.classList.remove('favorites-panel-open');
  favoritesPanel.setAttribute('aria-hidden', 'true');
  historyMenuBtn.classList.remove('active');
  historyMenuBtn.setAttribute('aria-expanded', 'false');
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

function syncPlayingVideo(value) {
  const id = extractVideoId(value);
  if (!id || id === currentVideoId) return;
  currentVideoId = id;
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  urlInput.value = url;
  localStorage.setItem('lastVideoUrl', url);
  historyRecorded = false;
  currentVideoDuration = 0;
  currentVideoChannel = { channelName: '', channelUrl: '' };
  lastContentMedia = null;
  pendingRestore = null;
  setVideoTitle('');
  updateFavoriteButton();
  renderFavorites();
}

function stopPlayerHelpers() {
  clearInterval(cleanupTimer);
  cleanupTimer = null;
  cleanupBusy = false;
  playerStatus = '';
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

function loadVideo(value, fromPlaylist = false) {
  const id = extractVideoId(value);
  if (!id) {
    setStatus('URL YouTube không hợp lệ', true);
    urlInput.focus();
    urlInput.select();
    return;
  }

  if (!fromPlaylist) playlistQueue = null;
  playlistGeneration++;
  const normalizedUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  urlInput.value = normalizedUrl;
  localStorage.setItem('lastVideoUrl', normalizedUrl);
  showPlayerLayout();
  currentVideoId = id;
  historyRecorded = false;
  currentVideoDuration = 0;
  currentVideoChannel = { channelName: '', channelUrl: '' };
  lastContentMedia = null;
  pendingRestore = null;
  compatibilityMode = !youtubeView && embedBlockedIds.has(id);
  setVideoTitle('');
  updateFavoriteButton();
  renderFavorites();
  const nextSource = playerSource(id);
  if (player.src === nextSource) player.reload();
  else player.src = nextSource;
  player.classList.add('visible');
  emptyState.classList.add('hidden');
  setPlayerStatus('Đang tải video…');
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
  if (!player.src) return;
  // Settings sliders call this rapidly; run once more after the current pass.
  if (cleanupBusy) { cleanupQueued = true; return; }
  cleanupBusy = true;
  const script = `(() => {
    globalThis.__ytfpCleanEnabled = ${cleanMode};
    globalThis.__ytfpLoopEnabled = ${loopEnabled};
    globalThis.__ytfpPlaylistGeneration = ${playlistGeneration};
    globalThis.__ytfpYouTubeView = ${youtubeView};
    globalThis.__ytfpAmbientEnabled = ${playerViewMode === 'ambient'};
    globalThis.__ytfpAmbientSettings = ${JSON.stringify(ambientSettings)};
    if (!globalThis.__ytfpHelperState?.restored) globalThis.__ytfpRestore = ${JSON.stringify(pendingRestore)};

    // Layouts live in one adopted stylesheet (CSP-safe, unlike a <style> tag)
    // switched by classes on <html>, so changing view mode never reloads.
    // Fit: make /watch (embed fallback) and Ambient look like a bare embed so
    // recommendations/comments cannot cover the video when maximized.
    // Ambient settings arrive as CSS variables on <html>, so sliders apply live.
    const LAYOUT_CSS = [
      'html.__ytfp-fit,html.__ytfp-fit body{width:100%!important;height:100%!important;margin:0!important;overflow:hidden!important;background:#000!important}',
      'html.__ytfp-fit #movie_player{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;transform:none!important;z-index:2147483647!important;background:#000!important}',
      'html.__ytfp-fit #movie_player .html5-video-container{position:absolute!important;inset:0!important;width:100%!important;height:100%!important}',
      'html.__ytfp-ambient #movie_player .html5-video-container{inset:var(--ytfp-inset,7%)!important;width:var(--ytfp-size,86%)!important;height:var(--ytfp-size,86%)!important;z-index:1!important;filter:var(--ytfp-shadow,none)!important}',
      'html.__ytfp-fit #movie_player video{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:contain!important;transform:none!important}',
      'html.__ytfp-ambient #movie_player video{filter:var(--ytfp-video-filter,none)!important;clip-path:var(--ytfp-video-clip,none)!important}',
      'html.__ytfp-fit :is(ytd-masthead,#secondary,#below,#comments,#chat-container,#panels,#related,#playlist,#cinematics,ytd-miniplayer,tp-yt-app-drawer,ytd-popup-container){display:none!important}',
      '#__ytfp_ambient_wrap{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;opacity:var(--ytfp-intensity,.85);clip-path:var(--ytfp-dir-clip,none)}',
      '#__ytfp_ambient{position:absolute;inset:calc(-1 * var(--ytfp-spread,20%));width:calc(100% + 2 * var(--ytfp-spread,20%));height:calc(100% + 2 * var(--ytfp-spread,20%));filter:blur(var(--ytfp-blur,45px)) saturate(var(--ytfp-sat,1.5)) brightness(var(--ytfp-bright,1));opacity:0;transition:opacity var(--ytfp-fade,.6s) ease;will-change:transform;animation:__ytfpAmbientDrift var(--ytfp-motion-dur,9s) ease-in-out infinite alternate}',
      '#__ytfp_noise{position:absolute;inset:0;width:100%;height:100%;opacity:var(--ytfp-noise,0);mix-blend-mode:overlay}',
      'html.__ytfp-still #__ytfp_ambient{animation:none}',
      // Extend: the canvas maps 1:1 onto the page (plus a blur margin) so the glow continues the video edges.
      'html.__ytfp-extend #__ytfp_ambient_wrap{opacity:1}',
      'html.__ytfp-extend #__ytfp_noise{display:none}',
      'html.__ytfp-extend #__ytfp_ambient{inset:calc(-1 * var(--ytfp-blur,45px));width:calc(100% + 2 * var(--ytfp-blur,45px));height:calc(100% + 2 * var(--ytfp-blur,45px));filter:blur(var(--ytfp-blur,45px)) var(--ytfp-canvas-filter,saturate(1));animation:none}',
      'html.__ytfp-ambient.__ytfp-extend #movie_player .html5-video-container{filter:none!important}',
      // Slow drift of the blurred field keeps colours gently moving on still images.
      '@keyframes __ytfpAmbientDrift{0%{transform:translate(calc(-5% * var(--ytfp-amt,1)),calc(-3% * var(--ytfp-amt,1))) scale(calc(1 + .04 * var(--ytfp-amt,1))) rotate(calc(-4deg * var(--ytfp-amt,1)))}50%{transform:translate(calc(4% * var(--ytfp-amt,1)),calc(5% * var(--ytfp-amt,1))) scale(calc(1 + .18 * var(--ytfp-amt,1))) rotate(calc(2deg * var(--ytfp-amt,1)))}100%{transform:translate(calc(5% * var(--ytfp-amt,1)),calc(-4% * var(--ytfp-amt,1))) scale(calc(1 + .08 * var(--ytfp-amt,1))) rotate(calc(5deg * var(--ytfp-amt,1)))}}',
      '@media (prefers-reduced-motion:reduce){#__ytfp_ambient{animation:none!important}}'
    ].join('');
    const ambientSettings = () => globalThis.__ytfpAmbientSettings || {};

    // Letterbox bars inside the frame are clipped away so the glow shows there.
    const videoClip = (video, bars) => {
      if (!bars || !video?.videoWidth || !video.clientWidth) return 'none';
      const scale = Math.min(video.clientWidth / video.videoWidth, video.clientHeight / video.videoHeight);
      const width = video.videoWidth * scale;
      const height = video.videoHeight * scale;
      const x = (video.clientWidth - width) / 2;
      const y = (video.clientHeight - height) / 2;
      const px = (value) => Math.max(0, Math.round(value)) + 'px';
      return 'inset(' + [px(y + bars.top * height), px(x + bars.right * width), px(y + bars.bottom * height), px(x + bars.left * width)].join(' ') + ')';
    };

    const ambientVars = (s) => {
      const inset = (100 - s.videoSize) / 2;
      const amount = s.motion ? s.motionAmount / 100 : 0;
      const neutral = s.videoBrightness === 100 && s.videoContrast === 100 && s.videoSaturation === 100;
      return {
        '--ytfp-size': s.videoSize + '%',
        '--ytfp-inset': inset + '%',
        '--ytfp-shadow': s.shadowSize && s.shadowOpacity ? 'drop-shadow(0 0 ' + s.shadowSize + 'px rgba(0,0,0,' + s.shadowOpacity / 100 + '))' : 'none',
        '--ytfp-video-filter': neutral ? 'none' : 'brightness(' + s.videoBrightness / 100 + ') contrast(' + s.videoContrast / 100 + ') saturate(' + s.videoSaturation / 100 + ')',
        // Extend mode filters the glow like the video so colours meet without a seam.
        '--ytfp-canvas-filter': neutral ? 'saturate(1)' : 'brightness(' + s.videoBrightness / 100 + ') contrast(' + s.videoContrast / 100 + ') saturate(' + s.videoSaturation / 100 + ')',
        '--ytfp-intensity': String(s.intensity / 100),
        '--ytfp-dir-clip': 'inset(' + [s.top, s.right, s.bottom, s.left].map((on) => on ? '0' : inset + '%').join(' ') + ')',
        // Extra margin so the drift never reveals the canvas edge.
        '--ytfp-spread': (s.spread + 8 * amount) + '%',
        '--ytfp-blur': s.blur + 'px',
        '--ytfp-sat': String(s.saturation / 100),
        '--ytfp-bright': String(s.brightness / 100),
        '--ytfp-fade': s.fadeIn + 's',
        '--ytfp-motion-dur': s.motionDuration + 's',
        '--ytfp-amt': String(amount),
        '--ytfp-noise': String(s.noise / 100),
        '--ytfp-video-clip': videoClip(document.querySelector('#movie_player video'), s.removeBars ? globalThis.__ytfpAmbient?.bars : null)
      };
    };

    const applyLayout = () => {
      if (!globalThis.__ytfpLayoutSheet) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(LAYOUT_CSS);
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
        globalThis.__ytfpLayoutSheet = sheet;
      }
      const root = document.documentElement;
      const ambient = !globalThis.__ytfpYouTubeView && Boolean(globalThis.__ytfpAmbientEnabled);
      const fit = ambient || (!globalThis.__ytfpYouTubeView && location.pathname === '/watch');
      if (!ambient) root.classList.toggle('__ytfp-extend', false);
      if (ambient) {
        const settings = ambientSettings();
        root.classList.toggle('__ytfp-still', !settings.motion);
        root.classList.toggle('__ytfp-extend', Boolean(settings.extend));
        const vars = ambientVars(settings);
        const key = JSON.stringify(vars);
        if (key !== globalThis.__ytfpVarsKey) {
          globalThis.__ytfpVarsKey = key;
          for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
        }
      }
      if (root.classList.contains('__ytfp-fit') === fit && root.classList.contains('__ytfp-ambient') === ambient) return;
      root.classList.toggle('__ytfp-fit', fit);
      root.classList.toggle('__ytfp-ambient', ambient);
      // Let YouTube re-measure its controls for the new player size.
      if (globalThis.dispatchEvent) dispatchEvent(new Event('resize'));
    };

    // Samples a small copy of the frame about once a second; a result must repeat
    // before it is used, and an all-dark frame (fade/night scene) keeps the old one.
    const BAR_PROBE = 128;
    const BAR_MAX = 40;
    const detectBars = (ambient, video, settings, now) => {
      if (!settings.removeBars || ambient.barsBroken) { ambient.bars = null; return; }
      if (now - ambient.barsAt < 1000) return;
      ambient.barsAt = now;
      if (!ambient.probe) {
        ambient.probe = document.createElement('canvas');
        ambient.probe.width = BAR_PROBE;
        ambient.probe.height = BAR_PROBE;
      }
      try {
        const context = ambient.probe.getContext('2d', { willReadFrequently: true });
        context.drawImage(video, 0, 0, BAR_PROBE, BAR_PROBE);
        const data = context.getImageData(0, 0, BAR_PROBE, BAR_PROBE).data;
        const limit = settings.barThreshold / 100 * 255;
        // A line is dark when at most one pixel (noise, logo edge) is brighter than the limit.
        const darkLine = (x, y, dx, dy) => {
          let bright = 0;
          for (let i = 0; i < BAR_PROBE; i++) {
            const offset = ((y + dy * i) * BAR_PROBE + x + dx * i) * 4;
            if (0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2] > limit && ++bright > 1) return false;
          }
          return true;
        };
        const scan = (isDark) => { let count = 0; while (count < BAR_MAX && isDark(count)) count++; return count; };
        const top = scan((n) => darkLine(0, n, 1, 0));
        const bottom = scan((n) => darkLine(0, BAR_PROBE - 1 - n, 1, 0));
        const left = scan((n) => darkLine(n, 0, 0, 1));
        const right = scan((n) => darkLine(BAR_PROBE - 1 - n, 0, 0, 1));
        if ((top === BAR_MAX && bottom === BAR_MAX) || (left === BAR_MAX && right === BAR_MAX)) return;
        // Half a probe row of margin hides the partly-dark row at the bar edge.
        const edge = (count) => count ? (count + 0.5) / BAR_PROBE : 0;
        const candidate = [top, right, bottom, left].join();
        if (candidate === ambient.barsCandidate) {
          ambient.bars = top || right || bottom || left
            ? { top: edge(top), right: edge(right), bottom: edge(bottom), left: edge(left) } : null;
        }
        ambient.barsCandidate = candidate;
      } catch {
        // A cross-origin (tainted) frame cannot be read; keep the full frame.
        ambient.barsBroken = true;
        ambient.bars = null;
      }
    };

    const drawNoise = (ambient, settings) => {
      const { wrap, noise } = ambient;
      if (!settings.noise || !wrap.clientWidth) return;
      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      if (noise.width === width && noise.height === height) return;
      noise.width = width;
      noise.height = height;
      const context = noise.getContext('2d');
      const image = context.createImageData(width, height);
      for (let i = 0; i < image.data.length; i += 4) {
        const value = Math.random() * 255;
        image.data[i] = value;
        image.data[i + 1] = value;
        image.data[i + 2] = value;
        image.data[i + 3] = 255;
      }
      context.putImageData(image, 0, 0);
    };

    // Where the visible picture sits on the page, in px relative to the glow wrapper.
    const extendGeometry = (ambient, video, settings) => {
      if (!video.videoWidth || !video.getBoundingClientRect || !ambient.wrap.getBoundingClientRect) return null;
      const box = ambient.wrap.getBoundingClientRect();
      const rect = video.getBoundingClientRect();
      if (!box.width || !box.height || !rect.width || !rect.height) return null;
      const scale = Math.min(rect.width / video.videoWidth, rect.height / video.videoHeight);
      const width = video.videoWidth * scale;
      const height = video.videoHeight * scale;
      const bars = ambient.bars || { top: 0, right: 0, bottom: 0, left: 0 };
      const pad = settings.blur;
      return {
        boxW: box.width + 2 * pad,
        boxH: box.height + 2 * pad,
        x: rect.left - box.left + (rect.width - width) / 2 + bars.left * width + pad,
        y: rect.top - box.top + (rect.height - height) / 2 + bars.top * height + pad,
        w: width * (1 - bars.left - bars.right),
        h: height * (1 - bars.top - bars.bottom)
      };
    };

    // Draw the frame where the video is and stretch its edge strips outwards,
    // so after blurring the background reads as the picture continuing.
    const drawExtended = (context, video, source, geometry, width, height) => {
      const k = width / geometry.boxW;
      const x = geometry.x * k;
      const y = geometry.y * k;
      const right = x + geometry.w * k;
      const bottom = y + geometry.h * k;
      const tx = Math.max(1, source.w * 0.02);
      const ty = Math.max(1, source.h * 0.02);
      const sx2 = source.x + source.w - tx;
      const sy2 = source.y + source.h - ty;
      const piece = (sx, sy, sw, sh, dx, dy, dw, dh) => {
        if (dw > 0 && dh > 0) context.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);
      };
      piece(source.x, source.y, source.w, source.h, x, y, right - x, bottom - y);
      piece(source.x, source.y, source.w, ty, x, 0, right - x, y);
      piece(source.x, sy2, source.w, ty, x, bottom, right - x, height - bottom);
      piece(source.x, source.y, tx, source.h, 0, y, x, bottom - y);
      piece(sx2, source.y, tx, source.h, right, y, width - right, bottom - y);
      piece(source.x, source.y, tx, ty, 0, 0, x, y);
      piece(sx2, source.y, tx, ty, right, 0, width - right, y);
      piece(source.x, sy2, tx, ty, 0, bottom, x, height - bottom);
      piece(sx2, sy2, tx, ty, right, bottom, width - right, height - bottom);
    };

    // Ambient Light: the page tick only decides visibility; a rAF loop blends
    // frames in small steps so colour changes glide instead of jumping every tick.
    const paintAmbient = (timestamp) => {
      const ambient = globalThis.__ytfpAmbient;
      if (!ambient) return;
      const { canvas, video } = ambient;
      const settings = ambientSettings();
      ambient.frame = 0;
      if (!canvas.isConnected || ambient.hidden || !video || video.readyState < 2) return;
      // Stop after ~1.5 s of a paused, unchanged frame; the CSS drift keeps it alive.
      ambient.still = video.paused && ambient.time === video.currentTime ? ambient.still + 1 : 0;
      ambient.time = video.currentTime;
      if (ambient.still > 90) return;
      const now = Number(timestamp) || Date.now();
      const elapsed = ambient.lastDraw ? now - ambient.lastDraw : Infinity;
      if (settings.fps && elapsed < 1000 / settings.fps - 4) {
        ambient.frame = requestAnimationFrame(paintAmbient);
        return;
      }
      detectBars(ambient, video, settings, now);
      const geometry = settings.extend ? extendGeometry(ambient, video, settings) : null;
      const width = settings.resolution || 64;
      const height = Math.max(9, Math.round(width * (geometry ? geometry.boxH / geometry.boxW : 9 / 16)));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        ambient.lastDraw = 0;
      }
      try {
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;
        // Same visual speed at any frame rate: scale the per-frame blend by elapsed time.
        const speed = (settings.colorSpeed || 6) / 100;
        context.globalAlpha = canvas.style.opacity !== '1' || !ambient.lastDraw
          ? 1 : 1 - Math.pow(1 - speed, Math.min(elapsed, 1000) / (1000 / 60));
        const bars = ambient.bars;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const source = bars && vw && vh
          ? { x: bars.left * vw, y: bars.top * vh, w: vw * (1 - bars.left - bars.right), h: vh * (1 - bars.top - bars.bottom) }
          : { x: 0, y: 0, w: vw, h: vh };
        if (geometry) {
          drawExtended(context, video, source, geometry, width, height);
        } else if (bars && vw && vh) {
          context.drawImage(video, source.x, source.y, source.w, source.h, 0, 0, width, height);
        } else {
          context.drawImage(video, 0, 0, width, height);
        }
        ambient.lastDraw = now;
        canvas.style.opacity = '1';
      } catch { canvas.style.opacity = '0'; return; }
      ambient.frame = requestAnimationFrame(paintAmbient);
    };

    const drawAmbientLight = (moviePlayer, video, adShowing) => {
      if (!globalThis.__ytfpAmbientEnabled || !moviePlayer) {
        const ambient = globalThis.__ytfpAmbient;
        if (ambient) {
          cancelAnimationFrame(ambient.frame);
          ambient.wrap.remove();
          globalThis.__ytfpAmbient = null;
        }
        return;
      }
      if (!moviePlayer.querySelector('#__ytfp_ambient_wrap')) {
        const wrap = document.createElement('div');
        wrap.id = '__ytfp_ambient_wrap';
        wrap.setAttribute('aria-hidden', 'true');
        const canvas = document.createElement('canvas');
        canvas.id = '__ytfp_ambient';
        canvas.width = 64;
        canvas.height = 36;
        const noise = document.createElement('canvas');
        noise.id = '__ytfp_noise';
        wrap.append(canvas, noise);
        moviePlayer.prepend(wrap);
        globalThis.__ytfpAmbient = { wrap, canvas, noise, video: null, frame: 0, time: -1, still: 0, hidden: true, lastDraw: 0, barsAt: -Infinity, bars: null };
      }
      const ambient = globalThis.__ytfpAmbient;
      const settings = ambientSettings();
      ambient.video = video;
      drawNoise(ambient, settings);
      if (!settings.removeBars) ambient.bars = null;
      // Do not show ad frames or keep colors from the previous video while loading.
      ambient.hidden = adShowing || !video || video.readyState < 2;
      if (ambient.hidden) {
        ambient.canvas.style.opacity = '0';
        ambient.bars = null;
        return;
      }
      if (document.hidden || ambient.frame) return;
      if (video.paused && ambient.time === video.currentTime && ambient.still > 90) return;
      ambient.still = 0;
      ambient.frame = requestAnimationFrame(paintAmbient);
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
        applyLayout();
        const moviePlayer = document.querySelector('#movie_player, .html5-video-player');
        const adShowing = Boolean(moviePlayer?.classList.contains('ad-showing'));
        const video = moviePlayer?.querySelector('video');
        state.adShowing = adShowing;
        drawAmbientLight(moviePlayer, video, adShowing);

        // Không loop video quảng cáo; chỉ áp dụng cho nội dung chính.
        if (video && !video.__ytfpEndedListener) {
          video.__ytfpEndedListener = true;
          video.addEventListener?.('ended', () => {
            if (state.adShowing || globalThis.__ytfpLoopEnabled) return;
            state.endedVideo = { id: String(moviePlayer?.getVideoData?.().video_id || ''), generation: globalThis.__ytfpPlaylistGeneration };
          });
        }
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
    applyLayout();
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
      endedVideo: globalThis.__ytfpHelperState?.endedVideo || null,
      videoId: globalThis.__ytfpHelperState?.adShowing ? '' : String(videoData.video_id || ''),
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
    if (result?.endedVideo?.generation === playlistGeneration && advanceFavoritePlaylist(result.endedVideo.id)) return;
    if (!result?.adShowing) syncPlayingVideo(result?.videoId);
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
    if (!result?.adShowing && !result?.unavailable && result?.contentMedia?.paused === false) recordHistory();
    if (result?.unavailable && !youtubeView && !compatibilityMode && currentVideoId) {
      compatibilityMode = true;
      embedBlockedIds.add(currentVideoId);
      setPlayerStatus(`Embed lỗi ${result.errorCode || ''} — đang chuyển chế độ tương thích…`);
      player.src = watchUrl(currentVideoId);
    } else if (result?.unavailable) {
      setPlayerStatus(`YouTube không phát được video${result.errorCode ? ` (${result.errorCode})` : ''}. Thử tắt Chặn quảng cáo và Chế độ gọn, rồi Tải lại.`, true);
    } else if (result?.adShowing && cleanMode) {
      updatePlayerStatus('Đang tự động bỏ qua quảng cáo…');
    } else if (result?.lastSkipAt && Date.now() - result.lastSkipAt < 2500) {
      updatePlayerStatus('Đã tự động bỏ qua quảng cáo');
    } else if (result?.videoId || result?.contentMedia) {
      // Content is loaded: replace any loading/ad message with the real state.
      updatePlayerStatus(compatibilityMode && embedBlockedIds.has(currentVideoId) ? 'Đang phát ở chế độ tương thích' : 'Đang phát');
    }
  } catch {} finally {
    cleanupBusy = false;
    if (cleanupQueued) {
      cleanupQueued = false;
      applyCleanMode();
    }
  }
}

urlForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loadVideo(urlInput.value);
});

player.addEventListener('dom-ready', () => {
  window.desktop.registerPlayerShortcuts(player.getWebContentsId()).catch(() => {});
  setPlayerStatus(compatibilityMode ? 'Đang mở chế độ tương thích…' : 'Đang tải video…');
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
favoritesMenuBtn.addEventListener('click', () => favoritesPanelOpen && !historyMode ? closeFavoritesPanel() : openFavoritesPanel());
historyMenuBtn.addEventListener('click', () => favoritesPanelOpen && historyMode ? closeFavoritesPanel() : openFavoritesPanel(true));
favoriteBtn.addEventListener('click', toggleCurrentFavorite);
closeFavoritesBtn.addEventListener('click', closeFavoritesPanel);
compactHomeBtn.addEventListener('click', openYouTubeHome);
closeYoutubePanelBtn.addEventListener('click', closeYouTubeHome);

favoritesList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  const row = event.target.closest('.favorite-item');
  if (!button || !row) return;
  if (historyMode) {
    const item = historyVideos.find((video) => video.id === row.dataset.id);
    if (item && button.dataset.action === 'play') loadVideo(item.id);
    if (item && button.dataset.action === 'channel') openChannelInYouTubeHome(item.channelUrl);
    return;
  }
  const index = favoriteVideos.findIndex((item) => item.id === row.dataset.id);
  if (index < 0) return;
  const action = button.dataset.action;
  if (action === 'play') {
    loadVideo(favoriteVideos[index].id);
  } else if (action === 'channel') {
    openChannelInYouTubeHome(favoriteVideos[index].channelUrl);
  } else if (action === 'list') {
    openFavoriteListDialog(favoriteVideos[index].id);
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
    const visible = visibleFavoriteVideos();
    const visibleIndex = visible.findIndex((item) => item.id === row.dataset.id);
    const neighbor = visible[visibleIndex + (action === 'up' ? -1 : 1)];
    if (!neighbor) return;
    const target = favoriteVideos.findIndex((item) => item.id === neighbor.id);
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
  favoritesSplitter.setPointerCapture(event.pointerId);
  resizingFavoritesPanel = true;
  document.body.classList.add('split-resizing');
  event.preventDefault();
});
window.addEventListener('pointermove', (event) => {
  if (!resizingFavoritesPanel) return;
  // pointerup có thể rơi vào webview (process khác) và không về tới đây.
  if (!(event.buttons & 1)) return finishFavoritesPanelResize(event);
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
  panelSplitter.setPointerCapture(event.pointerId);
  resizingYoutubePanel = true;
  document.body.classList.add('split-resizing');
  event.preventDefault();
});

window.addEventListener('pointermove', (event) => {
  if (!resizingYoutubePanel) return;
  if (!(event.buttons & 1)) return finishYoutubePanelResize(event);
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
window.addEventListener('blur', finishYoutubePanelResize);
panelSplitter.addEventListener('lostpointercapture', finishYoutubePanelResize);
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

function updateViewModeUi() {
  const labels = { video: 'Video', youtube: 'YouTube', ambient: 'Ambient Light' };
  viewModeBtn.textContent = `▤ Giao diện: ${labels[playerViewMode]} ▾`;
  viewModeBtn.classList.toggle('active', playerViewMode !== 'video');
  for (const option of viewModeMenu.querySelectorAll('[data-view-mode]')) {
    option.setAttribute('aria-pressed', String(option.dataset.viewMode === playerViewMode));
  }
}

viewModeBtn.addEventListener('click', () => {
  if (viewModeMenu.matches(':popover-open')) {
    viewModeMenu.hidePopover();
    return;
  }
  viewModeMenu.showPopover();
  const rect = viewModeBtn.getBoundingClientRect();
  viewModeMenu.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - viewModeMenu.offsetWidth - 8))}px`;
  viewModeMenu.style.top = `${Math.max(8, Math.min(rect.bottom + 6, innerHeight - viewModeMenu.offsetHeight - 8))}px`;
  viewModeMenu.querySelector('[aria-pressed="true"]').focus();
});
viewModeMenu.addEventListener('toggle', (event) => {
  viewModeBtn.setAttribute('aria-expanded', String(event.newState === 'open'));
});
window.addEventListener('resize', () => viewModeMenu.hidePopover());

viewModeMenu.addEventListener('click', async (event) => {
  const option = event.target.closest('[data-view-mode]');
  if (!option || viewModeBtn.disabled) return;
  const selectedMode = option.dataset.viewMode;
  if (!['video', 'youtube', 'ambient'].includes(selectedMode)) return;
  viewModeMenu.hidePopover();
  viewModeBtn.focus();
  if (selectedMode === playerViewMode) return;
  viewModeBtn.disabled = true;
  try {
    const youtubeTarget = selectedMode === 'youtube';
    let path = '';
    try { path = new URL(player.getURL()).pathname; } catch {}
    // YouTube view needs the full /watch page; Video/Ambient render on either
    // /embed or /watch. When the current page fits, switch layout in place.
    const inPlace = Boolean(currentVideoId) && (path === '/watch' || (!youtubeTarget && path.startsWith('/embed/')));
    if (player.src && !inPlace) {
      const snapshot = await player.executeJavaScript(`(() => {
        const root = document.querySelector('#movie_player, .html5-video-player');
        const video = root?.querySelector('video');
        const ad = root?.classList.contains('ad-showing');
        return {
          id: ad ? '' : root?.getVideoData?.().video_id,
          media: !ad && video && Number.isFinite(video.duration) && !root?.getVideoData?.().isLive
            ? { time: video.currentTime, muted: video.muted, volume: video.volume,
                rate: video.playbackRate, paused: video.paused } : null
        };
      })()`).catch(() => null);
      syncPlayingVideo(snapshot?.id);
      pendingRestore = snapshot?.media || lastContentMedia;
    }
    playerViewMode = selectedMode;
    youtubeView = youtubeTarget;
    localStorage.setItem('playerViewMode', playerViewMode);
    updateViewModeUi();
    if (inPlace) {
      compatibilityMode = !youtubeView && path === '/watch';
      applyCleanMode();
    } else if (player.src && currentVideoId) {
      compatibilityMode = !youtubeView && embedBlockedIds.has(currentVideoId);
      stopPlayerHelpers();
      player.src = playerSource(currentVideoId);
      setPlayerStatus('Đang chuyển giao diện…');
    }
  } finally { viewModeBtn.disabled = false; }
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
    setPlayerStatus('Đang tải lại trình phát…');
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

function showSnapFeedback(action, gesture = 'snap') {
  if (!snapFeedback || !snapFeedbackText) return;
  snapFeedback.querySelector('.snap-feedback-icon').textContent = gesture === 'clap' ? '👏' : '🤌';
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
  await performGestureAction('snap');
}

async function performGestureAction(gesture) {
  const selected = localStorage.getItem(`${gesture}Action`) || (gesture === 'clap' ? 'visibility' : 'playback');
  if (selected === 'visibility') {
    try { await window.desktop.toggleVisibility(); }
    catch (err) { console.error('Window visibility action failed:', err); }
    return;
  }
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
      showSnapFeedback(action, gesture);
      setStatus(`${gesture === 'clap' ? '👏 Vỗ tay' : '🤌 Búng tay'}: ${action === 'play' ? 'Tiếp tục phát' : 'Tạm dừng'}`);
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

const settingsTabs = [...document.querySelectorAll('[data-settings-tab]')];
const settingsPanelAmbient = document.querySelector('#settingsPanelAmbient');

function selectSettingsTab(tab, focus = false) {
  for (const item of settingsTabs) {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  }
  if (focus) tab.focus();
}

settingsTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectSettingsTab(tab));
  tab.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    selectSettingsTab(settingsTabs[(index + step + settingsTabs.length) % settingsTabs.length], true);
  });
});

function renderAmbientSettings() {
  const { GROUPS, format } = window.AmbientSettings;
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const intro = make('div', 'settings-card-header');
  intro.append(make('p', 'settings-desc', 'Áp dụng ngay khi đang xem ở giao diện Ambient Light.'));
  const reset = make('button', 'modal-btn', 'Khôi phục mặc định');
  reset.type = 'button';
  reset.dataset.ambientReset = '';
  intro.append(reset);
  const cards = GROUPS.map((group) => {
    const card = make('section', 'settings-card');
    card.append(make('h3', 'settings-group-title', group.title));
    for (const field of group.fields) {
      const id = `ambient-${field.key}`;
      const row = make('div', 'settings-field');
      const head = make('div', 'field-label-group');
      const label = make('label', 'field-label', field.label);
      label.htmlFor = id;
      head.append(label);
      const input = make('input');
      input.id = id;
      input.dataset.ambientKey = field.key;
      if (field.type === 'toggle') {
        input.type = 'checkbox';
        input.checked = ambientSettings[field.key];
        const toggle = make('label', 'toggle-switch');
        toggle.append(input, make('span', 'slider'));
        head.append(toggle);
        row.append(head);
      } else {
        Object.assign(input, { type: 'range', min: field.min, max: field.max, step: field.step });
        input.value = ambientSettings[field.key];
        const value = make('output', 'field-value', format(field, ambientSettings[field.key]));
        value.htmlFor = id;
        head.append(value);
        row.append(head, input);
      }
      if (field.desc) row.append(make('p', 'settings-desc', field.desc));
      card.append(row);
    }
    return card;
  });
  settingsPanelAmbient.replaceChildren(intro, ...cards);
}

settingsPanelAmbient?.addEventListener('input', (event) => {
  const key = event.target.dataset.ambientKey;
  if (!key) return;
  const value = event.target.type === 'checkbox' ? event.target.checked : Number(event.target.value);
  ambientSettings = window.AmbientSettings.save(localStorage, { ...ambientSettings, [key]: value });
  const field = window.AmbientSettings.FIELDS.find((item) => item.key === key);
  const output = event.target.closest('.settings-field').querySelector('output');
  if (output) output.textContent = window.AmbientSettings.format(field, ambientSettings[key]);
  applyCleanMode();
});
settingsPanelAmbient?.addEventListener('click', (event) => {
  if (!event.target.closest('[data-ambient-reset]')) return;
  ambientSettings = window.AmbientSettings.save(localStorage, window.AmbientSettings.DEFAULTS);
  renderAmbientSettings();
  applyCleanMode();
  setStatus('Đã khôi phục cài đặt Ambient Light mặc định');
});
if (settingsPanelAmbient) renderAmbientSettings();

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

function handleClapVolume(data) {
  if (!settingsModal || settingsModal.hidden) return;
  if (clapMicMeterBar) {
    clapMicMeterBar.style.width = `${Math.min(100, Math.max(0, data.level))}%`;
  }
}

function updateClapStateUi(state, detail) {
  if (!clapMicStatusBadge) return;
  if (state === 'listening') {
    clapMicStatusBadge.textContent = '🟢 Đang lắng nghe';
    clapMicStatusBadge.className = 'status-badge listening';
    clapMicStatusBadge.removeAttribute('title');
    if (clapToggle) clapToggle.checked = true;
  } else if (state === 'error') {
    clapMicStatusBadge.textContent = '🔴 Lỗi micro';
    clapMicStatusBadge.className = 'status-badge error';
    clapMicStatusBadge.title = detail?.message || 'Không thể truy cập microphone';
    if (clapToggle) clapToggle.checked = false;
    if (detail?.message) setStatus(detail.message, true);
  } else {
    clapMicStatusBadge.textContent = '⚪ Đã tắt';
    clapMicStatusBadge.className = 'status-badge idle';
    clapMicStatusBadge.removeAttribute('title');
    if (clapToggle) clapToggle.checked = false;
    if (clapMicMeterBar) clapMicMeterBar.style.width = '0%';
  }
}

async function toggleClapControl(enable) {
  const target = typeof enable === 'boolean' ? enable : !clapEnabled;
  clapEnabled = target;
  localStorage.setItem('clapControlEnabled', String(clapEnabled));
  if (clapEnabled) {
    try {
      if (!clapDetector && window.ClapDetector) {
        initClapDetector();
      }
      if (clapDetector) {
        await clapDetector.start();
        setStatus('Đã bật điều khiển bằng vỗ tay 2 lần');
      }
    } catch (err) {
      clapEnabled = false;
      localStorage.setItem('clapControlEnabled', 'false');
      updateClapStateUi('error', err);
    }
  } else {
    if (clapDetector) clapDetector.stop();
    setStatus('Đã tắt điều khiển bằng vỗ tay 2 lần');
  }
}



const clapToggle = document.querySelector('#clapToggle');
const clapMicStatusBadge = document.querySelector('#clapMicStatusBadge');
const clapMicMeterBar = document.querySelector('#clapMicMeterBar');
const clapIndicator = document.querySelector('#clapIndicator');
const clapSensitivityRange = document.querySelector('#clapSensitivityRange');
const clapSensitivityValueLabel = document.querySelector('#clapSensitivityValueLabel');
const clapCooldownSelect = document.querySelector('#clapCooldownSelect');
let clapEnabled = localStorage.getItem('clapControlEnabled') === 'true';
let clapSensitivity = Number(localStorage.getItem('clapSensitivity')) || 60;
let clapCooldown = Number(localStorage.getItem('clapCooldown')) || 800;
let clapDetector = null;
let clapIndicatorTimer;
async function handleClapDetected() {
  clapIndicator?.classList.add('flash');
  clearTimeout(clapIndicatorTimer);
  clapIndicatorTimer = setTimeout(() => clapIndicator?.classList.remove('flash'), 600);
  await performGestureAction('clap');
}
function initClapDetector() {
  clapDetector = new window.ClapDetector({
    sensitivity: clapSensitivity, cooldownMs: clapCooldown,
    onSnap: handleClapDetected, onVolume: handleClapVolume,
    onStateChange: updateClapStateUi
  });
}
clapToggle?.addEventListener('change', () => toggleClapControl(clapToggle.checked));
clapSensitivityRange?.addEventListener('input', () => {
  clapSensitivity = Number(clapSensitivityRange.value) || 60;
  clapSensitivityValueLabel.textContent = `${clapSensitivity}%`;
  localStorage.setItem('clapSensitivity', String(clapSensitivity));
  clapDetector?.setSensitivity(clapSensitivity);
});
clapCooldownSelect?.addEventListener('change', () => {
  clapCooldown = Number(clapCooldownSelect.value) || 800;
  localStorage.setItem('clapCooldown', String(clapCooldown));
  clapDetector?.setCooldown(clapCooldown);
});
for (const gesture of ['snap', 'clap']) {
  const select = document.querySelector(`#${gesture}ActionSelect`);
  select.value = localStorage.getItem(`${gesture}Action`) === 'visibility' ? 'visibility'
    : localStorage.getItem(`${gesture}Action`) === 'playback' ? 'playback'
    : gesture === 'clap' ? 'visibility' : 'playback';
  select.addEventListener('change', () => localStorage.setItem(`${gesture}Action`, select.value));
}
clapSensitivityRange.value = String(clapSensitivity);
clapSensitivityValueLabel.textContent = `${clapSensitivity}%`;
clapCooldownSelect.value = String(clapCooldown);
initClapDetector();
if (clapEnabled) toggleClapControl(true);
else updateClapStateUi('idle');

(async () => {
  renderFavorites();
  enrichFavoriteChannels();
  updateFavoriteButton();
  updateLoopUi();
  updateViewModeUi();
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
