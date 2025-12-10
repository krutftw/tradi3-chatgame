// src/commands/top.js
module.exports = {
  name: "top",

  handler(req, res, db, utils) {
    const channel = (req.query.channel || "").toLowerCase();
    if (!channel) return res.send("ChatQuest error: missing channel.");

    const players = Object.values(db.players).filter(
      (p) => p.channel === channel
    );

    if (!players.length) {
      return res.send("No one has clocked on at this worksite yet.");
    }

    players.sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return b.totalXp - a.totalXp;
    });

    const limit = 5;
    const lines = players.slice(0, limit).map((p, i) => {
      return `#${i + 1} ${p.user} – LVL ${p.level}, pay: ${p.coins}`;
    });

    res.send(`Top workers on this site → ${lines.join(" | ")}`);
  }
};
