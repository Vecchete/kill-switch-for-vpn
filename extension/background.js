import {
  DEFAULT_SETTINGS,
  dynamicRulesFor,
  isVpnConnected,
  sameRules,
  sessionRulesFor,
  stateFor
} from './rules.js';

// A VPN extension sets the proxy slightly before its tunnel carries traffic.
const SETTLE_MS = 1000;
const RETRY_WINDOW_MS = 15000;
const RETRY_DELAY_MS = 2000;
const BLOCKED_ERROR = 'net::ERR_BLOCKED_BY_CLIENT';
const RETRY_ERRORS = new Set([
  'net::ERR_PROXY_CONNECTION_FAILED',
  'net::ERR_TUNNEL_CONNECTION_FAILED',
  'net::ERR_CONNECTION_CLOSED',
  'net::ERR_CONNECTION_RESET',
  'net::ERR_CONNECTION_TIMED_OUT',
  'net::ERR_NAME_NOT_RESOLVED',
  'net::ERR_NETWORK_CHANGED'
]);

const BADGES = {
  blocking: { text: 'STOP', color: '#B3261E', title: 'Kill Switch for VPN: no VPN connected, tab traffic is blocked' },
  protected: { text: '', color: '#1E6B35', title: 'Kill Switch for VPN: VPN connected' },
  off: { text: 'OFF', color: '#5F6368', title: 'Kill Switch for VPN: off, nothing is blocked' }
};

let queue = Promise.resolve();

// One piece of work at a time, so two events never interleave their storage
// reads and writes.
function enqueue(work) {
  queue = queue.then(work).catch((error) => console.error('Kill Switch for VPN:', error));
  return queue;
}

export function settled() {
  return queue;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readProxy() {
  return new Promise((resolve) => chrome.proxy.settings.get({ incognito: false }, resolve));
}

async function readSettings() {
  return chrome.storage.local.get({ ...DEFAULT_SETTINGS });
}

async function replaceRules(get, update, wanted) {
  const current = await get();
  if (!sameRules(current, wanted)) {
    await update({ removeRuleIds: current.map((rule) => rule.id), addRules: wanted });
  }
}

async function applyRules(settings, state) {
  const dnr = chrome.declarativeNetRequest;
  await replaceRules(dnr.getDynamicRules, dnr.updateDynamicRules, dynamicRulesFor(settings));
  await replaceRules(dnr.getSessionRules, dnr.updateSessionRules, sessionRulesFor(state));
}

async function updateBadge(state) {
  const badge = BADGES[state];
  await chrome.action.setBadgeBackgroundColor({ color: badge.color });
  await chrome.action.setBadgeText({ text: badge.text });
  await chrome.action.setTitle({ title: badge.title });
}

async function reloadBlockedTabs() {
  const { blockedTabs } = await chrome.storage.session.get({ blockedTabs: [] });
  await chrome.storage.session.set({ blockedTabs: [], retriedTabs: [], releasedAt: Date.now() });
  await Promise.all(blockedTabs.map((tabId) => chrome.tabs.reload(tabId).catch(() => {})));
}

async function sync() {
  const settings = await readSettings();
  let state = stateFor(settings, isVpnConnected(await readProxy()));
  const { state: previous } = await chrome.storage.session.get({ state: null });
  if (state === 'protected' && previous !== 'protected') {
    await delay(SETTLE_MS);
    state = stateFor(settings, isVpnConnected(await readProxy()));
  }
  await applyRules(settings, state);
  if (state !== previous) {
    await chrome.storage.session.set({ state });
    await updateBadge(state);
    if (state !== 'blocking') {
      await reloadBlockedTabs();
    }
  }
}

async function onNavigationError(tabId, error) {
  const session = await chrome.storage.session.get({
    state: null,
    blockedTabs: [],
    retriedTabs: [],
    releasedAt: 0
  });
  if (error === BLOCKED_ERROR && (session.state === 'blocking' || session.state === null)) {
    if (!session.blockedTabs.includes(tabId)) {
      await chrome.storage.session.set({ blockedTabs: [...session.blockedTabs, tabId] });
    }
    return;
  }
  // A page that failed right after the VPN connected gets one more try. This
  // also covers a page blocked during startup, before the allow rule existed.
  const retryable = error === BLOCKED_ERROR || RETRY_ERRORS.has(error);
  const justReleased = Date.now() - session.releasedAt < RETRY_WINDOW_MS;
  if (session.state === 'protected' && retryable && justReleased && !session.retriedTabs.includes(tabId)) {
    await chrome.storage.session.set({ retriedTabs: [...session.retriedTabs, tabId] });
    setTimeout(() => chrome.tabs.reload(tabId).catch(() => {}), RETRY_DELAY_MS);
  }
}

chrome.runtime.onInstalled.addListener(() => enqueue(sync));
chrome.runtime.onStartup.addListener(() => enqueue(sync));
chrome.proxy.settings.onChange.addListener(() => enqueue(sync));
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    enqueue(sync);
  }
});
chrome.webNavigation.onErrorOccurred.addListener((details) => {
  if (details.frameId === 0 && details.tabId >= 0) {
    enqueue(() => onNavigationError(details.tabId, details.error));
  }
});

enqueue(sync);
