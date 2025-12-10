# Tradi3 ChatQuest

Mini RPG for Twitch chat (channel: `tradi3`). Fossabot calls HTTP endpoints on this Render-hosted Node app; short one-line responses flow back to chat. A web UI on the same service shows profile, inventory, and the Tool Depot shop to keep chat tidy.

## Run locally
```
npm install
npm start
```
The server listens on `PORT` (default 3000).

## Environment
- `PORT` (optional)
- `CHANNEL` (default `tradi3`)
- `SEASON` (default `1`, drives shop stock)
- Persistence: `data/players.json` (auto-creates) and `data/players.backup.json` (shadow backup).
- Twitch login (optional):
  - `TWITCH_CLIENT_ID`
  - `TWITCH_CLIENT_SECRET`
  - `TWITCH_REDIRECT_URI` (e.g. `https://yourapp.onrender.com/auth/twitch/callback`)
  - `COOKIE_SECRET` (any random string)
- Admin backup (optional): `ADMIN_TOKEN`

## Fossabot commands (Season 1)
- `!quest` → `$(urlfetch https://tradi3-chatgame.onrender.com/api/chatquest?user=$(user)&channel=$(channel))`
- `!boss` → `$(urlfetch https://tradi3-chatgame.onrender.com/api/boss?user=$(user)&channel=$(channel))`
- `!daily` → `$(urlfetch https://tradi3-chatgame.onrender.com/api/daily?user=$(user)&channel=$(channel))`
- `!gamble` → `$(urlfetch https://tradi3-chatgame.onrender.com/api/gamble?user=$(user)&channel=$(channel))`
- `!stats` → `$(urlfetch https://tradi3-chatgame.onrender.com/api/stats?user=$(user)&channel=$(channel))`
- `!top` → `$(urlfetch https://tradi3-chatgame.onrender.com/api/top?channel=$(channel))`
- `!inv` → `$(urlfetch https://tradi3-chatgame.onrender.com/api/inventory?user=$(user)&channel=$(channel))`
- `!shop` → `$(urlfetch https://tradi3-chatgame.onrender.com/api/shop?user=$(user)&channel=$(channel))` (returns the web shop link; if Twitch OAuth is configured, you can drop the `user` param)
- `!help` → `https://tradi3-chatgame.onrender.com/home`

## Web UI
- `/home` or `/help` — overview and commands.
- `/player/:user` — profile (XP, coins, equipped gear).
- `/inventory/:user` — inventory + equipped.
- `/boss` — boss status.
- `/shop` — Tool Depot (buy/sell). Uses Twitch login if configured; otherwise accepts `?user=` fallback.
- Season banner on `/home`; shop shows rarity visuals and profile snapshot.

## Shop and seasons
- Season-specific stock is defined in `src/server.js` (`SHOP_STOCKS` map keyed by `SEASON`).
- Buying auto-equips upgrades; selling refunds ~50% of value.

## Persistence and backups
- Main DB: `data/players.json`; shadow backup: `data/players.backup.json`.
- On load, if main is missing/corrupt, it auto-restores from backup.
- Admin backup endpoint: `/admin/backup` (requires channel owner login or `ADMIN_TOKEN`).
