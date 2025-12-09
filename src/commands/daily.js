// src/commands/daily.js
module.exports = {
  name: "daily",

  handler(req, res, db, utils) {
    const user = (req.query.user || "").toLowerCase();
    const channel = (req.query.channel || "").toLowerCase();

    if (!user || !channel) {
      return res.send("ChatQuest error: missing user or channel.");
    }

    const { getPlayer, xpForNextLevel, randInt, saveDb } = utils;
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
  }
};
