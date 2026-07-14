## Fully self-hosted on your TrueNAS — no Lovable Cloud

Everything runs on your NAS as Docker containers. Lovable is only used to build and iterate on the code; you deploy the built app to TrueNAS yourself.

```text
TrueNAS (Docker / Apps)
├── chunkflix-web       Node container running the built TanStack Start app (SSR + API)
├── chunkflix-db        Postgres 16 (library, users, progress)
├── chunkflix-media     nginx serving /movies/*.m3u8 and *.ts over HTTPS
└── caddy (or Cloudflare Tunnel)   TLS + public hostname for you + friends
        │
        └── https://flix.yourdomain.tld  →  chunkflix-web
            https://media.yourdomain.tld →  chunkflix-media (signed URLs only)
```

Media files live on your existing ZFS dataset (`/mnt/tank/media/hls/...`), bind-mounted read-only into `chunkflix-media`. Nothing leaves your NAS.

## Playback (the "chunks" part) — unchanged

Movies are pre-segmented once with `ffmpeg` into HLS: `master.m3u8` + per-bitrate `index.m3u8` + `seg*****.ts` (~6s each). The browser uses `hls.js` to fetch segments one by one and auto-switch quality (ABR). No live transcoding, so your Xeon E5-2620 v2 only works during prep, never during playback.

```
/mnt/tank/media/hls/inception-2010/
  master.m3u8
  1080p/index.m3u8, seg00001.ts ...
  720p/...  480p/...
  subs/en.vtt, subs/sv.vtt
  poster.jpg, backdrop.jpg, movie.json
```

## What Lovable builds

A TanStack Start app (SSR + server functions + server routes) with:

**Auth (self-hosted, no third party)**
- Email + password using [Lucia](https://lucia-auth.com/) or a small custom implementation over Postgres. Argon2 hashes, HTTP-only session cookies, CSRF-safe server actions.
- Invite codes (you generate one, friend redeems → account created). No open signup.
- Roles: `admin` (you), `viewer` (friends). Enforced in server functions.

**Library + metadata**
- Postgres tables: `users`, `sessions`, `invites`, `movies`, `movie_subtitles`, `watch_progress`.
- TMDB API for posters/overviews/cast (you paste a free API key as a secret).
- Admin "Add movie" flow: pick a folder from the media root → app reads `movie.json` written by the prep script → TMDB search → save.
- Optional "Rescan library" job that walks `/movies/hls/` for new folders.

**Player**
- `hls.js` player with quality menu, subtitle picker, keyboard shortcuts, fullscreen, PiP, resume-from-last-position.
- Progress synced every ~10s via a server function → Postgres.

**Streaming access control**
- Web app issues short-lived signed URLs (HMAC + expiry) for each movie's `master.m3u8`.
- Small nginx `auth_request` sub-handler (or a Caddy plugin snippet) validates the signature before serving `.m3u8` / `.ts`. Friends can watch, but URLs can't be shared beyond ~4h.

**Admin UI**
- User & invite management, library CRUD, rescan trigger, per-movie edit (title override, hidden flag).

## The prep script (runs on TrueNAS, not in the app)

Single Bash script `prep-movie.sh`:
```
prep-movie.sh "/mnt/tank/media/raw/Inception (2010).mkv"
```
- Probes the source with `ffprobe`.
- Runs `ffmpeg` producing 480p/720p/1080p HLS renditions + `master.m3u8`.
- Extracts embedded subtitle tracks to WebVTT.
- Writes `movie.json` (duration, tracks, source hash, tmdb hint from filename).
- Outputs into `/mnt/tank/media/hls/<slug>/`.

You can run it ad-hoc or wire it to a "watch folder" via a simple systemd path unit later.

## Deployment shape (what you actually do to ship)

1. `docker compose up -d` on TrueNAS with a `docker-compose.yml` we provide:
   - `chunkflix-web` (built from this Lovable repo)
   - `postgres:16`
   - `nginx` for media
   - `caddy` for TLS (or Cloudflare Tunnel if you prefer no open ports)
2. Point `flix.yourdomain.tld` at your NAS (via Cloudflare Tunnel — no port-forwarding needed).
3. First-boot wizard creates your admin account and stores config in Postgres.
4. To update: `git pull && docker compose build web && docker compose up -d web`.

The Lovable preview inside the editor uses a small SQLite fallback so you can develop without a live Postgres — the production build always uses Postgres.

## Feature scope for v1

Included: library grid, search, filters, movie detail, HLS player with quality + subs, resume, continue-watching, recently-added, invite-based signup, admin CRUD, self-hosted auth, signed media URLs, prep script, docker-compose bundle, README with TrueNAS setup steps.

Not in v1 (say the word to add): TV shows, live TV, downloads/offline, on-the-fly transcoding, mobile/TV native apps, Chromecast.

## Technical notes

- **Runtime target:** Node 20 container, not Cloudflare Workers — so we can freely use `node:crypto`, `node:fs`, native Postgres driver, and long-lived connections.
- **Vite config:** switch SSR target to `node` for the production build; keep the Lovable preview working.
- **DB access:** `postgres` (Porsager) or `drizzle-orm` + `pg`. Migrations checked into the repo, applied on container start.
- **Auth:** Lucia v3 with Postgres adapter, Argon2 password hashing, session cookies (`SameSite=Lax`, `Secure`, `HttpOnly`).
- **Signed URLs:** HMAC-SHA256 over `path|expiry|user_id`; nginx `auth_request` calls back to `/api/public/verify-stream` on the web container, which is stateless.
- **Env / secrets:** `.env` on the NAS holds `DATABASE_URL`, `SESSION_SECRET`, `MEDIA_SIGNING_SECRET`, `TMDB_API_KEY`, `MEDIA_BASE_URL`. No Lovable secret store.
- **SEO:** private app → `noindex` everywhere.

## What I need from you before building

1. **TMDB API key** (free at themoviedb.org). Paste it when I prompt.
2. **Public hostname plan:** Cloudflare Tunnel (recommended, no port-forwarding), or your own reverse proxy on an open port?
3. **Design direction:** dark cinematic (Plex/Jellyfin vibe) I pick myself, or want me to generate 2-3 directions to choose from?

Answer those and I'll switch to build mode and start on phase 1 (repo scaffolding + Node/Postgres runtime + auth).