// kahawapay-backend/src/routes/exchangeRates.js
import express from "express";
import sequelize from "../db.js";
import { QueryTypes } from "sequelize";
import requireAuth from "../middleware/requireAuth.js";
import requireAdmin from "../middleware/requireAdmin.js";
import { ExchangeRateUpsertSchema } from "../validation/schemas.js";
import { parseBody } from "../validation/parse.js";

const router = express.Router();

/**
 * GET /api/settings/exchange-rates
 * (Make this public if you want the Send page to load currencies without login)
 */
router.get("/", /* requireAuth */ async (_req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT target_currency, rate, updated_at
       FROM public.exchange_rates
       ORDER BY target_currency ASC`,
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (e) {
    console.error("exchange-rates GET error:", e);
    res.status(500).json({ error: "Failed to load exchange rates" });
  }
});

/**
 * POST /api/settings/exchange-rates
 * Body (either camel or snake accepted):
 *   { targetCurrency: "KES", rate: 129 }  OR  { target_currency: "KES", rate: 129 }
 * Auth: admin only
 */
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    // Accept both camel and snake, then validate with Zod
    const body = {
      targetCurrency: String(req.body?.targetCurrency ?? req.body?.target_currency ?? "").toUpperCase(),
      rate: Number(req.body?.rate),
    };

    const { targetCurrency, rate } = parseBody(ExchangeRateUpsertSchema, body);

    // Upsert with parameterized SQL
    const rows = await sequelize.query(
      `
      INSERT INTO public.exchange_rates (target_currency, rate, updated_at)
      VALUES (:cur, :rate, now())
      ON CONFLICT (target_currency)
      DO UPDATE SET rate = EXCLUDED.rate, updated_at = now()
      RETURNING target_currency, rate, updated_at
      `,
      { replacements: { cur: targetCurrency, rate }, type: QueryTypes.SELECT }
    );

    res.json(rows[0]);
  } catch (e) {
    const status = e.status || 500;
    const msg = e.status ? e.message : "Failed to save exchange rate";
    console.error("exchange-rates POST error:", e);
    res.status(status).json({ error: msg });
  }
});

export default router;
