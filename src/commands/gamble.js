// src/commands/gamble.js
module.exports = {
  name: "gamble",

  handler(req, res, db, utils) {
    const user = (req.query.user || "").toLowerCase();
    const channel = (req.query.channel || "").toLowerCase();

    if (!user || !channel) {
      return res.send("ChatQuest error: missing user or channel.");
    }

    const { getPlayer, saveDb } = utils;
    const player = getPlayer(db, channel, user);

    let amount = parseInt(req.query.amount || "10", 10);
    if (isNaN(amount) || amount <= 0) amount = 10;
    if (amount > 200) amount = 200;

    if (player.coins < amount) {
      return res.send(
        `${user}, you don't have enough site pay to throw ${amount} coins on a smoko bet. (Pay: ${player.coins})`
      );
    }

    player.gambles += 1;
    player.coins -= amount;

    if (Math.random() < 0.5) {
      player.losses += 1;
      saveDb(db);
      return res.send(
        `${user} tosses ${amount} coins on a smoko bet and loses. Back to the wheelbarrow. (Pay left: ${player.coins})`
      );
    } else {
      const win = amount * 2;
      player.wins += 1;
      player.coins += win;
      player.totalCoins += amount; // net profit
      saveDb(db);
      return res.send(
        `${user} wins the smoko bet and pockets ${win} coins! (Pay: ${player.coins}, W:${player.wins}/L:${player.losses})`
      );
    }
  }
};
