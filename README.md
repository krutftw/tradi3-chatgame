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
- `!heal` → `$(urlfetch https://tradi3-chatgame.onrender.com/api/heal?user=$(user)&channel=$(channel))`
- `!rest` → `$(urlfetch https://tradi3-chatgame.onrender.com/api/rest?user=$(user)&channel=$(channel))`
- `!shop` → `$(urlfetch https://tradi3-chatgame.onrender.com/api/shop?user=$(user)&channel=$(channel))` (returns the web shop link; if Twitch OAuth is configured, you can drop the `user` param)
- `!help` → `https://tradi3-chatgame.onrender.com/home`

## Web UI
- `/home` or `/help` — overview and commands.
- `/player/:user` — profile (XP, coins, equipped gear).
- `/inventory/:user` — inventory + equipped.
- `/boss` — boss status.
- `/shop` — Tool Depot (buy/sell). Uses Twitch login if configured; otherwise accepts `?user=` fallback.
- Season banner on `/home`; shop shows rarity/type tags and profile snapshot.

### Season 1 (Dec 10, 2025) highlights
- Tool Depot live with buy/sell; Twitch login binds actions (trust-mode fallback if not configured).
- Added boss names, quest scenarios, and expanded item pool; legendaries stay ~1%.
- Backups and /admin/backup endpoint to keep progress safe; shop helper command to reduce chat spam.

## HP, death, healing
- Players have HP (default 100). If HP hits 0, you're down for 8h and can't quest/boss/daily.
- Quest damage: 25% chance; scales with level (4+lvl to 10+lvl). Boss counterattacks: 6+lvl to 12+lvl.
- Heals: Buy First Aid Kits in shop (carry max 3). Use `!heal` to consume a kit (3 uses per 8h; heals 60 HP; can revive you).
- Rest: `!rest` costs coins to shorten a death lock to 2h and bump you to 30 HP if you were at 0.

## Shop and seasons
- Season-specific stock is defined in `src/server.js` (`SHOP_STOCKS` map keyed by `SEASON`).
- Buying auto-equips upgrades; selling refunds ~50% of value.

## Persistence and backups
- Main DB: `data/players.json`; shadow backup: `data/players.backup.json`.
- On load, if main is missing/corrupt, it auto-restores from backup.
- Admin backup endpoint: `/admin/backup` (requires channel owner login or `ADMIN_TOKEN`).
