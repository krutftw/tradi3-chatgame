const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Simple JSON "database"
const DB_PATH = path.join(__dirname, "players.json");

function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({}), "utf8");
  }
  const raw = fs.readFileSync(DB_PATH, "utf8");
  return JSON.parse(raw || "{}");
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

function playerKey(channel, user) {
  return `${channel}:${user}`;
}

function ensurePlayer(db, channel, user) {
  const key = playerKey(channel, user);
  if (!db[key]) {
    db[key] = {
      user,
      channel,
      level: 1,
      xp: 0,
      coins: 0,
      lastQuest: 0,
      lastDaily: 0,
      quests: 0,
      gamblesWon: 0,
      gamblesLost: 0
    };
  }
  return db[key];
}

/**
 * QUEST ENDPOINT
 * Called by Fossabot for !quest
 */
app.get("/api/chatquest", (req, res) => {
  const user = (req.query.user || "").toLowerCase();
  const channel = (req.query.channel || "").toLowerCase();

  if (!user || !channel) {
    return res.send("ChatQuest error: missing user or channel.");
  }

  const db = loadDb();
  const player = ensurePlayer(db, channel, user);

  const now = Date.now();
  const cooldownMs = 10 * 1000; // 10 seconds

  if (now - player.lastQuest < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - (now - player.lastQuest)) / 1000);
    return res.send(
      `${user}, you are still recovering from your last quest. Try again in ${remaining}s.`
    );
  }

  player.lastQuest = now;
  player.quests += 1;

  const xpGain = randInt(5, 15);
  const coinGain = randInt(5, 25);

  player.xp += xpGain;
  player.coins += coinGain;

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

  let message =
    `${user} ${scenario} +${xpGain} XP, +${coinGain} coins. ` +
    `LVL ${player.level} (XP: ${player.xp}/${xpForNextLevel(player.level)})`;

  if (leveledUp) {
    message += " 🎉 LEVEL UP!";
  }

  saveDb(db);
  res.send(message);
});

/**
 * STATS ENDPOINT
 * !stats – show profile
 */
app.get("/api/stats", (req, res) => {
  const user = (req.query.user || "").toLowerCase();
  const channel = (req.query.channel || "").toLowerCase();

  if (!user || !channel) {
    return res.send("ChatQuest error: missing user or channel.");
  }

  const db = loadDb();
  const player = ensurePlayer(db, channel, user);

  const msg =
    `${user}'s stats → ` +
    `LVL ${player.level} (XP: ${player.xp}/${xpForNextLevel(player.level)}), ` +
    `${player.coins} coins, ` +
    `${player.quests} quests, ` +
    `Gamble W/L: ${player.gamblesWon}/${player.gamblesLost}.`;

  res.send(msg);
});

/**
 * TOP ENDPOINT
 * !top – top 5 players in this channel
 */
app.get("/api/top", (req, res) => {
  const channel = (req.query.channel || "").toLowerCase();
  if (!channel) {
    return res.send("ChatQuest error: missing channel.");
  }

  const db = loadDb();
  const players = Object.values(db).filter(p => p.channel === channel);

  if (players.length === 0) {
    return res.send("No adventurers in this channel yet. Type !quest to start!");
  }

  players.sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level;
    if (b.xp !== a.xp) return b.xp - a.xp;
    return b.coins - a.coins;
  });

  const top = players.slice(0, 5);
  const parts = top.map((p, i) => {
    return `${i + 1}) ${p.user} (L${p.level}, ${p.xp}xp, ${p.coins}c)`;
  });

  const msg = `Top ChatQuest adventurers: ${parts.join(" | ")}`;
  res.send(msg);
});

/**
 * DAILY ENDPOINT
 * !daily – once every 24h big reward
 */
app.get("/api/daily", (req, res) => {
  const user = (req.query.user || "").toLowerCase();
  const channel = (req.query.channel || "").toLowerCase();

  if (!user || !channel) {
    return res.send("ChatQuest error: missing user or channel.");
  }

  const db = loadDb();
  const player = ensurePlayer(db, channel, user);

  const now = Date.now();
  const dailyMs = 24 * 60 * 60 * 1000; // 24 hours

  if (now - player.lastDaily < dailyMs) {
    const remainingMs = dailyMs - (now - player.lastDaily);
    const hours = Math.floor(remainingMs / (60 * 60 * 1000));
    const minutes = Math.floor(
      (remainingMs % (60 * 60 * 1000)) / (60 * 1000)
    );
    return res.send(
      `${user}, you've already claimed your daily reward. Try again in ${hours}h ${minutes}m.`
    );
  }

  player.lastDaily = now;

  const xpGain = randInt(20, 40);
  const coinGain = randInt(50, 120);

  player.xp += xpGain;
  player.coins += coinGain;

  let leveledUp = false;
  let needed = xpForNextLevel(player.level);

  while (player.xp >= needed) {
    player.xp -= needed;
    player.level += 1;
    leveledUp = true;
    needed = xpForNextLevel(player.level);
  }

  let msg =
    `${user} claims their daily reward: +${xpGain} XP, +${coinGain} coins. ` +
    `LVL ${player.level} (XP: ${player.xp}/${xpForNextLevel(player.level)})`;

  if (leveledUp) {
    msg += " 🎉 LEVEL UP!";
  }

  saveDb(db);
  res.send(msg);
});

/**
 * GAMBLE ENDPOINT
 * !gamble – risk a fixed 10 coins, 45% chance to double, 55% chance to lose
 */
app.get("/api/gamble", (req, res) => {
  const user = (req.query.user || "").toLowerCase();
  const channel = (req.query.channel || "").toLowerCase();

  if (!user || !channel) {
    return res.send("ChatQuest error: missing user or channel.");
  }

  const db = loadDb();
  const player = ensurePlayer(db, channel, user);

  const stake = 10;

  if (player.coins < stake) {
    return res.send(
      `${user}, you need at least ${stake} coins to gamble. You only have ${player.coins}.`
    );
  }

  const roll = Math.random(); // 0..1
  let msg;

  if (roll < 0.45) {
    // win
    const winAmount = stake;
    player.coins += winAmount;
    player.gamblesWon += 1;
    msg = `${user} rolls the dice and WINS! +${winAmount} coins (now ${player.coins}). W/L: ${player.gamblesWon}/${player.gamblesLost}`;
  } else {
    // lose
    player.coins -= stake;
    player.gamblesLost += 1;
    msg = `${user} rolls the dice and loses ${stake} coins... (now ${player.coins}). W/L: ${player.gamblesWon}/${player.gamblesLost}`;
  }

  saveDb(db);
  res.send(msg);
});

// Root
app.get("/", (req, res) => {
  res.send(
    "ChatQuest API is running. Endpoints: /api/chatquest, /api/stats, /api/top, /api/daily, /api/gamble"
  );
});

app.listen(PORT, () => {
  console.log(`ChatQuest API listening on port ${PORT}`);
});
