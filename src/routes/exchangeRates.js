// kahawapay-backend/src/routes/exchangeRates.js
import express from "express";
import sequelize from "../db.js";
import { QueryTypes } from "sequelize";
import requireAuth from "../middleware/requireAuth.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = express.Router();

/**
 * GET /api/settings/exchange-rates
 * Public (so the Send page can load without login).
 */
router.get("/", async (_req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT target_currency, rate, updated_at
         FROM public.exchange_rates
        ORDER BY target_currency ASC`,
      { type: QueryTypes.SELECT }
    );
    return res.json(rows);
  } catch (e) {
    console.error("exchange-rates GET error:", e);
    return res.status(500).json({ error: "Failed to load exchange rates" });
  }
});

/**
 * GET /api/settings/exchange-rates/currencies
 * Returns a simple array of currency codes for the dropdown.
 * Pulls from the table; if empty, falls back to SUPPORTED_CURRENCIES env.
 */
router.get("/currencies", async (_req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT DISTINCT target_currency
         FROM public.exchange_rates
        ORDER BY target_currency ASC`,
      { type: QueryTypes.SELECT }
    );

    let list = rows.map(r => r.target_currency);
    if (!list.length) {
      const envList = (process.env.SUPPORTED_CURRENCIES || "")
        .split(",")
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);
      list = envList.length ? envList : ["KES"]; // final fallback
    }
    return res.json({ currencies: list });
  } catch (e) {
    console.error("exchange-rates /currencies error:", e);
    return res.status(500).json({ error: "Failed to load currencies" });
  }
});

/**
 * POST /api/settings/exchange-rates
 * Body (accepts camelCase or snake_case):
 *   { targetCurrency: "KES", rate: 129 }
 *   or
 *   { target_currency: "KES", rate: 129 }
 * Auth: admin only.
 */
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    // Normalize both shapes
    const rawCur =
      (req.body?.target_currency ?? req.body?.targetCurrency ?? "")
        .toString()
        .trim()
        .toUpperCase();

    // Accept numbers or numeric strings
    const rawRate = req.body?.rate;
    const rateNum = Number(rawRate);

    // Validate
    const curOk = /^[A-Z]{3,10}$/.test(rawCur);
    const rateOk = Number.isFinite(rateNum) && rateNum > 0;

    if (!curOk || !rateOk) {
      return res.status(400).json({ error: "Target currency and rate required" });
    }

    // Ensure unique index exists (safe if already created)
    await sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS exchange_rates_target_currency_key
         ON public.exchange_rates (target_currency)`
    );

    // Upsert
    const rows = await sequelize.query(
      `
        INSERT INTO public.exchange_rates (target_currency, rate, updated_at)
        VALUES (:cur, :rate, now())
        ON CONFLICT (target_currency)
        DO UPDATE SET rate = EXCLUDED.rate, updated_at = now()
        RETURNING target_currency, rate, updated_at
      `,
      { replacements: { cur: rawCur, rate: rateNum }, type: QueryTypes.SELECT }
    );

    return res.json(rows[0]);
  } catch (e) {
    console.error("exchange-rates POST error:", e);
    return res.status(500).json({ error: "Failed to save exchange rate", details: e.message });
  }
});

export default router;
