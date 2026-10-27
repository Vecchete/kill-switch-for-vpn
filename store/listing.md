# Microsoft Edge Add-ons listing

Everything to enter in Partner Center for version 1.0.0. Build the package with `npm run package`, it writes `dist/kill-switch-for-vpn-1.0.0.zip`.

## Availability

- Visibility: **Hidden**
- Markets: all markets

## Properties

- Category: the privacy or security category if the dropdown has one, otherwise Productivity
- Website: https://github.com/Vecchete/kill-switch-for-vpn
- Support contact: https://github.com/Vecchete/kill-switch-for-vpn/issues
- Mature content: no

## Privacy

**Single purpose**

Blocks requests from browser tabs while no VPN extension is connected, and reloads the blocked tabs once it connects.

**Permission justification**

- `declarativeNetRequest`: blocks requests from tabs while no VPN is connected and allows them again once it connects. It uses block and allow rules only and never reads what a request contains.
- `proxy`: reads the browser's proxy setting to detect whether a VPN extension is connected. The extension never sets or changes the proxy.
- `webNavigation`: detects which tabs had a page load blocked, so those tabs can be reloaded once the VPN connects.
- `storage`: keeps the kill switch setting and the local network option on the device.

**Remote code:** No. All code is in the package.

**Data usage:** none of the listed data types is collected. Tick every certification checkbox.

**Privacy policy URL:** https://github.com/Vecchete/kill-switch-for-vpn/blob/main/PRIVACY.md

## Store listing, English

**Extension name:** Kill Switch for VPN, taken from the manifest.

**Short description:** taken from the manifest.

**Description:**

```text
Kill Switch for VPN stops your tabs from reaching the internet while your VPN extension is disconnected. No page loads and no request leaves a tab until the VPN is connected, so websites don't get your cookies or your real IP address by accident.

The block is already active when the browser starts, before your VPN extension had time to connect. As soon as the VPN connects, traffic is allowed again and the tabs that were blocked reload by themselves. If the VPN drops later, the block comes back.

It works with VPN extensions that connect through the browser's proxy setting, which is how most browser VPN extensions work.

Features:
- An on and off toggle in the toolbar popup.
- An option to allow the local network (localhost, *.local and private IP addresses) while the VPN is off.
- A toolbar badge that shows when traffic is blocked.
- Blocked tabs reload by themselves once the VPN connects.

Privacy: the extension doesn't collect or send any data, and it doesn't contact any server. The source code is public at https://github.com/Vecchete/kill-switch-for-vpn

Limitations: a VPN that runs as a desktop app is not detected. Requests that don't come from a tab are not blocked, such as other extensions' own traffic and the browser's own services. That is how your VPN extension can still reach its servers to connect.
```

**Extension logo:** `store/logo-300.png` (300 x 300)

**Small promotional tile:** `store/promo-440x280.png` (440 x 280)

**Search terms** (7 terms, 16 words):

```text
VPN kill switch
block traffic without VPN
VPN leak protection
proxy
privacy
IP leak
tab blocker
```

## Notes for certification

```text
How to test:
1. Install a VPN extension that connects through the browser's proxy setting and leave it disconnected.
2. Install Kill Switch for VPN. The toolbar badge shows STOP. Open any website: the page is blocked by the extension.
3. Connect the VPN extension. About one second later the badge clears and the blocked tab reloads through the VPN.
4. Disconnect the VPN. New page loads are blocked again and the badge shows STOP.
5. Open the popup and turn the kill switch off. The badge shows OFF and pages load normally.

Kill Switch for VPN needs no account or credentials. The VPN extension used for testing needs its own account.
```
