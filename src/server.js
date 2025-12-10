// src/server.js
const fs = require("fs");
const path = require("path");
const express = require("express");
const hbs = require("hbs"); // for HTML views/layouts

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- VIEW ENGINE + STATIC (WEB UI) ----------

// /src/views
const viewsPath = path.join(__dirname, "views");
// /src/public (will hold style.css)
const publicPath = path.join(__dirname, "public");

app.set("view engine", "html");
app.engine("html", hbs.__express);
app.set("views", viewsPath);

// static files -> /style.css etc.
app.use(express.static(publicPath));

// (optional) partials if you ever add /views/partials/*
const partialsPath = path.join(viewsPath, "partials");
if (fs.existsSync(partialsPath)) {
  hbs.registerPartials(partialsPath);
}

// ---------- DB PATH ----------
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

// ---------- WEB PAGES (for !help etc.) ----------

// Simple health check (Render uses this)
app.get("/", (req, res) => {
  res.send("ChatQuest API is running.");
});

// Main help / landing page (link this in !help)
app.get("/home", (req, res) => {
  res.render("home");
});

// Player profile page (uses /views/player.html)
app.get("/player/:user", (req, res) => {
  const userParam = (req.params.user || "").toLowerCase();
  const channel = "tradi3"; // for now your channel is baked in

  const db = loadDb();
  const p = getPlayer(db, channel, userParam);

  res.render("player", {
    player: p,
    next: xpForNextLevel(p.level),
    weapon: describeItemShort(p.equipped.weapon),
    trinket: describeItemShort(p.equipped.trinket)
  });
});

// Inventory page
app.get("/inventory/:user", (req, res) => {
  const userParam = (req.params.user || "").toLowerCase();
  const channel = "tradi3";

  const db = loadDb();
  const p = getPlayer(db, channel, userParam);

  res.render("inventory", {
    empty: p.inventory.length === 0,
    items: p.inventory,
    weapon: describeItemShort(p.equipped.weapon),
    trinket: describeItemShort(p.equipped.trinket)
  });
});

// Shop placeholder page (Season 2+)
app.get("/shop", (req, res) => {
  res.render("shop");
});

// Boss info placeholder
app.get("/boss", (req, res) => {
  res.render("boss");
});

// Make /help show the same page as /home
app.get("/help", (req, res) => {
  res.render("home");
});

// ---------- API ROUTES FOR FOSSABOT ----------

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
