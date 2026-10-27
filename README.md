# Kill Switch for VPN

Kill Switch for VPN is a browser extension that blocks every request from your tabs while no VPN extension is connected. No page loads and no cookie is sent or received until the VPN is up. Once it connects, the tabs that were blocked reload by themselves.

It works with VPN extensions that connect by setting the browser's proxy, like the Surfshark and NordVPN extensions. It doesn't see a VPN that runs as a desktop app.

## How it works

- While the kill switch is on, a rule that survives browser restarts blocks every page load. It's active as soon as the browser loads the extension, before your VPN extension had time to connect.
- While no VPN is connected, a second rule blocks every other request from your tabs too: scripts, images, XHR and WebSockets.
- A VPN extension connects by setting the browser's proxy. When that happens, the kill switch waits one second, lets traffic through and reloads the tabs it blocked. When the proxy goes back to the system setting, the block returns.
- Requests that don't come from a tab are never blocked. That's how your VPN extension still reaches its own servers to connect.

## Using it

Click the toolbar icon to open the popup.

- **Kill switch** turns the protection on or off. It's on after install.
- **Allow the local network while the VPN is off** lets `localhost`, `*.local` and private IP addresses load, such as your router. It's off by default.

The icon shows a red `STOP` badge while traffic is blocked, no badge while a VPN is connected, and a gray `OFF` badge while the kill switch is off.

## Installing

The Microsoft Edge Add-ons listing is in review. Until then you can load it from source:

1. Clone this repository.
2. Open `edge://extensions` or `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder.

## Permissions

| Permission | Why |
|---|---|
| `declarativeNetRequest` | Blocks and allows requests with the browser's own rule engine. The extension never reads what a request contains. |
| `proxy` | Reads the proxy setting to know whether a VPN extension is connected. The extension never changes it. |
| `webNavigation` | Sees which tabs had a page load blocked, so they can be reloaded once the VPN connects. |
| `storage` | Keeps the two settings on your device. |

## Limitations

- Only VPN extensions that use the browser's proxy are detected. A VPN app that runs on the whole system is not.
- Requests that don't come from a tab are not blocked. That includes other extensions' own traffic, a website's service worker running in the background, and the browser's own services such as updates, sync and search suggestions. No extension can block the browser's own services.
- WebRTC traffic doesn't go through the browser's request rules, so the kill switch can't block it. Most VPN extensions handle WebRTC leaks themselves.
- If your VPN extension sends you to a website to sign in, turn the kill switch off while you sign in.

## Privacy

The extension doesn't collect, store or send any personal data. See [PRIVACY.md](PRIVACY.md).

## Development

You need Node.js 22.2 or later. There are no dependencies to install.

```sh
npm test          # unit tests with node:test and a fake chrome API
npm run package   # writes dist/kill-switch-for-vpn-<version>.zip
```

`tools/make-icons.ps1` renders the icons and the store images on Windows.

## License

[MIT](LICENSE)
