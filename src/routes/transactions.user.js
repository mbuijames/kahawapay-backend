// src/routes/transactions.user.js
import express from "express";
import sequelize from "../db.js";
import { QueryTypes } from "sequelize";
import requireAuth from "../middleware/requireAuth.js";
import { computeFromBtc, to2 } from "../helpers/transactions.js";

const router = express.Router();

/** Resolve supported currencies from ENV (fallback to KES/UGX/TZS) */
function getSupportedCurrencies() {
  const fromEnv = (process.env.SUPPORTED_CURRENCIES || "KES,UGX,TZS")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : ["KES", "UGX", "TZS"];
}

/** Tiny validation helper (no extra deps) */
function validateUserPayload(body) {
  const errors = [];

  // BTC amount
  const amount_crypto_btc = Number(body?.amount_crypto_btc);
  if (!Number.isFinite(amount_crypto_btc) || amount_crypto_btc <= 0) {
    errors.push("amount_crypto_btc must be a positive number");
  }

  // Currency
  const currency = String(body?.currency || "KES").toUpperCase();
  const allowed = getSupportedCurrencies();
  if (!allowed.includes(currency)) {
    errors.push(`currency must be one of: ${allowed.join(", ")}`);
  }

  // MSISDN: 12 digits
  const recipient_msisdn = String(body?.recipient_msisdn || "")
    .replace(/\D/g, "")
    .slice(0, 12);

  if (recipient_msisdn.length !== 12) {
    errors.push("recipient_msisdn must be exactly 12 digits");
  }

  if (errors.length) {
    const err = new Error(errors[0]);
    err.status = 400;
    throw err;
  }

  return { amount_crypto_btc, currency, recipient_msisdn };
}

/* =========================================================
 *                 PREVIEW (NO DB INSERT)
 * POST /api/transactions/preview
 * Auth required
 * Body: { amount_crypto_btc, currency?, recipient_msisdn }
 * Responds: { sender_email, amount_recipient, currency, recipient_msisdn, amount_usd, fee_total }
 * ========================================================= */
router.post("/preview", requireAuth, async (req, res) => {
  try {
    const raw = { ...(req.body || {}) };
    // Never accept client-sent IDs
    delete raw.user_id; delete raw.userid; delete raw.id; delete raw.admin_marked_paid_by;

    const { recipient_msisdn, amount_crypto_btc, currency } = validateUserPayload(raw);

    const { amount_usd, fee_total, recipient_amount } = await computeFromBtc({
      amount_crypto_btc,
      currency,
    });

    return res.json({
      sender_email: req.user.email,
      amount_recipient: to2(recipient_amount), // local currency amount
      currency,
      recipient_msisdn,
      amount_usd: to2(amount_usd),
      fee_total: to2(fee_total),
    });
  } catch (err) {
    console.error("🔥 user TX preview error:", err);
    return res.status(err.status || 500).json({
      error: "Failed to preview transaction",
      details: err.message,
    });
  }
});

/* =========================================================
 *                 CREATE (AFTER SUBMIT)
 * POST /api/transactions
 * Auth required
 * Body: { amount_crypto_btc, currency?, recipient_msisdn }
 * Responds: { id, status, recipient_msisdn, amount_recipient, currency, amount_usd, created_at }
 * ========================================================= */
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = Number(req.user.id);

    const raw = { ...(req.body || {}) };
    // Never accept client-sent IDs / admin flags
    delete raw.user_id; delete raw.userid; delete raw.id; delete raw.admin_marked_paid_by;

    const { recipient_msisdn, amount_crypto_btc, currency } = validateUserPayload(raw);

    // Compute settlement figures
    const { amount_usd, fee_total, recipient_amount } = await computeFromBtc({
      amount_crypto_btc,
      currency,
    });

    const sql = `
      INSERT INTO public.transactions
        (user_id, guest_identifier, recipient_msisdn, amount_usd, amount_crypto_btc,
         fee_total, recipient_amount, currency, status, created_at)
      VALUES
        (:user_id, NULL, :msisdn, :amount_usd, :amount_crypto, :fee_total, :recipient_amount, :currency, 'pending', NOW())
      RETURNING id, recipient_msisdn, recipient_amount, currency, status, created_at;
    `;
    const replacements = {
      user_id: userId,
      msisdn: String(recipient_msisdn),
      amount_usd: to2(amount_usd),
      amount_crypto: Number(amount_crypto_btc),
      fee_total: to2(fee_total),
      recipient_amount: to2(recipient_amount),
      currency: String(currency),
    };

    // NOTE: In pg via sequelize.query, INSERT returns rows in the 2nd item of the array in some configs.
    const rows = await sequelize.query(sql, { replacements, type: QueryTypes.INSERT });
    const row = Array.isArray(rows) ? (rows[0]?.[0] ?? rows[0]) : rows;

    return res.json({
      id: row.id,
      status: row.status,
      recipient_msisdn: row.recipient_msisdn,
      amount_recipient: row.recipient_amount,
      currency: row.currency,
      amount_usd: to2(amount_usd),
      created_at: row.created_at,
    });
  } catch (err) {
    console.error("🔥 user TX create error:", err);
    return res.status(500).json({ error: "Failed to create transaction", details: err.message });
  }
});

export default router;
