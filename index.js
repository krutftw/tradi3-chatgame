const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const DB_PATH = path.join(__dirname, "players.json");

// ---- DB helpers ----
function ensureDbShape(rawDb) {
  let db = rawDb;
  if (!db || typeof db !== "object") db = {};
  // Backwards compat: old file was just a flat map of players
  if (!db.players) {
    db = { players: db, bosses: {} };
  }
  if (!db.bosses) db.bosses = {};
  return db;
}

function loadDb() {
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
  } catch (e) {
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

// ---- Items / inventory ----
const ITEM_POOL = [
  { name: "Rusty Dagger", type: "weapon", rarity: "common", minPower: 1, maxPower: 3 },
  { name: "Scuffed Keyboard", type: "weapon", rarity: "common", minPower: 1, maxPower: 4 },
  { name: "Streamer Hoodie", type: "trinket", rarity: "common", minPower: 1, maxPower: 2 },

  { name: "Neon Katana", type: "weapon", rarity: "rare", minPower: 3, maxPower: 7 },
  { name: "Glitched Emote Charm", type: "trinket", rarity: "rare", minPower: 2, maxPower: 5 },

  { name: "Cyber Dragon Blade", type: "weapon", rarity: "epic", minPower: 6, maxPower: 11 },
  { name: "Mod Crown", type: "trinket", rarity: "epic", minPower: 4, maxPower: 8 },

  { name: "Ancient TOS Scroll", type: "trinket", rarity: "legendary", minPower: 8, maxPower: 14 },
  { name: "Voidstorm Mouse", type: "weapon", rarity: "legendary", minPower: 10, maxPower: 16 }
];

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

// ---- Player / boss helpers ----
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

// ---- ROUTES ----

// Main quest command
app.get("/api/chatquest", (req, res) => {
  const user = (req.query.user || "").toLowerCase();
  const channel = (req.query.channel || "").toLowerCase();

  if (!user || !channel) {
    return res.send("ChatQuest error: missing user or channel.");
  }

  const db = loadDb();
  const player = getPlayer(db, channel, user);

  const now = Date.now();
  const cooldownMs = 10 * 1000;
  if (now - player.lastQuest < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - (now - player.lastQuest)) / 1000);
    return res.send(
      `${user}, you are still recovering from your last quest. Try again in ${remaining}s.`
    );
  }
  player.lastQuest = now;

  const weaponPower = player.equipped.weapon ? player.equipped.weapon.power : 0;
  const trinketPower = player.equipped.trinket ? player.equipped.trinket.power : 0;
  const gearBonus = Math.floor((weaponPower + trinketPower) / 2);

  const baseXp = randInt(5, 15);
  const baseCoins = randInt(5, 25);
  const xpGain = baseXp + gearBonus;
  const coinGain = baseCoins + gearBonus;

  player.xp += xpGain;
  player.coins += coinGain;
  player.totalXp += xpGain;
  player.totalCoins += coinGain;

  let leveledUp = false;
  let needed = xpForNextLevel(player.level);
  while (player.xp >= needed) {
    player.xp -= needed;
    player.level += 1;
    leveledUp = true;
    needed = xpForNextLevel(player.level);
  }

  const scenarios = [
    "explores the neon ruins and finds hidden loot.",
    "defeats a rogue bot in the data-wastes.",
    "rescues a lost chatter from ad hell.",
    "hacks into a glitched server and steals some credits.",
    "dodges a DMCA laser and survives."
  ];
  const scenario = scenarios[randInt(0, scenarios.length - 1)];

  // Item drop chance
  let itemText = "";
  if (Math.random() < 0.2) {
    const item = rollItem();
    if (item) {
      player.inventory.push(item);
      itemText = ` Found item: ${item.name} (${item.rarity}, +${item.power}).`;
      // auto-equip if it's better weapon
      if (
        item.type === "weapon" &&
        (!player.equipped.weapon || item.power > player.equipped.weapon.power)
      ) {
        player.equipped.weapon = item;
        itemText += " Auto-equipped as weapon.";
      } else if (
        item.type === "trinket" &&
        (!player.equipped.trinket || item.power > player.equipped.trinket.power)
      ) {
        player.equipped.trinket = item;
        itemText += " Auto-equipped as trinket.";
      }
    }
  }

  let message =
    `${user} ${scenario} +${xpGain} XP, +${coinGain} coins. ` +
    `LVL ${player.level} (XP: ${player.xp}/${xpForNextLevel(player.level)}).`;

  if (leveledUp) {
    message += " 🎉 LEVEL UP!";
  }

  if (itemText) {
    message += itemText;
  }

  saveDb(db);
  res.send(message);
});

// Stats
app.get("/api/stats", (req, res) => {
  const user = (req.query.user || "").toLowerCase();
  const channel = (req.query.channel || "").toLowerCase();

  if (!user || !channel) {
    return res.send("ChatQuest error: missing user or channel.");
  }

  const db = loadDb();
  const player = getPlayer(db, channel, user);

  const weapon = describeItemShort(player.equipped.weapon);
  const trinket = describeItemShort(player.equipped.trinket);

  const msg =
    `${user} - LVL ${player.level} (XP: ${player.xp}/${xpForNextLevel(player.level)}), ` +
    `Coins: ${player.coins}. Total XP: ${player.totalXp}, Total coins: ${player.totalCoins}. ` +
    `Gear → Weapon: ${weapon} | Trinket: ${trinket}.`;
  res.send(msg);
});

// Top players in a channel
app.get("/api/top", (req, res) => {
  const channel = (req.query.channel || "").toLowerCase();
  if (!channel) return res.send("ChatQuest error: missing channel.");

  const db = loadDb();
  const players = Object.values(db.players).filter(p => p.channel === channel);

  if (!players.length) return res.send("No ChatQuest data for this channel yet.");

  players.sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level;
    return b.totalXp - a.totalXp;
  });

  const limit = 5;
  const lines = players.slice(0, limit).map((p, i) => {
    return `#${i + 1} ${p.user} - LVL ${p.level}, Coins: ${p.coins}`;
  });

  res.send(`Channel top players → ${lines.join(" | ")}`);
});

// Daily reward
app.get("/api/daily", (req, res) => {
  const user = (req.query.user || "").toLowerCase();
  const channel = (req.query.channel || "").toLowerCase();
  if (!user || !channel) {
    return res.send("ChatQuest error: missing user or channel.");
  }

  const db = loadDb();
  const player = getPlayer(db, channel, user);

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  if (now - player.lastDaily < oneDay) {
    const remainingMs = oneDay - (now - player.lastDaily);
    const hours = Math.floor(remainingMs / (60 * 60 * 1000));
    const mins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    return res.send(
      `${user}, you've already claimed your daily. Come back in ${hours}h ${mins}m.`
    );
  }

  player.lastDaily = now;
  const coins = randInt(40, 80);
  const xp = randInt(20, 40);

  player.coins += coins;
  player.xp += xp;
  player.totalCoins += coins;
  player.totalXp += xp;

  let leveledUp = false;
  let needed = xpForNextLevel(player.level);
  while (player.xp >= needed) {
    player.xp -= needed;
    player.level += 1;
    leveledUp = true;
    needed = xpForNextLevel(player.level);
  }

  let msg =
    `${user} claimed their daily reward: +${xp} XP, +${coins} coins. ` +
    `LVL ${player.level} (XP: ${player.xp}/${xpForNextLevel(player.level)}).`;
  if (leveledUp) msg += " 🎉 LEVEL UP!";

  saveDb(db);
  res.send(msg);
});

// Gamble
app.get("/api/gamble", (req, res) => {
  const user = (req.query.user || "").toLowerCase();
  const channel = (req.query.channel || "").toLowerCase();
  if (!user || !channel) {
    return res.send("ChatQuest error: missing user or channel.");
  }

  const db = loadDb();
  const player = getPlayer(db, channel, user);

  // Optional ?amount= param, default 10
  let amount = parseInt(req.query.amount || "10", 10);
  if (isNaN(amount) || amount <= 0) amount = 10;
  if (amount > 200) amount = 200;

  if (player.coins < amount) {
    return res.send(`${user}, you don't have enough coins to gamble ${amount}. (Coins: ${player.coins})`);
  }

  player.gambles += 1;
  player.coins -= amount;

  if (Math.random() < 0.5) {
    // lose
    player.losses += 1;
    saveDb(db);
    return res.send(`${user} gambles ${amount} coins and loses. RIP. (Coins left: ${player.coins})`);
  } else {
    // win 2x
    const win = amount * 2;
    player.wins += 1;
    player.coins += win;
    player.totalCoins += amount; // net profit is +amount
    saveDb(db);
    return res.send(
      `${user} gambles ${amount} coins and WINS ${win}! (Coins: ${player.coins}, W:${player.wins}/L:${player.losses})`
    );
  }
});

// Inventory
app.get("/api/inventory", (req, res) => {
  const user = (req.query.user || "").toLowerCase();
  const channel = (req.query.channel || "").toLowerCase();
  if (!user || !channel) {
    return res.send("ChatQuest error: missing user or channel.");
  }

  const db = loadDb();
  const player = getPlayer(db, channel, user);

  if (!player.inventory.length) {
    return res.send(`${user}, your inventory is empty.`);
  }

  const items = player.inventory.slice(0, 5).map((it, idx) => {
    return `[${idx + 1}] ${it.name} (${it.rarity}, +${it.power})`;
  });

  const weapon = describeItemShort(player.equipped.weapon);
  const trinket = describeItemShort(player.equipped.trinket);

  res.send(
    `${user}'s inventory → ${items.join(" | ")}. Equipped → Weapon: ${weapon} | Trinket: ${trinket}.`
  );
});

// Boss fight
app.get("/api/boss", (req, res) => {
  const user = (req.query.user || "").toLowerCase();
  const channel = (req.query.channel || "").toLowerCase();
  if (!user || !channel) {
    return res.send("ChatQuest error: missing user or channel.");
  }

  const db = loadDb();
  const player = getPlayer(db, channel, user);
  const boss = getChannelBoss(db, channel);

  const now = Date.now();
  const cooldownMs = 10 * 1000;
  if (now - player.lastBoss < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - (now - player.lastBoss)) / 1000);
    return res.send(
      `${user}, you are catching your breath. You can attack the boss again in ${remaining}s.`
    );
  }
  player.lastBoss = now;

  // Spawn if none
  if (!boss.active) {
    const names = [
      "DMCA Hydra",
      "Lag Demon",
      "Shadow Stream Sniper",
      "Cosmic Modbot",
      "Ad Break Titan"
    ];
    const name = names[randInt(0, names.length - 1)];
    const baseHp = 80 + player.level * 10;
    boss.name = name;
    boss.maxHp = baseHp;
    boss.hp = baseHp;
    boss.rewardCoins = randInt(80, 160);
    boss.rewardXp = randInt(40, 80);
    boss.active = true;
    boss.lastSpawn = now;

    saveDb(db);
    return res.send(
      `A wild ${boss.name} appears! HP ${boss.hp}/${boss.maxHp}. Type !boss to attack!`
    );
  }

  // Attack existing boss
  const weaponPower = player.equipped.weapon ? player.equipped.weapon.power : 0;
  const trinketPower = player.equipped.trinket ? player.equipped.trinket.power : 0;
  const dmg = randInt(8, 16) + player.level * 2 + weaponPower + Math.floor(trinketPower / 2);

  boss.hp -= dmg;
  if (boss.hp < 0) boss.hp = 0;

  let msg = `${user} hits ${boss.name} for ${dmg} damage. `;

  if (boss.hp <= 0) {
    // Kill
    const coins = boss.rewardCoins;
    const xp = boss.rewardXp;
    player.coins += coins;
    player.xp += xp;
    player.totalCoins += coins;
    player.totalXp += xp;

    let leveledUp = false;
    let needed = xpForNextLevel(player.level);
    while (player.xp >= needed) {
      player.xp -= needed;
      player.level += 1;
      leveledUp = true;
      needed = xpForNextLevel(player.level);
    }

    msg += `${boss.name} is defeated! ${user} gains +${xp} XP and +${coins} coins. ` +
      `LVL ${player.level} (XP: ${player.xp}/${xpForNextLevel(player.level)}).`;
    if (leveledUp) msg += " 🎉 LEVEL UP!";

    boss.active = false;
    boss.hp = 0;
  } else {
    msg += `Boss HP: ${boss.hp}/${boss.maxHp}. Reward on kill: +${boss.rewardXp} XP, +${boss.rewardCoins} coins.`;
  }

  saveDb(db);
  res.send(msg);
});

// Health check
app.get("/", (req, res) => {
  res.send("ChatQuest API is running.");
});

app.listen(PORT, () => {
  console.log(`ChatQuest API listening on port ${PORT}`);
});
