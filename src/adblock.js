const fs = require('node:fs');
const path = require('node:path');

// Dependencies are injected so persistence and fallback can be tested without Electron.
function createAdblock({ ElectronBlocker, session, userData, bundledPath, fetchImpl = fetch }) {
  const settingsPath = path.join(userData, 'adblock-settings.json');
  const cachePath = path.join(userData, 'adblock-engine.bin');
  let enabled = true;
  let engine = null;
  let active = false;
  let error = '';
  let loadedCache = false;
  try { enabled = JSON.parse(fs.readFileSync(settingsPath, 'utf8')).enabled !== false; } catch {}

  function getState() { return { enabled, active, error }; }

  function apply() {
    if (!engine) return;
    if (enabled && !active) {
      engine.enableBlockingInSession(session);
      active = true;
    } else if (!enabled && active) {
      engine.disableBlockingInSession(session);
      active = false;
    }
  }

  function initialize() {
    for (const file of [cachePath, bundledPath]) {
      try {
        engine = ElectronBlocker.deserialize(new Uint8Array(fs.readFileSync(file)));
        loadedCache = file === cachePath;
        break;
      } catch { /* An outdated/corrupt cache must not prevent playback. */ }
    }
    if (!engine) error = 'Không tải được bộ lọc; tự Skip vẫn khả dụng.';
    try { apply(); } catch {
      try { engine?.disableBlockingInSession(session); } catch {}
      active = false;
      error = 'Không khởi động được bộ chặn; tự Skip vẫn khả dụng.';
    }
    return getState();
  }

  function setEnabled(value) {
    if (typeof value !== 'boolean') throw new TypeError('Expected a boolean');
    const previous = enabled;
    enabled = value;
    try {
      apply();
      fs.writeFileSync(settingsPath, JSON.stringify({ enabled }));
    } catch (cause) {
      enabled = previous;
      apply();
      throw cause;
    }
    return getState();
  }

  async function refresh() {
    // Keep the running engine stable; new filters take effect at next startup.
    if (!enabled) return;
    try {
      const age = Date.now() - fs.statSync(cachePath).mtimeMs;
      if (loadedCache && age < 24 * 60 * 60 * 1000) return;
    } catch {}
    const signal = AbortSignal.timeout(20000);
    const updated = await ElectronBlocker.fromPrebuiltAdsOnly(
      async (url, options) => {
        const response = await fetchImpl(url, { ...options, signal });
        if (!response.ok) throw new Error(`Filter download failed: ${response.status}`);
        return response;
      }
    );
    const temporary = `${cachePath}.tmp`;
    await fs.promises.writeFile(temporary, updated.serialize());
    await fs.promises.rename(temporary, cachePath);
  }

  return { initialize, getState, setEnabled, refresh };
}

module.exports = { createAdblock };
