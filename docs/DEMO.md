# Demo instance

A self-contained demo of the nanoclaw dashboard — **no nanoclaw host needed**.
The backend runs the **demo mock profile** (`NANOCLAW_MOCK_PROFILE=demo`): a
realistic multi-tier agent network an engineer would use, with coherent demo
message content. The UI is reachable **only** through a reverse proxy on the
external proxy Docker network; nothing is exposed on the host.

## What the demo shows

- **Multi-tier agent tree**: `orchestrator` root → `concierge` (human-facing,
  whatsapp channel), `route-planner` → [`route-optimizer`, `route-validator`],
  `coder` → [`reviewer`, `tester`], plus `architect`/`researcher`/`editor`/
  `terminal`/`plotter`.
- **Human node**: an engineer messages the concierge via whatsapp; the
  concierge routes the request to the orchestrator, which decomposes it across
  the specialist tiers. Human-channel events keep the Human node anchored
  above the concierge.
- **Live activity**: tool runs, agent-to-agent handoffs, delivery updates,
  approvals, and the occasional error — all synthetic, all generic.

## Prerequisites

- Docker + Docker Compose **v2.24 or newer** on the host (the override uses the
  `!override` YAML tag).
- An external Docker network for the reverse proxy (e.g. nginx-proxy / traefik /
  caddy). Its name is host-specific — set it as `NANOCLAW_PROXY_NETWORK` in the
  gitignored `.env` (see below). The reverse proxy routes a domain to the
  `frontend` container on port `80`.

## Deploy

1. **Clone the repo** into the demo folder on the host:

   ```sh
   git clone <repo-url> <demo-folder>
   cd <demo-folder>
   ```

2. **Create the gitignored `.env`** (host-specific values live here — never in
   the repo). At minimum:

   ```sh
   cp .env.example .env
   ```

   The demo override sets `NANOCLAW_MOCK_PROFILE=demo` and forces
   `NANOCLAW_ENABLED=false` itself, so the default `.env` works as-is — even
   one copied from a production host. Keep `VITE_BACKEND_WS_URL` and
   `VITE_BACKUP_TOKEN` blank (the override forces them empty at build time, so
   no production backup token can leak into the public demo bundle). Add the
   host-specific values here, including the reverse-proxy network name:

   ```sh
   NANOCLAW_PROXY_NETWORK=<your-proxy-network-name>
   ```

3. **Ensure the proxy network exists** (create it if your reverse proxy
   hasn't):

   ```sh
   docker network create <your-proxy-network-name>
   ```

4. **Start the stack**:

   ```sh
   docker compose -f docker-compose.yml -f docker-compose.demo.yml up --build -d
   ```

5. **Verify**:

   ```sh
   # Nothing published on the host — both services must show no host ports.
   docker compose -f docker-compose.yml -f docker-compose.demo.yml ps

   # The frontend is on the proxy network; the backend is internal-only.
   docker network inspect <your-proxy-network-name>   # frontend attached, backend absent
   ```

   Point the reverse proxy at `frontend:80` (e.g. `proxy_pass http://frontend;`
   in nginx, or the equivalent upstream in your proxy). The frontend nginx
   proxies `/ws/` and `/api/` to the backend internally, so the browser only
   ever talks to the frontend.

## Privacy

- The repo contains **no personal or host-specific information**. VPS address,
  folder path, and reverse-proxy network name are host values — they belong in
  the gitignored `.env` on the host (or the operator's private notes), never in
  the repository.
- All demo agent names and message content are generic roles and fictional
  engineering tasks.
- **The demo is unauthenticated** (same posture as the production dashboard —
  see `SECURITY.md`). It carries only synthetic data, but it is reachable
  through a public reverse proxy: never point it at real data, secrets, or a
  nanoclaw host.

## Teardown

```sh
docker compose -f docker-compose.yml -f docker-compose.demo.yml down
```