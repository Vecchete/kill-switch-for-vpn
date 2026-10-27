import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import {
  ALL_RESOURCE_TYPES,
  DEFAULT_SETTINGS,
  LOCAL_NETWORK_REGEX,
  TAB_ID_NONE,
  dynamicRulesFor,
  isVpnConnected,
  sameRules,
  sessionRulesFor,
  stateFor
} from '../extension/rules.js';

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('a proxy set to fixed servers or a PAC script counts as a connected VPN', () => {
  assert.equal(isVpnConnected({ value: { mode: 'fixed_servers' } }), true);
  assert.equal(isVpnConnected({ value: { mode: 'pac_script' } }), true);
  for (const mode of ['system', 'direct', 'auto_detect']) {
    assert.equal(isVpnConnected({ value: { mode } }), false, mode);
  }
  assert.equal(isVpnConnected(undefined), false);
});

test('the toggle wins over the VPN state', () => {
  assert.equal(stateFor({ enabled: false }, true), 'off');
  assert.equal(stateFor({ enabled: false }, false), 'off');
  assert.equal(stateFor({ enabled: true }, true), 'protected');
  assert.equal(stateFor({ enabled: true }, false), 'blocking');
});

test('the persistent rule blocks only page loads, so the VPN extension can still connect', () => {
  const [rule] = dynamicRulesFor(DEFAULT_SETTINGS);
  assert.equal(rule.action.type, 'block');
  assert.deepEqual(rule.condition.resourceTypes, ['main_frame', 'sub_frame']);
  assert.equal(dynamicRulesFor({ enabled: false, allowLocalNetwork: true }).length, 0);
  assert.equal(dynamicRulesFor({ enabled: true, allowLocalNetwork: true }).length, 2);
});

test('while blocking, every request from a tab is blocked and requests outside tabs are not', () => {
  const [rule] = sessionRulesFor('blocking');
  assert.equal(rule.action.type, 'block');
  assert.deepEqual(rule.condition.resourceTypes, [...ALL_RESOURCE_TYPES]);
  assert.deepEqual(rule.condition.excludedTabIds, [TAB_ID_NONE]);
});

test('once protected, an allow rule outranks the persistent block', () => {
  const [allow] = sessionRulesFor('protected');
  const [block] = dynamicRulesFor(DEFAULT_SETTINGS);
  assert.equal(allow.action.type, 'allow');
  assert.ok(allow.priority > block.priority);
  assert.deepEqual(sessionRulesFor('off'), []);
});

test('the local network allow rule outranks both block rules', () => {
  const rules = dynamicRulesFor({ enabled: true, allowLocalNetwork: true });
  const allow = rules.find((rule) => rule.action.type === 'allow');
  const blocks = [...rules.filter((rule) => rule.action.type === 'block'), ...sessionRulesFor('blocking')];
  for (const block of blocks) {
    assert.ok(allow.priority > block.priority);
  }
});

test('rule ids never collide', () => {
  const ids = [
    ...dynamicRulesFor({ enabled: true, allowLocalNetwork: true }),
    ...sessionRulesFor('blocking'),
    ...sessionRulesFor('protected')
  ].map((rule) => rule.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('the local network pattern matches private addresses only', () => {
  const pattern = new RegExp(LOCAL_NETWORK_REGEX, 'i');
  const local = [
    'http://localhost:8080/', 'https://printer.local/status', 'http://127.0.0.1/',
    'http://10.1.2.3/', 'http://192.168.1.1', 'https://172.16.0.5:8443/x',
    'http://172.31.255.255/', 'http://169.254.10.20/', 'http://[::1]:3000/',
    'http://[fd12:3456::1]/', 'http://[fe80::1]/', 'ws://192.168.0.10:8080/socket'
  ];
  const remote = [
    'https://example.com/', 'https://localhost.example.com/', 'http://172.32.0.1/',
    'http://192.169.0.1/', 'https://10.example.com/', 'https://example.com/?next=http://192.168.1.1',
    'https://local/', 'https://my.local.example.com/', 'http://[2001:db8::1]/'
  ];
  for (const url of local) {
    assert.match(url, pattern, url);
  }
  for (const url of remote) {
    assert.doesNotMatch(url, pattern, url);
  }
});

test('the local network pattern is ASCII, as regexFilter requires', () => {
  assert.match(LOCAL_NETWORK_REGEX, /^[\x20-\x7e]+$/);
});

test('rules are compared on the fields the extension sets', () => {
  const wanted = sessionRulesFor('blocking');
  const returned = wanted.map((rule) => ({
    ...rule,
    condition: { ...rule.condition, isUrlFilterCaseSensitive: false }
  }));
  assert.equal(sameRules(returned, wanted), true);
  assert.equal(sameRules([], wanted), false);
  assert.equal(sameRules(sessionRulesFor('protected'), wanted), false);
});

test('the manifest and package.json agree, and every icon exists', async () => {
  const manifest = await readJson('../extension/manifest.json');
  const pkg = await readJson('../package.json');
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.manifest_version, 3);
  assert.ok(manifest.description.length <= 132);
  const icons = [...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)];
  for (const icon of icons) {
    await access(new URL(`../extension/${icon}`, import.meta.url));
  }
});
