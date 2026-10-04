(function exposePlayerShortcuts(globalObject) {
  const ACTIONS = Object.freeze({ j: 'backward', k: 'toggle', l: 'forward' });

  function getAction(input) {
    if (!input || input.type && input.type !== 'keyDown') return null;
    if (input.control || input.ctrlKey || input.alt || input.altKey || input.meta || input.metaKey) return null;
    const action = ACTIONS[String(input.key || '').toLowerCase()] || null;
    if (action === 'toggle' && (input.isAutoRepeat || input.repeat)) return null;
    return action;
  }

  function isEditableTarget(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'));
  }

  function createPlayerScript(action) {
    return `(() => {
      const root = document.querySelector('#movie_player, .html5-video-player');
      const video = root?.querySelector('video') || document.querySelector('video');
      if (!video) return false;
      if (${JSON.stringify(action)} === 'toggle') {
        if (video.paused) {
          const result = typeof root?.playVideo === 'function' ? root.playVideo() : video.play();
          result?.catch?.(() => {});
        } else if (typeof root?.pauseVideo === 'function') root.pauseVideo();
        else video.pause();
        return true;
      }
      const seconds = ${JSON.stringify(action)} === 'backward' ? -10 : 10;
      if (typeof root?.seekBy === 'function') root.seekBy(seconds);
      else {
        const maximum = Number.isFinite(video.duration) ? video.duration : Number.POSITIVE_INFINITY;
        video.currentTime = Math.max(0, Math.min(maximum, video.currentTime + seconds));
      }
      return true;
    })()`;
  }

  const api = { getAction, isEditableTarget, createPlayerScript };
  globalObject.PlayerShortcuts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
