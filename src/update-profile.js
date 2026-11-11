const path = require('node:path');

function restoreUpdateProfile(app) {
  const profile = app.commandLine.getSwitchValue('ytp-user-data');
  if (!profile) return;
  if (!path.isAbsolute(profile)) throw new Error('Đường dẫn dữ liệu cập nhật không hợp lệ.');
  app.setPath('userData', profile);
  app.setPath('sessionData', profile);
}
async function flushUpdateProfile(sessions) {
  for (const current of sessions) {
    current.flushStorageData();
    await current.cookies.flushStore();
  }
}
module.exports = { restoreUpdateProfile, flushUpdateProfile };
