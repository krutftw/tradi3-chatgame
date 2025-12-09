const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Simple JSON database
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

// MAIN endpoint – this is what Fossabot will call later
app.get("/api/chatquest", (req, res) => {
  const user = (req.query.user || "").toLowerCase();
  const channel = (req.query.channel || "").toLowerCase();

  if (!user || !channel) {
    return res.send("ChatQuest error: missing user or channel.");
  }

  const db = loadDb();
  const key = `${channel}:${user}`;

  if (!db[key]) {
    db[key] = {
      user,
      channel,
      level: 1,
      xp: 0,
      coins: 0,
      lastQuest: 0
    };
  }

  const player = db[key];

  const now = Date.now();
  const cooldownMs = 10 * 1000;

  if (now - player.lastQuest < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - (now - player.lastQuest)) / 1000);
    return res.send(
      `${user}, you are still recovering from your last quest. Try again in ${remaining}s.`
    );
  }

  player.lastQuest = now;

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

app.get("/", (req, res) => {
  res.send("ChatQuest API is running.");
});

app.listen(PORT, () => {
  console.log(`ChatQuest API listening on port ${PORT}`);
});
