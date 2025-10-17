// src/routes/settings.js
import express from "express";
import sequelize from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { QueryTypes } from "sequelize";

const router = express.Router();

// -----------------------------
// GET all exchange rates
// -----------------------------
router.get("/exchange-rates", requireAdmin, async (req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT id, base_currency, target_currency, rate, updated_at
       FROM exchange_rates
       ORDER BY target_currency ASC`,
      { type: QueryTypes.SELECT }
    );

    // normalize to match frontend AdminPanel
    const normalized = rows.map((r) => ({
      id: r.id,
      base: r.base_currency || "USD",
      target: r.target_currency,
      rate: Number(r.rate),
      updated_at: r.updated_at,
    }));

    res.json(normalized);
  } catch (err) {
    console.error("🔥 Error fetching exchange rates:", err);
    res.status(500).json({ error: "Failed to fetch exchange rates" });
  }
});
router.get("/exchange-rates/currencies", (req, res) => {
  const list = (process.env.SUPPORTED_CURRENCIES || "KES,UGX,TZS")
    .split(",")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  res.json({ currencies: list.length ? list : ["KES", "UGX", "TZS"] });
});


// -----------------------------
// UPDATE or INSERT rate
// -----------------------------
router.post("/exchange-rates", requireAdmin, async (req, res) => {
  try {
    const { id, base, target, rate } = req.body;

    if (!target || !rate) {
      return res.status(400).json({ error: "Target currency and rate required" });
    }

    let row;
    if (id) {
      // update existing row
      const [updated] = await sequelize.query(
        `UPDATE exchange_rates
         SET rate = :rate, base_currency = :base, updated_at = NOW()
         WHERE id = :id
         RETURNING id, base_currency, target_currency, rate, updated_at`,
        {
          replacements: { id, base: base || "USD", rate, target },
          type: QueryTypes.UPDATE,
        }
      );
      row = updated[0];
    } else {
      // insert new row
      const [inserted] = await sequelize.query(
        `INSERT INTO exchange_rates (base_currency, target_currency, rate, updated_at)
         VALUES (:base, :target, :rate, NOW())
         RETURNING id, base_currency, target_currency, rate, updated_at`,
        {
          replacements: { base: base || "USD", target, rate },
          type: QueryTypes.INSERT,
        }
      );
      row = inserted[0];
    }

    res.json({
      id: row.id,
      base: row.base_currency,
      target: row.target_currency,
      rate: Number(row.rate),
      updated_at: row.updated_at,
    });
  } catch (err) {
    console.error("🔥 Error saving exchange rate:", err);
    res.status(500).json({ error: "Failed to save exchange rate" });
  }
});

export default router;
