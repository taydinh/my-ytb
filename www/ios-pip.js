(() => {
  if (!['www.youtube.com', 'www.youtube-nocookie.com'].includes(location.hostname)) return;
  const bridge = window.webkit?.messageHandlers?.youtubePiP;
  if (!bridge) return;
  let timer;
  const watched = new WeakSet();
  const report = state => bridge.postMessage({ state });
  const active = video => video.webkitPresentationMode === 'picture-in-picture' || document.pictureInPictureElement === video;
  function watch() {
    for (const video of document.querySelectorAll('video')) {
      if (watched.has(video)) continue;
      watched.add(video);
      report('ready');
      const changed = () => {
        clearTimeout(timer);
        report(active(video) ? 'active' : 'inline');
      };
      video.addEventListener('webkitpresentationmodechanged', changed);
      video.addEventListener('enterpictureinpicture', changed);
      video.addEventListener('leavepictureinpicture', changed);
      video.addEventListener('loadedmetadata', () => report('ready'));
    }
  }
  window.__startYouTubePiP = () => {
    const videos = [...document.querySelectorAll('video')];
    const video = videos.find(active) || videos.find(v => !v.paused && v.readyState >= 2) || videos.find(v => v.readyState >= 2);
    if (!video) { report('unavailable'); return; }
    if (active(video)) { report('active'); return; }
    clearTimeout(timer);
    timer = setTimeout(() => report(active(video) ? 'active' : 'unavailable'), 2500);
    try {
      if (typeof video.webkitSetPresentationMode === 'function' &&
          (!video.webkitSupportsPresentationMode || video.webkitSupportsPresentationMode('picture-in-picture'))) {
        video.webkitSetPresentationMode('picture-in-picture');
      } else if (document.pictureInPictureEnabled && video.requestPictureInPicture) {
        video.requestPictureInPicture().catch(() => { clearTimeout(timer); report('unavailable'); });
      } else { clearTimeout(timer); report('unavailable'); }
    } catch { clearTimeout(timer); report('unavailable'); }
  };
  new MutationObserver(watch).observe(document.documentElement, { childList: true, subtree: true });
  watch();
})();
