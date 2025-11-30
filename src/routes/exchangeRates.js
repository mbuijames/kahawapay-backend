// kahawapay-backend/src/routes/exchangeRates.js
import express from "express";
import sequelize from "../db.js";
import { QueryTypes } from "sequelize";
import requireAuth from "../middleware/requireAuth.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = express.Router();

/* ------------------------------------------------------------------ */
/* Body-parser fallback (harmless if express.json() already ran)      */
/* ------------------------------------------------------------------ */
router.use((req, _res, next) => {
  if (req.body && Object.keys(req.body).length) return next();
  let buf = "";
  req.on("data", (c) => (buf += c));
  req.on("end", () => {
    if (buf && typeof req.body === "undefined") {
      try {
        req.body = JSON.parse(buf);
      } catch {
        /* ignore parse errors */
      }
    }
    next();
  });
});

/* ------------------------- Helpers / Normalizers ------------------------- */
const toNumber = (v) => {
  if (v === null || v === undefined) return NaN;
  const cleaned = String(v).replace(/[,\s_]/g, "").trim(); // "107,000" -> "107000"
  return cleaned ? Number(cleaned) : NaN;
};

const normalizeRow = (r) => ({
  target: (r.target_currency || "").toUpperCase(),
  value: Number(r.rate),
  base_currency: (r.base_currency || "USD").toUpperCase(),
  target_currency: (r.target_currency || "").toUpperCase(),
  rate: Number(r.rate),
  updated_at: r.updated_at,
});

// make the GET public (no auth) and no-cache
router.get("/", async (_req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT base_currency, target_currency, rate, updated_at
       FROM public.exchange_rates
       ORDER BY target_currency ASC`,
      { type: QueryTypes.SELECT }
    );
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.json(rows.map(normalizeRow));
  } catch (e) {
    console.error("exchange-rates GET / error:", e);
    res.status(500).json({ error: "Failed to load exchange rates" });
  }
});

// (Optional) add an alias that’s also public:
router.get("/public", async (_req, res) => {
  // same body as above
  try {
    const rows = await sequelize.query(
      `SELECT base_currency, target_currency, rate, updated_at
       FROM public.exchange_rates
       ORDER BY target_currency ASC`,
      { type: QueryTypes.SELECT }
    );
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.json(rows.map(normalizeRow));
  } catch (e) {
    console.error("exchange-rates GET /public error:", e);
    res.status(500).json({ error: "Failed to load exchange rates" });
  }
});

/* ---------------------------- WRITE (PROTECTED) -------------------------- */
/**
 * Shared save handler (transactional UPDATE → INSERT).
 * Accepts { target_currency, rate } or { target, value } (+ optional base/base_currency).
 */
const handleSave = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const b = req.body || {};

    // accept both shapes + aliases
    const base_currency = String(b.base_currency ?? b.base ?? "USD").toUpperCase().trim() || "USD";
    const target_currency = String(
      b.target_currency ?? b.targetCurrency ?? b.target ?? b.pair ?? b.symbol ?? b.code ?? ""
    )
      .toUpperCase()
      .trim();
    const rateNum = toNumber(b.rate ?? b.value ?? b.price ?? b.amount);

    // validate
    const errors = [];
    if (!target_currency) errors.push("Missing target (e.g., 'KES' or 'BTCUSD').");
    else if (!/^[A-Z0-9:_-]{3,32}$/.test(target_currency)) errors.push("Invalid target format.");
    if (!/^[A-Z0-9:_-]{3,32}$/.test(base_currency)) errors.push("Invalid base currency format.");
    if (!Number.isFinite(rateNum)) errors.push("Invalid rate/value (must be a number).");
    else if (rateNum <= 0) errors.push("Rate must be > 0.");
    if (errors.length) {
      await t.rollback();
      return res.status(400).json({ error: "Invalid payload", details: errors });
    }

    // 1) Try UPDATE first (by target_currency)
    const updated = await sequelize.query(
      `
      UPDATE public.exchange_rates
         SET rate = :rate,
             base_currency = :base,
             updated_at = NOW()
       WHERE target_currency = :cur
       RETURNING id, base_currency, target_currency, rate, updated_at
      `,
      {
        replacements: { base: base_currency, cur: target_currency, rate: rateNum },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    let row = updated[0];

    // 2) If nothing to update, INSERT (avoids unique conflicts entirely)
    if (!row) {
      const inserted = await sequelize.query(
        `
        INSERT INTO public.exchange_rates (base_currency, target_currency, rate, updated_at)
        VALUES (:base, :cur, :rate, NOW())
        RETURNING id, base_currency, target_currency, rate, updated_at
        `,
        {
          replacements: { base: base_currency, cur: target_currency, rate: rateNum },
          type: QueryTypes.SELECT,
          transaction: t,
        }
      );
      row = inserted[0];
    }

    await t.commit();
    return res.json(normalizeRow(row));
  } catch (e) {
    await t.rollback();
    const og = e?.original || {};
    console.error("exchange-rates save error:", {
      message: e.message,
      code: og.code,
      detail: og.detail,
      constraint: og.constraint,
      sql: og.sql,
    });
    return res.status(500).json({ error: "Failed to save exchange rate" });
  }
};

/**
 * POST /api/settings/exchange-rates/v3  (preferred)
 * Protected by requireAuth + requireAdmin
 */
router.post("/v3", requireAuth, requireAdmin, handleSave);

/**
 * POST /api/settings/exchange-rates  (legacy path)
 * Protected; uses same handler for compatibility.
 */
router.post("/", requireAuth, requireAdmin, handleSave);

export default router;
