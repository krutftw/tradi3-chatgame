// src/commands/stats.js
module.exports = {
  name: "stats",

  handler(req, res, db, utils) {
    const user = (req.query.user || "").toLowerCase();
    const channel = (req.query.channel || "").toLowerCase();

    if (!user || !channel) {
      return res.send("ChatQuest error: missing user or channel.");
    }

    const { getPlayer, xpForNextLevel, describeItemShort } = utils;
    const player = getPlayer(db, channel, user);

    const weapon = describeItemShort(player.equipped.weapon);
    const trinket = describeItemShort(player.equipped.trinket);

    const msg =
      `${user} - LVL ${player.level} (XP: ${player.xp}/${xpForNextLevel(player.level)}), ` +
      `Coins: ${player.coins}. Total XP: ${player.totalXp}, Total coins: ${player.totalCoins}. ` +
      `Gamble: ${player.wins}W/${player.losses}L. ` +
      `Gear → Weapon: ${weapon} | Trinket: ${trinket}.`;

    res.send(msg);
  }
};
