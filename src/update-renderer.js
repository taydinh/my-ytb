const primary = document.querySelector('#primary');
const secondary = document.querySelector('#secondary');
primary.addEventListener('click', () => {
  primary.disabled = secondary.disabled = true;
  window.updater.act('install');
});
secondary.addEventListener('click', () => window.updater.act('dismiss'));
window.updater.onState(state => {
  document.querySelector('#title').textContent = state.title;
  document.querySelector('#status').textContent = state.status;
  document.querySelector('#notes').textContent = state.phase === 'available' ? state.notes : '';
  document.querySelector('#progressSection').hidden = ['available', 'error'].includes(state.phase);
  document.querySelector('#percent').textContent = `${Math.floor(state.percent)}%`;
  document.querySelector('#progress').value = state.percent;
  primary.hidden = !state.primary;
  secondary.hidden = !state.secondary;
  primary.textContent = state.primary || '';
  secondary.textContent = state.secondary || '';
  primary.disabled = secondary.disabled = false;
  if (state.primary) primary.focus();
});
