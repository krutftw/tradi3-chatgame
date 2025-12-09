// src/commands/quest.js
module.exports = {
  name: "chatquest",

  handler(req, res, db, utils) {
    const user = (req.query.user || "").toLowerCase();
    const channel = (req.query.channel || "").toLowerCase();

    if (!user || !channel) {
      return res.send("ChatQuest error: missing user or channel.");
    }

    const {
      getPlayer,
      xpForNextLevel,
      randInt,
      rollItem,
      saveDb
    } = utils;

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

    // 20% item drop
    let itemText = "";
    if (Math.random() < 0.2) {
      const item = rollItem();
      if (item) {
        player.inventory.push(item);
        itemText = ` Found item: ${item.name} (${item.rarity}, +${item.power}).`;

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

    if (leveledUp) message += " 🎉 LEVEL UP!";
    if (itemText) message += itemText;

    saveDb(db);
    res.send(message);
  }
};
