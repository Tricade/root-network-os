# Security and private data

ROOT is a single-user simulation with one shared save per instance and no account system. Local browser and desktop services bind to `127.0.0.1`. The Docker edition listens inside its container on `0.0.0.0`, while Compose publishes only to host loopback by default. LAN/proxy access must be explicitly configured with `ROOT_PUBLIC_ORIGIN`; this is an origin check, not authentication. Use a trusted private network/VPN or an authenticated HTTPS reverse proxy. Do not expose ROOT directly to the internet. See [Docker deployment and save isolation](docs/docker.md).

Saves, backups, custom names, browser view state and logs can contain private information. Do not attach real save exports, `.env` files, credentials or unredacted logs to public issues. Reproduce defects with a fresh, synthetic save whenever possible.

For a potential vulnerability, use a private advisory on the repository host if available, or contact a maintainer through that host's private reporting mechanism. Do not publish credentials or an exploitable private installation in a public issue. There is no separate support mailbox or hosted service.
