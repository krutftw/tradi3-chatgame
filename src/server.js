// src/server.js
const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Path to DB file (../data/players.json from src/)
const DB_PATH = path.join(__dirname, "..", "data", "players.json");

// ---------- ITEM / GEAR POOL (WORKSITE THEME) ----------
const ITEM_POOL = [
  // COMMON – basic tools & PPE
  { name: "Chipped Trowel",           type: "weapon",  rarity: "common",    minPower: 1, maxPower: 3 },
  { name: "Bent Screed Bar",          type: "weapon",  rarity: "common",    minPower: 1, maxPower: 4 },
  { name: "Cracked Spirit Level",     type: "trinket", rarity: "common",    minPower: 1, maxPower: 2 },
  { name: "Dusty Hi-Vis Vest",        type: "trinket", rarity: "common",    minPower: 1, maxPower: 3 },
  { name: "Scuffed Steel Caps",       type: "trinket", rarity: "common",    minPower: 1, maxPower: 3 },

  // RARE – decent tradie gear
  { name: "Magnesium Bull Float",     type: "weapon",  rarity: "rare",      minPower: 3, maxPower: 7 },
  { name: "Laser Line Level",         type: "trinket", rarity: "rare",      minPower: 2, maxPower: 5 },
  { name: "Carbon Screed Rail",       type: "weapon",  rarity: "rare",      minPower: 4, maxPower: 8 },
  { name: "Reo Bender",               type: "weapon",  rarity: "rare",      minPower: 3, maxPower: 7 },
  { name: "Vented Hard Hat",          type: "trinket", rarity: "rare",      minPower: 3, maxPower: 6 },

  // EPIC – big dog contractor gear
  { name: "Diamond Tip Trowel",       type: "weapon",  rarity: "epic",      minPower: 6, maxPower: 11 },
  { name: "Site Foreman Radio",       type: "trinket", rarity: "epic",      minPower: 4, maxPower: 8 },
  { name: "Heavy-Duty Demo Hammer",   type: "weapon",  rarity: "epic",      minPower: 7, maxPower: 12 },
  { name: "Reinforced Knee Pads",     type: "trinket", rarity: "epic",      minPower: 5, maxPower: 9 },

  // LEGENDARY – meme-tier god gear
  { name: "Mythic Wheelbarrow",       type: "weapon",  rarity: "legendary", minPower: 10, maxPower: 16 },
  { name: "King of Concrete Gloves",  type: "trinket", rarity: "legendary", minPower: 9, maxPower: 15 },
  { name: "Phantom Screed Machine",   type: "weapon",  rarity: "legendary", minPower: 11, maxPower: 18 },
  { name: "Aurora Floodlight Rig",    type: "trinket", rarity: "legendary", minPower: 9, maxPower: 15 }
];

// ---------- DB HELPERS ----------
function ensureDbShape(rawDb) {
  let db = rawDb;
  if (!db || typeof db !== "object") db = {};
  if (!db.players && !db.bosses) {
    // legacy: flat map of players
    db = { players: db, bosses: {} };
  }
  if (!db.players) db.players = {};
  if (!db.bosses) db.bosses = {};
  return db;
}

function loadDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify({ players: {}, bosses: {} }, null, 2),
      "utf8"
    );
  }

  const raw = fs.readFileSync(DB_PATH, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw || "{}");
  } catch {
    parsed = {};
  }
  return ensureDbShape(parsed);
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function xpForNextLevel(level) {
  return 20 + level * 15;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollRarity() {
  const r = Math.random() * 100;
  if (r < 70) return "common";
  if (r < 93) return "rare";
  if (r < 99) return "epic";
  return "legendary";
}

function rollItem() {
  const rarity = rollRarity();
  const options = ITEM_POOL.filter(i => i.rarity === rarity);
  if (!options.length) return null;
  const base = options[randInt(0, options.length - 1)];
  const power = randInt(base.minPower, base.maxPower);
  return {
    id: Date.now().toString() + "-" + randInt(1000, 9999),
    name: base.name,
    type: base.type,
    rarity,
    power
  };
}

// Player & boss helpers
function getPlayer(db, channel, user) {
  const key = `${channel}:${user}`;
  if (!db.players[key]) {
    db.players[key] = {
      user,
      channel,
      level: 1,
      xp: 0,
      coins: 0,
      totalXp: 0,
      totalCoins: 0,
      lastQuest: 0,
      lastDaily: 0,
      lastBoss: 0,
      gambles: 0,
      wins: 0,
      losses: 0,
      inventory: [],
      equipped: { weapon: null, trinket: null }
    };
  } else {
    const p = db.players[key];
    if (!p.inventory) p.inventory = [];
    if (!p.equipped) p.equipped = { weapon: null, trinket: null };
    if (typeof p.totalXp !== "number") p.totalXp = p.xp || 0;
    if (typeof p.totalCoins !== "number") p.totalCoins = p.coins || 0;
    if (typeof p.gambles !== "number") p.gambles = 0;
    if (typeof p.wins !== "number") p.wins = 0;
    if (typeof p.losses !== "number") p.losses = 0;
  }
  return db.players[key];
}

function getChannelBoss(db, channel) {
  const key = channel.toLowerCase();
  if (!db.bosses[key]) {
    db.bosses[key] = {
      channel,
      active: false,
      name: "",
      hp: 0,
      maxHp: 0,
      rewardCoins: 0,
      rewardXp: 0,
      lastSpawn: 0
    };
  }
  return db.bosses[key];
}

function describeItemShort(item) {
  if (!item) return "none";
  return `${item.name} (${item.rarity}, +${item.power})`;
}

// Shared utils passed into every command
const utils = {
  loadDb,
  saveDb,
  xpForNextLevel,
  randInt,
  rollItem,
  getPlayer,
  getChannelBoss,
  describeItemShort
};

// ---------- COMMAND MODULES ----------
const questCmd     = require("./commands/quest");
const statsCmd     = require("./commands/stats");
const topCmd       = require("./commands/top");
const dailyCmd     = require("./commands/daily");
const gambleCmd    = require("./commands/gamble");
const inventoryCmd = require("./commands/inventory");
const bossCmd      = require("./commands/boss");

// ---------- ROUTES ----------

// Health check
app.get("/", (req, res) => {
  res.send("ChatQuest API is running.");
});

// Main quest
app.get("/api/chatquest", (req, res) => {
  const db = loadDb();
  questCmd.handler(req, res, db, utils);
});

// Stats
app.get("/api/stats", (req, res) => {
  const db = loadDb();
  statsCmd.handler(req, res, db, utils);
});

// Top players
app.get("/api/top", (req, res) => {
  const db = loadDb();
  topCmd.handler(req, res, db, utils);
});

// Daily reward
app.get("/api/daily", (req, res) => {
  const db = loadDb();
  dailyCmd.handler(req, res, db, utils);
});

// Gamble
app.get("/api/gamble", (req, res) => {
  const db = loadDb();
  gambleCmd.handler(req, res, db, utils);
});

// Inventory
app.get("/api/inventory", (req, res) => {
  const db = loadDb();
  inventoryCmd.handler(req, res, db, utils);
});

// Boss fight
app.get("/api/boss", (req, res) => {
  const db = loadDb();
  bossCmd.handler(req, res, db, utils);
});

// ---------- START ----------
app.listen(PORT, () => {
  console.log(`ChatQuest API listening on port ${PORT}`);
});

// Simple help / docs page (linked from !help)
app.get("/help", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Tradi3 ChatQuest - Help</title>
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #050816;
            color: #f5f5f5;
            padding: 24px;
            line-height: 1.5;
          }
          h1, h2 {
            color: #ffdd55;
          }
          code {
            background: rgba(255,255,255,0.06);
            padding: 2px 5px;
            border-radius: 4px;
          }
          .cmd {
            margin-bottom: 10px;
          }
          .cmd-name {
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <h1>Tradi3 ChatQuest - Help</h1>
        <p>Welcome to the Worksite, rookie! This mini-RPG runs in Tradi3's Twitch chat using Fossabot.</p>

        <h2>Basic Commands</h2>

        <div class="cmd">
          <span class="cmd-name"><code>!quest</code></span> – Go on a quick quest, earn XP & coins, and sometimes find gear.
        </div>

        <div class="cmd">
          <span class="cmd-name"><code>!stats</code></span> – Shows your level, XP, coins, and equipped gear.
        </div>

        <div class="cmd">
          <span class="cmd-name"><code>!daily</code></span> – Once per day bonus XP & coins.
        </div>

        <div class="cmd">
          <span class="cmd-name"><code>!inv</code></span> – Shows your inventory and what you have equipped.
        </div>

        <div class="cmd">
          <span class="cmd-name"><code>!top</code></span> – Top players in this channel.
        </div>

        <div class="cmd">
          <span class="cmd-name"><code>!boss</code></span> – Spawns/attacks a shared channel boss for big XP & coins.
        </div>

        <div class="cmd">
          <span class="cmd-name"><code>!gamble [amount]</code></span> – Gamble some coins (max 200) for a 50/50 shot at doubling.
        </div>

        <h2>Season 1 – Worksite Theme</h2>
        <p>
          The whole game is themed around the worksite and concrete grind:
          quests are quick jobs, bosses are site hazards, and items are tools / gear.
        </p>

        <p>
          More systems are planned:
          shop, item selling, HP & damage, healing, and seasonal content.
        </p>

        <p>Questions or ideas? Drop them in chat or the Discord channel.</p>
      </body>
    </html>
  `);
});
