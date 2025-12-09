// src/server.js
const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Path to DB file (../data/players.json from src/)
const DB_PATH = path.join(__dirname, "..", "data", "players.json");

// ---------- ITEM POOL (Season 1) ----------
const ITEM_POOL = [
  // ===== COMMON =====
  { name: "Cracked Wooden Sword", type: "weapon",  rarity: "common",    minPower: 1, maxPower: 3 },
  { name: "Rusty Dagger",         type: "weapon",  rarity: "common",    minPower: 1, maxPower: 3 },
  { name: "Scuffed Keyboard",     type: "weapon",  rarity: "common",    minPower: 1, maxPower: 4 },
  { name: "Laggy Mouse",          type: "weapon",  rarity: "common",    minPower: 1, maxPower: 3 },
  { name: "Streamer Hoodie",      type: "trinket", rarity: "common",    minPower: 1, maxPower: 2 },
  { name: "Frayed Headset",       type: "trinket", rarity: "common",    minPower: 1, maxPower: 2 },
  { name: "Bent Spoon",           type: "trinket", rarity: "common",    minPower: 1, maxPower: 2 },

  // ===== RARE =====
  { name: "Neon Katana",          type: "weapon",  rarity: "rare",      minPower: 3, maxPower: 7 },
  { name: "Shadow Dagger",        type: "weapon",  rarity: "rare",      minPower: 4, maxPower: 7 },
  { name: "Mechanical Keyboard",  type: "weapon",  rarity: "rare",      minPower: 3, maxPower: 6 },
  { name: "Pro Gamer Headset",    type: "trinket", rarity: "rare",      minPower: 3, maxPower: 6 },
  { name: "Glitched Emote Charm", type: "trinket", rarity: "rare",      minPower: 2, maxPower: 5 },
  { name: "Stabilised Wi-Fi Router", type: "trinket", rarity: "rare",   minPower: 2, maxPower: 5 },

  // ===== EPIC =====
  { name: "Cyber Dragon Blade",   type: "weapon",  rarity: "epic",      minPower: 6, maxPower: 11 },
  { name: "Void Edge Greatsword", type: "weapon",  rarity: "epic",      minPower: 7, maxPower: 12 },
  { name: "Mod Crown",            type: "trinket", rarity: "epic",      minPower: 4, maxPower: 8 },
  { name: "Quantum Microphone",   type: "trinket", rarity: "epic",      minPower: 5, maxPower: 9 },
  { name: "Streamer Throne",      type: "trinket", rarity: "epic",      minPower: 5, maxPower: 9 },

  // ===== LEGENDARY =====
  { name: "Ancient TOS Scroll",   type: "trinket", rarity: "legendary", minPower: 8, maxPower: 14 },
  { name: "Voidstorm Mouse",      type: "weapon",  rarity: "legendary", minPower: 10, maxPower: 16 },
  { name: "Omega Ban Hammer",     type: "weapon",  rarity: "legendary", minPower: 11, maxPower: 18 },
  { name: "Partner Checkmark",    type: "trinket", rarity: "legendary", minPower: 9, maxPower: 15 },
  { name: "Eternal Sub Badge",    type: "trinket", rarity: "legendary", minPower: 9, maxPower: 15 }
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
