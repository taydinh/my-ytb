// Refresh the bundled Ghostery ads-only snapshot before distributing a release.
const { FiltersEngine } = require('@ghostery/adblocker');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const signal = AbortSignal.timeout(30000);
  const engine = await FiltersEngine.fromPrebuiltAdsOnly(async (url, options) => {
    const response = await fetch(url, { ...options, signal });
    if (!response.ok) throw new Error(`Filter download failed: ${response.status}`);
    return response;
  });
  const target = path.join(__dirname, '../assets/adblock-engine.bin');
  await fs.writeFile(target, engine.serialize());
  console.log(`Saved ads-only filters: ${target}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
