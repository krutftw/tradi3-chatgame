// src/commands/quest.js
module.exports = {
  name: "quest",

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
      describeItemShort,
      saveDb
    } = utils;

    const player = getPlayer(db, channel, user);
    const now = Date.now();

    const isFirstQuest =
      player.level === 1 &&
      player.totalXp === 0 &&
      player.totalCoins === 0 &&
      player.lastQuest === 0;

    // 10s cooldown so it doesn’t get absolutely spammed
    const cooldownMs = 10 * 1000;
    if (now - player.lastQuest < cooldownMs) {
      const remaining = Math.ceil(
        (cooldownMs - (now - player.lastQuest)) / 1000
      );
      return res.send(
        `${user}, you're still hosing down the last pour. Try again in ${remaining}s.`
      );
    }
    player.lastQuest = now;

    // Gear bonus from equipped items
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

    // Level up
    let leveledUp = false;
    let needed = xpForNextLevel(player.level);
    while (player.xp >= needed) {
      player.xp -= needed;
      player.level += 1;
      leveledUp = true;
      needed = xpForNextLevel(player.level);
    }

    // Worksite-themed scenarios
    const scenarios = [
      "pushes a loaded barrow of mud across the slab without spilling a drop.",
      "beats the rain and finishes the driveway just before the sky opens up.",
      "dodges a runaway wheelbarrow and saves the fresh pour.",
      "helps a rookie fix their formwork before the concrete truck rolls in.",
      "battles through a surprise site inspection and passes with flying colours.",
      "runs the trowel machine like a pro and leaves a glassy finish.",
      "throws in extra reo and future-proofs the slab for decades.",
      "keeps the worksite tidy and the boss off everyone’s back."
    ];
    const scenario = scenarios[randInt(0, scenarios.length - 1)];

    // Item drop chance
    let itemText = "";
    if (Math.random() < 0.2) {
      const item = rollItem();
      if (item) {
        player.inventory.push(item);
        itemText = ` Found gear: ${item.name} (${item.rarity}, +${item.power}).`;

        // Auto-equip if it’s an upgrade
        if (
          item.type === "weapon" &&
          (!player.equipped.weapon || item.power > player.equipped.weapon.power)
        ) {
          player.equipped.weapon = item;
          itemText += " Auto-equipped as main tool.";
        } else if (
          item.type === "trinket" &&
          (!player.equipped.trinket || item.power > player.equipped.trinket.power)
        ) {
          player.equipped.trinket = item;
          itemText += " Auto-equipped as site perk.";
        }
      }
    }

    let message = "";

    if (isFirstQuest) {
      message += `Welcome to the Worksite, rookie! ${user} clocks on for their first shift. `;
    }

    message +=
      `${user} ${scenario} +${xpGain} XP, +${coinGain} site pay. ` +
      `LVL ${player.level} (XP: ${player.xp}/${xpForNextLevel(player.level)}).`;

    if (leveledUp) {
      message += " 🎉 LEVEL UP!";
    }

    if (itemText) {
      message += itemText;
    }

    saveDb(db);
    res.send(message);
  }
};
