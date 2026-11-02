# Docker edition

ROOT's browser edition runs in a Linux container on x86-64 (`linux/amd64`) or ARM64 (`linux/arm64`). Windows users can use Docker Desktop in Linux-container mode. No Node.js installation is required on the host. The browser renders the full web UI and 3D bunker; the container needs no GPU.

## Start

Save [compose.yaml](../compose.yaml) in a dedicated directory, then run there:

```sh
docker compose pull
docker compose up -d --no-build --wait
```

Open [http://127.0.0.1:18473](http://127.0.0.1:18473). `docker compose ps` shows readiness; `docker compose logs root` shows startup errors. Keep that directory/project name when upgrading: Compose uses it to identify your existing save volume.

The image is `ghcr.io/tricade/root-network-os:latest`. Set `ROOT_IMAGE_TAG=1.7.0` in a `.env` file to pin this release instead. Version tags omit the leading `v` used by Git tags. There is no updater inside the container.

To build from a checkout instead of downloading an image:

```sh
docker compose up -d --build --wait
```

## Save data and migration

The named `root-data` volume stores `/data/save.json` and the previous valid write `/data/save.backup.json`. Recreating or updating the container retains both files. **Do not use `docker compose down -v` unless you intend to delete progress.** Plain `docker compose down` retains the volume.

Use **Settings → Export** in an existing browser/desktop installation, then **Settings → Import** in the container's UI. Different browser origins have separate browser caches; the server's save volume is the durable source. Keep the export until you have confirmed the imported progress.

One container is one network/save, not a multiplayer server or an account service. Use one active session at a time; stale writers receive a conflict instead of overwriting newer progress. Separate instances require separate volumes, Compose project names and ports. Do not scale replicas against one save volume.

Simulation still runs in the browser. Returning catches up at most 12 hours; leaving Docker running does not create an unlimited background economy.

## Update and back up

First use **Save now**, then close active ROOT tabs. Make a consistent file backup before an update:

```sh
docker compose stop
docker compose cp root:/data ./root-backup
docker compose pull
docker compose up -d --no-build --wait
```

The backup directory contains private progress: keep it out of Git and public issues. The automatic previous-write backup is useful recovery data, not a substitute for an external backup. Save migrations can be forward-only, so a rollback may require the pre-update export/backup. You can import an exported `save.json` through Settings.

## Ports, LAN and reverse proxies

Copy [docker.env.example](../docker.env.example) to `.env`. Defaults publish only to the host's loopback address. Change `ROOT_HTTP_PORT` to choose another host port; the default allowed browser origin follows that port. Container port `18473` stays unchanged.

For a private LAN/NAS, for example:

```dotenv
ROOT_BIND_ADDRESS=0.0.0.0
ROOT_HTTP_PORT=18473
ROOT_PUBLIC_ORIGIN=http://192.168.1.50:18473
```

Replace the example address with the NAS address and open exactly that URL. `ROOT_PUBLIC_ORIGIN` must contain just scheme, hostname/IP and optional port, with no credentials, query, fragment or subpath. This setting permits that browser origin to save; it is **not authentication**. ROOT has no user accounts. Use a trusted private network/VPN, or an authenticated HTTPS reverse proxy; do not publish an unauthenticated instance to the internet.

For an HTTPS proxy, set `ROOT_PUBLIC_ORIGIN=https://root.example.com`. Preserve the browser's original `Host` and `Origin` headers and proxy the domain root to port 18473. ROOT does not trust `X-Forwarded-Host` to grant write access. A proxy on the host can use the loopback port; a proxy in another container should share a Docker network and reach `root:18473`. TLS and authentication belong to the proxy. A 403 on saving generally means the URL/Host does not match the configured origin.

The process runs as `node` (UID/GID 1000), with a read-only application filesystem, no Linux capabilities and no privilege escalation. The named volume is initialized writable for that user. For a bind mount instead, create a directory writable by UID/GID 1000; an unwritable data directory fails startup. Do not solve permissions by running the application as root.

## Contributor checks and sources

The runtime image requires no npm dependencies. `.dockerignore` and explicit copies exclude local saves, secrets, Git history, Electron and development tools. License notices and asset provenance remain in the image.

```sh
docker build -t root-network-os:docker-test .
node tools/docker/smoke.cjs root-network-os:docker-test
docker compose config --quiet
```

The smoke uses disposable, uniquely named resources. It tests every served runtime file, non-root/read-only execution, health, saving, stale revisions, foreign-origin rejection, a save upload during SIGTERM, container replacement and the previous-write backup. Normal `npm run check` covers origin validation and the existing browser/desktop service paths. CI builds and executes each architecture on a matching native runner; lint or image compilation alone is not a runtime pass.

Verified baseline: Node **24.22.1**, Docker Engine **29.9.2**, Compose **5.6.1**, Buildx **0.38.1**. The official `node:24.22.1-bookworm-slim` multi-platform index is pinned by SHA-256 in the Dockerfile; Dependabot monitors it. Before changing versions, check the matching official sources:

- [Node 24.22.1 HTTP shutdown semantics](https://github.com/nodejs/node/blob/v24.22.1/doc/api/http.md#serverclosecallback): active requests drain before exit; the CLI allows 20 seconds, Compose 25 seconds.
- [Official Node image source](https://github.com/nodejs/docker-node/tree/80f02a542da739e6a662451d1db66456a0dea253/24/bookworm-slim) and [Docker 29 release notes](https://docs.docker.com/engine/release-notes/29/).
- [Compose 5.6.1](https://github.com/docker/compose/tree/v5.6.1) and [Compose interpolation](https://docs.docker.com/reference/compose-file/interpolation/), including nested defaults for the published port.
- [Dockerfile USER, COPY and HEALTHCHECK](https://docs.docker.com/reference/dockerfile/) and [native GitHub runner architectures](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
- [GHCR publishing and anonymous pulls](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry). Release CI publishes with the repository token, never a stored personal registry password. The first package publication needs its visibility set to public in GitHub package settings; subsequent tags inherit it.

Release workflows test both architectures before creating the multi-platform version and `latest` tags. Branch/PR checks never push images. The release workflow calls publication directly; it does not rely on a second workflow being triggered by a release created with `GITHUB_TOKEN`.
