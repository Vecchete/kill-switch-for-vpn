# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.1] - 2026-10-27

### Fixed

- Turning on the local network option left the extension with no rules at all. Edge refused the single pattern for every local address (RE2 memory limit), so the local network is now three smaller rules.
- When the browser refuses a rule, the block rules are applied on their own, so the kill switch never fails open.

## [1.0.0] - 2026-10-27

### Added

- Kill switch that blocks every request from your tabs while no VPN extension is connected.
- Automatic reload of the blocked tabs once the VPN connects, with one retry for a page that fails while the VPN finishes connecting.
- Popup with the kill switch toggle and an option to allow the local network while the VPN is off.
- Toolbar badge that shows whether traffic is blocked, allowed, or the kill switch is off.

[1.0.1]: https://github.com/Vecchete/kill-switch-for-vpn/releases/tag/v1.0.1
[1.0.0]: https://github.com/Vecchete/kill-switch-for-vpn/releases/tag/v1.0.0
