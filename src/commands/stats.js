// src/commands/stats.js
module.exports = {
  name: "stats",

  handler(req, res, db, utils) {
    const user = (req.query.user || "").toLowerCase();
    const channel = (req.query.channel || "").toLowerCase();

    if (!user || !channel) {
      return res.send("ChatQuest error: missing user or channel.");
    }

    const { getPlayer, xpForNextLevel } = utils;
    const player = getPlayer(db, channel, user);

    const weapon = utils.describeItemShort(player.equipped.weapon);
    const trinket = utils.describeItemShort(player.equipped.trinket);
    const hpText = `HP: ${player.hp || 0}/${player.maxHp || 100}`;
    let deathLock = "";
    if (player.deathUntil && player.deathUntil > Date.now()) {
      const remainingMs = player.deathUntil - Date.now();
      const hrs = Math.floor(remainingMs / (60 * 60 * 1000));
      const mins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      deathLock = ` · DOWN for ${hrs}h ${mins}m`;
    }

    const msg =
      `${user} – Site LVL ${player.level} (XP: ${player.xp}/${xpForNextLevel(player.level)}). ` +
      `Pay: ${player.coins} coins (Total earned: ${player.totalCoins}). ` +
      `Total XP poured: ${player.totalXp}. ${hpText}${deathLock}. ` +
      `Gear → Main tool: ${weapon} | Site perk: ${trinket}.`;

    res.send(msg);
  }
};
