(() => {
  if (!['www.youtube.com', 'www.youtube-nocookie.com'].includes(location.hostname)) return;
  const bridge = window.webkit?.messageHandlers?.youtubePiP;
  if (!bridge) return;
  let timer;
  let wasPlayingBeforeBackground = false;
  let lastKnownPlaying = false;
  let lastPlaybackProgress = 0;
  let lastRecovery = 0;
  const watched = new WeakSet();
  const report = state => bridge.postMessage({ state });
  const active = video => video.webkitPresentationMode === 'picture-in-picture' || document.pictureInPictureElement === video;
  const currentVideo = () => {
    const videos = [...document.querySelectorAll('video')];
    return videos.find(active) || videos.find(v => !v.paused && v.readyState >= 2) || videos.find(v => v.readyState >= 2);
  };
  const wasPlayingRecently = () => lastKnownPlaying || Date.now() - lastPlaybackProgress < 2000;

  // WebKit can keep the PiP session alive while suspending its video renderer
  // during a long screen lock. Asking for a fresh frame after foregrounding
  // reconnects that renderer without leaving/re-entering PiP.
  function recover() {
    const video = currentVideo();
    if (!video || !active(video) || video.readyState < 2) return;
    const now = Date.now();
    if (now - lastRecovery < 250) return;
    lastRecovery = now;

    if (!video.paused || wasPlayingBeforeBackground) {
      const time = Number(video.currentTime);
      if (Number.isFinite(time) && video.seekable?.length) {
        const end = video.seekable.end(video.seekable.length - 1);
        video.currentTime = Math.min(end, time + 0.001);
      }
      const promise = video.play();
      promise?.catch?.(() => {});
    }
  }
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
      video.addEventListener('play', () => { lastKnownPlaying = true; });
      video.addEventListener('playing', () => { lastKnownPlaying = true; });
      video.addEventListener('timeupdate', () => {
        if (!video.paused) {
          lastKnownPlaying = true;
          lastPlaybackProgress = Date.now();
        }
      });
      video.addEventListener('pause', () => {
        // WebKit may mark the media paused as part of backgrounding before it
        // gives us a chance to request PiP. Keep the last foreground state in
        // that case; a genuine user pause while visible clears it.
        if (!document.hidden) {
          lastKnownPlaying = false;
          lastPlaybackProgress = 0;
        }
      });
      if (!video.paused) {
        lastKnownPlaying = true;
        lastPlaybackProgress = Date.now();
      }
    }
  }
  function start(onlyIfPlaying = false) {
    const video = currentVideo();
    if (!video) { report('unavailable'); return; }
    if (onlyIfPlaying && !wasPlayingRecently() && !wasPlayingBeforeBackground) return;
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
      if (onlyIfPlaying && video.paused) video.play()?.catch?.(() => {});
    } catch { clearTimeout(timer); report('unavailable'); }
  }
  window.__startYouTubePiP = () => start(false);
  window.__startYouTubePiPIfPlaying = () => start(true);
  window.__recoverYouTubePiP = recover;
  document.addEventListener?.('visibilitychange', () => {
    const video = currentVideo();
    if (document.hidden) {
      wasPlayingBeforeBackground = Boolean(video && (!video.paused || wasPlayingRecently()));
      if (wasPlayingBeforeBackground) start(true);
    } else {
      wasPlayingBeforeBackground = false;
      setTimeout(recover, 100);
      setTimeout(recover, 800);
    }
  });
  window.addEventListener?.('pageshow', () => setTimeout(recover, 100));
  new MutationObserver(watch).observe(document.documentElement, { childList: true, subtree: true });
  watch();
})();
