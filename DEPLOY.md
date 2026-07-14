# Deploying RhineTV on TrueNAS

Two moving parts:

1. **GitHub** builds a Docker image every time you push to `main`, and publishes it to GitHub Container Registry (GHCR) at `ghcr.io/<you>/rhinetv:latest`.
2. **TrueNAS** runs that image via `docker compose`, and **Watchtower** polls GHCR every 5 min — when a new `:latest` shows up, it pulls and restarts the container.

Result: after the initial setup, updating in production is just "make a change in Lovable → wait a few minutes."

---

## 1. Connect GitHub (one-time, in Lovable)

Plus (+) menu → **GitHub** → **Connect project** → create the repo. Lovable will push all future changes there automatically.

## 2. First push kicks off the build

The workflow at `.github/workflows/docker.yml` runs on every push to `main`. It builds `linux/amd64` + `linux/arm64` images and publishes them to:

```
ghcr.io/<your-github-user-or-org>/<repo-name>:latest
ghcr.io/<your-github-user-or-org>/<repo-name>:sha-<short>
```

You may need to open the package on GitHub once and mark it **public** (Package settings → Change visibility), otherwise Docker on TrueNAS needs credentials.

## 3. Install on TrueNAS

SSH into TrueNAS and pick a folder on your pool, e.g. `/mnt/tank/apps/rhinetv/`.

```bash
cd /mnt/tank/apps/rhinetv
curl -O https://raw.githubusercontent.com/<you>/<repo>/main/docker-compose.yml
# edit docker-compose.yml: replace `ghcr.io/CHANGE-ME/rhinetv` with your image
docker compose up -d
```

That's it. Visit `http://<truenas-ip>:3000`. Put Caddy / Cloudflare Tunnel in front of it when you're ready to share.

## 4. Updates

- Push to `main` in Lovable (or GitHub).
- GitHub Actions builds and pushes a fresh `:latest`.
- Watchtower notices within ~5 min, pulls the new image, restarts `rhinetv` with zero manual steps.

To roll back, pin a specific tag in `docker-compose.yml`:

```yaml
image: ghcr.io/<you>/rhinetv:sha-abc1234
```

then `docker compose up -d`.

## 5. Secrets (TMDB, Jellyseerr, etc.)

Don't commit them. Create `/mnt/tank/apps/rhinetv/.env`:

```
TMDB_API_KEY=...
JELLYSEERR_URL=http://jellyseerr:5055
JELLYSEERR_API_KEY=...
```

Then uncomment the `env_file:` block in `docker-compose.yml` and `docker compose up -d`.
