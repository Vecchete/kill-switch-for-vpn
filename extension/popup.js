import { DEFAULT_SETTINGS } from './rules.js';

const STATUS_TEXT = {
  blocking: 'No VPN connected. Tab traffic is blocked.',
  protected: 'VPN connected. Traffic is allowed.',
  off: 'Kill switch is off. Nothing is blocked.'
};

const statusText = document.getElementById('status');
const enabled = document.getElementById('enabled');
const allowLocalNetwork = document.getElementById('allowLocalNetwork');

async function render() {
  const settings = await chrome.storage.local.get({ ...DEFAULT_SETTINGS });
  const { state } = await chrome.storage.session.get({ state: '' });
  enabled.checked = settings.enabled;
  allowLocalNetwork.checked = settings.allowLocalNetwork;
  allowLocalNetwork.disabled = !settings.enabled;
  statusText.dataset.state = state;
  statusText.textContent = STATUS_TEXT[state] ?? 'Checking the VPN...';
}

enabled.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: enabled.checked });
});
allowLocalNetwork.addEventListener('change', () => {
  chrome.storage.local.set({ allowLocalNetwork: allowLocalNetwork.checked });
});
chrome.storage.onChanged.addListener(render);

render();
