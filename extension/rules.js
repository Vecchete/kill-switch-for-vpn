// Dynamic rules survive a browser restart, so the navigation block is in place
// before the service worker runs. Session rules are cleared with the browser.
export const BLOCK_NAVIGATION_RULE_ID = 1;
export const ALLOW_LOCAL_NETWORK_RULE_IDS = Object.freeze([2, 3, 4]);
export const BLOCK_TAB_TRAFFIC_RULE_ID = 101;
export const ALLOW_NAVIGATION_RULE_ID = 102;

// chrome.tabs.TAB_ID_NONE. Requests outside any tab include the VPN
// extension's own connection, which must never be blocked.
export const TAB_ID_NONE = -1;

export const DEFAULT_SETTINGS = Object.freeze({ enabled: true, allowLocalNetwork: false });

export const ALL_RESOURCE_TYPES = Object.freeze([
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object',
  'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'webtransport',
  'webbundle', 'other'
]);

const NAVIGATION_TYPES = Object.freeze(['main_frame', 'sub_frame']);
const WEB_URL = '^(https?|wss?)://';

// localhost and *.local, then loopback, private and link-local IPv4, then IPv6
// loopback, unique local and link-local addresses. The browser compiles each
// regexFilter with RE2 under a small memory limit, and one pattern for all three
// is refused (memoryLimitExceeded), so they are separate rules.
export const LOCAL_NETWORK_REGEXES = Object.freeze([
  '^(https?|wss?)://(localhost|[a-z0-9-]+(\\.[a-z0-9-]+)*\\.local)([:/?#]|$)',
  '^(https?|wss?)://((127|10)(\\.[0-9]+){3}|192\\.168(\\.[0-9]+){2}' +
    '|172\\.(1[6-9]|2[0-9]|3[01])(\\.[0-9]+){2}|169\\.254(\\.[0-9]+){2})([:/?#]|$)',
  '^(https?|wss?)://\\[(::1|f[cd][0-9a-f:.]*|fe[89ab][0-9a-f:.]*)\\]([:/?#]|$)'
]);

export function isVpnConnected(proxyDetails) {
  const mode = proxyDetails?.value?.mode;
  return mode === 'fixed_servers' || mode === 'pac_script';
}

export function stateFor(settings, vpnConnected) {
  if (!settings.enabled) {
    return 'off';
  }
  return vpnConnected ? 'protected' : 'blocking';
}

export function dynamicRulesFor(settings) {
  if (!settings.enabled) {
    return [];
  }
  const rules = [{
    id: BLOCK_NAVIGATION_RULE_ID,
    priority: 1,
    action: { type: 'block' },
    condition: { regexFilter: WEB_URL, resourceTypes: [...NAVIGATION_TYPES] }
  }];
  if (settings.allowLocalNetwork) {
    LOCAL_NETWORK_REGEXES.forEach((regexFilter, index) => rules.push({
      id: ALLOW_LOCAL_NETWORK_RULE_IDS[index],
      priority: 2,
      action: { type: 'allow' },
      condition: { regexFilter, resourceTypes: [...ALL_RESOURCE_TYPES] }
    }));
  }
  return rules;
}

export function sessionRulesFor(state) {
  if (state === 'blocking') {
    return [{
      id: BLOCK_TAB_TRAFFIC_RULE_ID,
      priority: 1,
      action: { type: 'block' },
      condition: {
        regexFilter: WEB_URL,
        resourceTypes: [...ALL_RESOURCE_TYPES],
        excludedTabIds: [TAB_ID_NONE]
      }
    }];
  }
  if (state === 'protected') {
    return [{
      id: ALLOW_NAVIGATION_RULE_ID,
      priority: 3,
      action: { type: 'allow' },
      condition: { regexFilter: WEB_URL, resourceTypes: [...NAVIGATION_TYPES] }
    }];
  }
  return [];
}

// The browser can return rules with fields this extension never set, so rules
// are compared only on the fields it sets.
function ruleKey(rule) {
  const condition = rule.condition ?? {};
  return JSON.stringify([
    rule.id,
    rule.priority,
    rule.action?.type,
    condition.regexFilter ?? null,
    [...(condition.resourceTypes ?? [])].sort(),
    [...(condition.excludedTabIds ?? [])].sort()
  ]);
}

export function sameRules(current, wanted) {
  const a = current.map(ruleKey).sort();
  const b = wanted.map(ruleKey).sort();
  return a.length === b.length && a.every((key, index) => key === b[index]);
}
