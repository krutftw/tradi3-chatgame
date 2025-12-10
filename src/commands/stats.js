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

    const msg =
      `${user} – Site LVL ${player.level} (XP: ${player.xp}/${xpForNextLevel(player.level)}). ` +
      `Pay: ${player.coins} coins (Total earned: ${player.totalCoins}). ` +
      `Total XP poured: ${player.totalXp}. Gear → Main tool: ${weapon} | Site perk: ${trinket}.`;

    res.send(msg);
  }
};
