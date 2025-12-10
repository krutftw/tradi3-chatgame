// src/commands/heal.js
module.exports = {
  name: "heal",

  handler(req, res, db, utils) {
    const user = (req.query.user || "").toLowerCase();
    const channel = (req.query.channel || "").toLowerCase();

    if (!user || !channel) {
      return res.send("Heal error: missing user or channel.");
    }

    const { getPlayer, healPlayer, canHeal, recordHealUse, saveDb } = utils;
    const player = getPlayer(db, channel, user);
    const now = Date.now();

    if (player.hp >= (player.maxHp || 100)) {
      return res.send(`${user}, you're already at full HP.`);
    }

    if (!canHeal(player)) {
      return res.send(`${user}, you've used all heals this shift. Try again later.`);
    }

    // Find a consumable in inventory
    const idx = player.inventory.findIndex((i) => i.type === "consumable");
    if (idx === -1) {
      return res.send(`${user}, no First Aid Kits in your inventory. Buy from the shop.`);
    }

    const item = player.inventory[idx];
    const healAmount = item.heal || 60;
    player.inventory.splice(idx, 1);

    const healed = healPlayer(player, healAmount);
    recordHealUse(player);
    saveDb(db);

    res.send(
      `${user} used ${item.name} and healed ${healed} HP. HP ${player.hp}/${player.maxHp || 100}.`
    );
  }
};
