// src/commands/boss.js
module.exports = {
  name: "boss",

  handler(req, res, db, utils) {
    const user = (req.query.user || "").toLowerCase();
    const channel = (req.query.channel || "").toLowerCase();

    if (!user || !channel) {
      return res.send("ChatQuest error: missing user or channel.");
    }

    const {
      getPlayer,
      getChannelBoss,
      xpForNextLevel,
      randInt,
      saveDb
    } = utils;

    const player = getPlayer(db, channel, user);
    const boss = getChannelBoss(db, channel);

    const now = Date.now();
    const cooldownMs = 10 * 1000;
    if (now - player.lastBoss < cooldownMs) {
      const remaining = Math.ceil(
        (cooldownMs - (now - player.lastBoss)) / 1000
      );
      return res.send(
        `${user}, you're catching your breath. You can tackle the site hazard again in ${remaining}s.`
      );
    }
    player.lastBoss = now;

    // Spawn new boss if none active
    if (!boss.active) {
      const channelPlayers = Object.values(db.players).filter(
        (p) => p.channel === channel
      );
      const highestLevel = channelPlayers.length
        ? Math.max(...channelPlayers.map((p) => p.level || 1))
        : player.level;

      const names = [
        "Concrete Collapse Gremlin",
        "Rain Delay Demon",
        "Micromanaging Site Boss",
        "Broken Mixer Beast",
        "Council Inspector From Hell",
        "Slip Hazard Hydra",
        "Jackhammer Wraith",
        "Steelcap Smasher",
        "Shaky Scaffold Sentinel",
        "Dust Storm Behemoth",
        "Curing Blanket Colossus",
        "Formwork Kraken"
      ];

      const name = names[randInt(0, names.length - 1)];
      const baseHp = Math.max(70, 70 + highestLevel * 8 + randInt(0, 12));
      const rewardCoins = 70 + highestLevel * 5 + randInt(0, 40);
      const rewardXp = 35 + highestLevel * 3 + randInt(0, 20);

      boss.name = name;
      boss.maxHp = baseHp;
      boss.hp = baseHp;
      boss.rewardCoins = rewardCoins;
      boss.rewardXp = rewardXp;
      boss.active = true;
      boss.lastSpawn = now;

      saveDb(db);
      return res.send(
        `A major site hazard appears: ${boss.name}! HP ${boss.hp}/${boss.maxHp}. Clear it for +${boss.rewardXp} XP, +${boss.rewardCoins} coins.`
      );
    }

    // Attack existing boss
    const weaponPower = player.equipped.weapon ? player.equipped.weapon.power : 0;
    const trinketPower = player.equipped.trinket ? player.equipped.trinket.power : 0;
    const dmg =
      randInt(8, 16) + player.level * 2 + weaponPower + Math.floor(trinketPower / 2);

    boss.hp -= dmg;
    if (boss.hp < 0) boss.hp = 0;

    let msg = `${user} hits ${boss.name} for ${dmg} damage. `;

    if (boss.hp <= 0) {
      const coins = boss.rewardCoins;
      const xp = boss.rewardXp;
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

      msg +=
        `${boss.name} is cleared from the worksite! ${user} gains +${xp} XP and +${coins} coins. ` +
        `LVL ${player.level} (XP: ${player.xp}/${xpForNextLevel(player.level)}).`;
      if (leveledUp) msg += " 🎉 LEVEL UP!";

      boss.active = false;
      boss.hp = 0;
    } else {
      msg +=
        `Hazard HP: ${boss.hp}/${boss.maxHp}. Reward on clear: +${boss.rewardXp} XP, +${boss.rewardCoins} coins.`;
    }

    saveDb(db);
    res.send(msg);
  }
};
