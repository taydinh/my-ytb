const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { UPDATE_ROOT, compareVersions, validateManifest, checkForUpdate, downloadUpdate } = require('../src/update-service');
const bytes = Buffer.from('test update package');
const manifest = {
  version: '1.0.6', minimumVersion: '1.0.5', mandatory: false,
  downloadUrl: UPDATE_ROOT + 'YTP-1.0.6-win-x64.zip',
  sha256: crypto.createHash('sha256').update(bytes).digest('hex'), size: bytes.length
};
test('compares numeric versions and enforces minimumVersion/mandatory', async () => {
  assert.equal(compareVersions('1.0.15', '1.0.9'), 1);
  assert.equal(compareVersions('1.0.6', '1.0.6.0'), 0);
  const fetcher = async url => { assert.equal(url, UPDATE_ROOT + 'latest.json'); return Response.json(manifest); };
  assert.equal((await checkForUpdate('1.0.5', fetcher)).isMandatory, false);
  assert.equal((await checkForUpdate('1.0.4', fetcher)).isMandatory, true);
  assert.equal((await checkForUpdate('1.0.5', async () => Response.json({ ...manifest, mandatory: true }))).isMandatory, true);
  assert.equal(await checkForUpdate('1.0.6', fetcher), null);
  assert.equal(await checkForUpdate('1.0.5', async () => new Response('', { status: 404 })), null);
});
test('rejects invalid manifests and URLs outside configured ytp server', () => {
  for (const downloadUrl of ['http://timeclock.maskermedia.com/updates/ytp/win-x64/x.zip',
    'https://example.com/updates/ytp/win-x64/x.zip', UPDATE_ROOT + '../x.zip',
    'https://timeclock.maskermedia.com/updates/report/win-x64/x.zip']) {
    assert.throws(() => validateManifest({ ...manifest, downloadUrl }));
  }
  assert.throws(() => validateManifest({ ...manifest, sha256: 'x'.repeat(64) }));
  assert.throws(() => validateManifest({ ...manifest, version: '../bad' }));
});
test('download verifies size/hash, reports progress and removes corrupt packages', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ytp-update-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const progress = [];
  const file = await downloadUpdate(manifest, directory, value => progress.push(value), async () => new Response(bytes));
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.equal(progress.at(-1), 1);
  await assert.rejects(downloadUpdate({ ...manifest, sha256: '0'.repeat(64) }, directory, undefined, async () => new Response(bytes)), /SHA-256/);
  assert.equal(fs.existsSync(file), false);
  await assert.rejects(downloadUpdate(manifest, directory, undefined, async () => new Response(Buffer.alloc(bytes.length + 1))), /Kích thước/);
  assert.equal(fs.existsSync(file), false);
});
