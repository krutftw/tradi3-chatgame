// src/commands/inventory.js
module.exports = {
  name: "inv",

  handler(req, res, db, utils) {
    const user = (req.query.user || "").toLowerCase();
    const channel = (req.query.channel || "").toLowerCase();

    if (!user || !channel) {
      return res.send("ChatQuest error: missing user or channel.");
    }

    const { getPlayer, describeItemShort } = utils;
    const player = getPlayer(db, channel, user);

    if (!player.inventory.length) {
      const weapon = describeItemShort(player.equipped.weapon);
      const trinket = describeItemShort(player.equipped.trinket);
      return res.send(
        `${user}, your toolbelt is empty. Equipped → Main tool: ${weapon} | Site perk: ${trinket}.`
      );
    }

    const items = player.inventory.slice(0, 5).map((it, idx) => {
      return `[${idx + 1}] ${it.name} (${it.rarity}, +${it.power})`;
    });

    const weapon = describeItemShort(player.equipped.weapon);
    const trinket = describeItemShort(player.equipped.trinket);

    res.send(
      `${user}'s toolbelt → ${items.join(" | ")}. Equipped → Main tool: ${weapon} | Site perk: ${trinket}.`
    );
  }
};
