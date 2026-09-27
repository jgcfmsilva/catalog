# Catalog

Personal tracker for movies, series and anime (planning / watching / watched).
Search a title, the API fetches metadata + cover (downloaded and stored locally), episodes/seasons or runtime.

| Service | Image | Role |
|---|---|---|
| `db`  | postgres:16-alpine | Data (volume `db-data`) |
| `api` | node:22-alpine | Express API, auth (JWT), TMDB + Jikan/AniList clients, cover storage (volume `covers`) |
| `web` | node:22-alpine | React (Vite) build served by a tiny Express server, proxies `/api` and `/covers` to `api` |

`api` and `web` run `npm install` + `npm update` on **every start** (node_modules live in named volumes,
source is bind-mounted), then start. `web` also rebuilds the UI on start.

## Run

    cp .env.example .env    # then edit
    docker compose up -d --build

UI: `http://<host>:8090`, ideally behind a reverse proxy. Port 8090 is published on IPv4 only; restricting it to
the proxy is left to the host firewall (e.g. a `DOCKER-USER` iptables rule).

## Config (`.env`)

- `TMDB_API_KEY` needed for movies + series (free at themoviedb.org/settings/api; v3 key or v4 token). Anime needs no key.
- `SEED_USERNAME` / `SEED_PASSWORD` the seeded user; re-applied on every API start (change here to change the password).
- `JWT_SECRET`, `POSTGRES_PASSWORD` generated secrets.
- `WEB_PORT` host port (default 8090).

## UI

- The library always opens on the **Watching** tab after signing in (the last visited tab is not remembered).
  Change the default in `web/src/Library.jsx` (`useState('watching')`).
- The type filter defaults to **Series / Anime** (then Movies, Everything); sort is **Recent** (default) or **A–Z**.
  Neither is remembered between sessions.
- The "+" button (top right) opens a pop-up to search TMDB/Jikan/AniList and add a title (pick a result, choose Planning/Watching/Completed, Confirm or Back). The small field in the filter row filters what is already in your library.
- Each card has a trash icon to remove a title (with confirmation); the title pop-up also has Remove. There is no rating.
- All UI transitions use `--t` (0.5s) in `web/src/styles.css`.
- Installable as an app: `web/public/manifest.webmanifest` + `icon-192.png`/`icon-512.png` (rendered from `favicon.svg`).
  Chrome/Edge on desktop only offer "Install" over HTTPS, so a plain-HTTP deployment only gets a shortcut.
- Multi-season anime are one card (e.g. Attack on Titan, 6 parts); "Refresh" recombines the parts.

## Notes

- Apply code changes: `docker compose restart api` / `web` (source is bind-mounted; web rebuilds on start).
- Get newer dependency versions: just restart the container.
- Data sources: TMDB (movies/series); anime: Jikan/MyAnimeList first, AniList as automatic fallback (Jikan returned 504 on 2026-09-19; 200 again on 2026-09-20). If a provider is down, search still returns the others and shows a warning.
- Cover images are served publicly under `/covers/` (needed for `<img>`); everything else needs login.
- Logs: json-file, 10 MB x 3.
- **Not backed up**: volumes `catalog_db-data` and `catalog_covers` live only on the host's root disk.
