// src/commands/rest.js
module.exports = {
  name: "rest",

  handler(req, res, db, utils) {
    const user = (req.query.user || "").toLowerCase();
    const channel = (req.query.channel || "").toLowerCase();

    if (!user || !channel) {
      return res.send("Rest error: missing user or channel.");
    }

    const { getPlayer, saveDb } = utils;
    const player = getPlayer(db, channel, user);
    const now = Date.now();

    if (!player.deathUntil || player.deathUntil <= now) {
      return res.send(`${user}, you're not down. Keep working.`);
    }

    const cost = 80;
    if (player.coins < cost) {
      return res.send(`${user}, resting costs ${cost} coins. Pay: ${player.coins}.`);
    }

    player.coins -= cost;
    // Shorten lock to 2 hours from now
    player.deathUntil = now + 2 * 60 * 60 * 1000;
    if (player.hp <= 0) player.hp = Math.min(player.maxHp || 100, 30);

    saveDb(db);
    res.send(
      `${user} pays ${cost} coins to rest. Back in 2h (HP ${player.hp}/${player.maxHp || 100}).`
    );
  }
};
