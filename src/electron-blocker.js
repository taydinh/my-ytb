const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const { ipcMain } = require('electron');

const channels = ['@ghostery/adblocker/inject-cosmetic-filters', '@ghostery/adblocker/is-mutation-observer-enabled'];

// Guard Ghostery 2.18's async script injection across YouTube navigations.
// The upstream handler doesn't await executeJavaScript/insertCSS rejections.
class PlayerBlocker extends ElectronBlocker {
  constructor(...args) {
    super(...args);
    this.idleHandlers = false;
    this.onInjectCosmeticFilters = async (event, url, message) => {
      if (!this.isBlockingEnabled(event.sender.session)) return;
      const frame = event.senderFrame;
      if (!frame || frame !== event.sender.mainFrame || frame.url !== url) return;
      let hostname;
      try { hostname = new URL(url).hostname; } catch { return; }
      const domain = ['youtube.com', 'youtube-nocookie.com'].find(
        name => hostname === name || hostname.endsWith(`.${name}`)
      );
      if (!domain) return;
      const first = message === undefined;
      const { active, styles, scripts } = this.getCosmeticsFilters({
        domain, hostname, url, classes: message?.classes, hrefs: message?.hrefs, ids: message?.ids,
        getBaseRules: first, getInjectionRules: first, getExtendedRules: false,
        getRulesFromHostname: first, getRulesFromDOM: !first,
        callerContext: { frameId: event.frameId, processId: event.processId, lifecycle: message?.lifecycle }
      });
      if (!active) return;
      // One execution per batch avoids a listener per script while a page is loading.
      await Promise.allSettled([
        ...(styles ? [event.sender.insertCSS(styles, { cssOrigin: 'user' })] : []),
        ...(scripts.length ? [frame.executeJavaScript(
          scripts.map(script => `try {\n${script}\n} catch {}\n`).join('\n')
        )] : [])
      ]);
    };
  }

  enableBlockingInSession(session) {
    if (this.idleHandlers) {
      for (const channel of channels) ipcMain.removeHandler(channel);
      this.idleHandlers = false;
    }
    return super.enableBlockingInSession(session);
  }

  disableBlockingInSession(session) {
    if (!this.isBlockingEnabled(session)) return;
    super.disableBlockingInSession(session);
    // Already loaded pages keep their preload until the user reloads.
    if (this.config.loadCosmeticFilters) {
      for (const channel of channels) ipcMain.handle(channel, () => false);
      this.idleHandlers = true;
    }
  }
}

module.exports = { PlayerBlocker };
