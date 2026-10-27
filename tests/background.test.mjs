import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOW_LOCAL_NETWORK_RULE_IDS,
  ALLOW_NAVIGATION_RULE_ID,
  BLOCK_NAVIGATION_RULE_ID,
  BLOCK_TAB_TRAFFIC_RULE_ID
} from '../extension/rules.js';

const BLOCKED = 'net::ERR_BLOCKED_BY_CLIENT';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createEvent() {
  const listeners = [];
  return {
    addListener: (listener) => listeners.push(listener),
    dispatch: (...args) => listeners.forEach((listener) => listener(...args))
  };
}

function createStorageArea(areaName, onChanged) {
  const data = {};
  return {
    async get(keys) {
      if (typeof keys === 'string') {
        return keys in data ? { [keys]: structuredClone(data[keys]) } : {};
      }
      return Object.fromEntries(Object.entries(keys).map(([key, fallback]) =>
        [key, key in data ? structuredClone(data[key]) : fallback]));
    },
    async set(items) {
      const changes = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: data[key], newValue: value };
        data[key] = structuredClone(value);
      }
      onChanged.dispatch(changes, areaName);
    }
  };
}

function createFakeChrome({ proxyMode = 'system', refuseRuleIds = [] } = {}) {
  const onChanged = createEvent();
  const proxyChanged = createEvent();
  const ruleSets = { dynamic: [], session: [] };
  const reloaded = [];
  const badge = {};
  let mode = proxyMode;

  const updater = (name) => async ({ removeRuleIds = [], addRules = [] }) => {
    if (addRules.some((rule) => refuseRuleIds.includes(rule.id))) {
      throw new Error('rule refused');
    }
    const kept = ruleSets[name].filter((rule) => !removeRuleIds.includes(rule.id));
    for (const rule of addRules) {
      if (kept.some((existing) => existing.id === rule.id)) {
        throw new Error(`duplicate rule id ${rule.id}`);
      }
    }
    ruleSets[name] = [...kept, ...structuredClone(addRules)];
  };

  const chrome = {
    storage: {
      local: createStorageArea('local', onChanged),
      session: createStorageArea('session', onChanged),
      onChanged
    },
    proxy: {
      settings: {
        get: (details, callback) => queueMicrotask(() => callback({ value: { mode }, levelOfControl: 'controllable_by_this_extension' })),
        onChange: proxyChanged
      }
    },
    declarativeNetRequest: {
      getDynamicRules: async () => structuredClone(ruleSets.dynamic),
      getSessionRules: async () => structuredClone(ruleSets.session),
      updateDynamicRules: updater('dynamic'),
      updateSessionRules: updater('session')
    },
    webNavigation: { onErrorOccurred: createEvent() },
    runtime: { onInstalled: createEvent(), onStartup: createEvent() },
    tabs: { reload: async (tabId) => { reloaded.push(tabId); } },
    action: {
      setBadgeText: async ({ text }) => { badge.text = text; },
      setBadgeBackgroundColor: async ({ color }) => { badge.color = color; },
      setTitle: async ({ title }) => { badge.title = title; }
    }
  };

  return {
    chrome,
    reloaded,
    badge,
    ids: (name) => ruleSets[name].map((rule) => rule.id).sort((a, b) => a - b),
    setProxy(next) {
      mode = next;
      proxyChanged.dispatch({ value: { mode: next } });
    },
    navigationError(tabId, error, frameId = 0) {
      chrome.webNavigation.onErrorOccurred.dispatch({ tabId, frameId, error, url: 'https://example.com/' });
    }
  };
}

let instance = 0;

async function start(fake) {
  globalThis.chrome = fake.chrome;
  instance += 1;
  const background = await import(`../extension/background.js?instance=${instance}`);
  await background.settled();
  return background;
}

test('without a VPN, page loads and all tab traffic are blocked', async () => {
  const fake = createFakeChrome();
  await start(fake);
  assert.deepEqual(fake.ids('dynamic'), [BLOCK_NAVIGATION_RULE_ID]);
  assert.deepEqual(fake.ids('session'), [BLOCK_TAB_TRAFFIC_RULE_ID]);
  assert.equal(fake.badge.text, 'STOP');
});

test('tabs blocked while the VPN was off reload once it connects, and the block returns when it drops', async () => {
  const fake = createFakeChrome();
  const background = await start(fake);
  fake.navigationError(7, BLOCKED);
  fake.navigationError(8, BLOCKED, 3);
  fake.navigationError(-1, BLOCKED);
  await background.settled();

  fake.setProxy('fixed_servers');
  await background.settled();
  assert.deepEqual(fake.ids('dynamic'), [BLOCK_NAVIGATION_RULE_ID]);
  assert.deepEqual(fake.ids('session'), [ALLOW_NAVIGATION_RULE_ID]);
  assert.deepEqual(fake.reloaded, [7]);
  assert.equal(fake.badge.text, '');

  fake.setProxy('system');
  await background.settled();
  assert.deepEqual(fake.ids('session'), [BLOCK_TAB_TRAFFIC_RULE_ID]);
  assert.equal(fake.badge.text, 'STOP');
});

test('turning the kill switch off removes every rule and reloads the blocked tabs', async () => {
  const fake = createFakeChrome();
  const background = await start(fake);
  fake.navigationError(3, BLOCKED);
  await background.settled();

  await fake.chrome.storage.local.set({ enabled: false });
  await background.settled();
  assert.deepEqual(fake.ids('dynamic'), []);
  assert.deepEqual(fake.ids('session'), []);
  assert.deepEqual(fake.reloaded, [3]);
  assert.equal(fake.badge.text, 'OFF');

  await fake.chrome.storage.local.set({ enabled: true, allowLocalNetwork: true });
  await background.settled();
  assert.deepEqual(fake.ids('dynamic'), [BLOCK_NAVIGATION_RULE_ID, ...ALLOW_LOCAL_NETWORK_RULE_IDS]);
  assert.deepEqual(fake.ids('session'), [BLOCK_TAB_TRAFFIC_RULE_ID]);
});

test('when the browser refuses a rule, the block rules stay in place', async () => {
  const fake = createFakeChrome({ refuseRuleIds: [ALLOW_LOCAL_NETWORK_RULE_IDS[0]] });
  const background = await start(fake);
  const consoleError = console.error;
  console.error = () => {};
  try {
    await fake.chrome.storage.local.set({ allowLocalNetwork: true });
    await background.settled();
  } finally {
    console.error = consoleError;
  }
  assert.deepEqual(fake.ids('dynamic'), [BLOCK_NAVIGATION_RULE_ID]);
  assert.deepEqual(fake.ids('session'), [BLOCK_TAB_TRAFFIC_RULE_ID]);
  assert.equal(fake.badge.text, 'STOP');
});

test('a page that fails right after the VPN connects is retried once', async () => {
  const fake = createFakeChrome({ proxyMode: 'pac_script' });
  const background = await start(fake);
  assert.deepEqual(fake.ids('session'), [ALLOW_NAVIGATION_RULE_ID]);

  fake.navigationError(9, 'net::ERR_TUNNEL_CONNECTION_FAILED');
  fake.navigationError(9, 'net::ERR_TUNNEL_CONNECTION_FAILED');
  fake.navigationError(10, 'net::ERR_ABORTED');
  await background.settled();
  await sleep(2300);
  assert.deepEqual(fake.reloaded, [9]);
});
