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

  const amount_crypto_btc = Number(body?.amount_crypto_btc);
  if (!Number.isFinite(amount_crypto_btc) || amount_crypto_btc <= 0) {
    errors.push("amount_crypto_btc must be a positive number");
  }

  const currency = String(body?.currency || "KES").toUpperCase();
  const allowed = getSupportedCurrencies();
  if (!allowed.includes(currency)) {
    errors.push(`currency must be one of: ${allowed.join(", ")}`);
  }

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

/* ================= PREVIEW ================= */
router.post("/preview", requireAuth, async (req, res) => {
  try {
    const raw = { ...(req.body || {}) };
    delete raw.user_id;
    delete raw.userid;
    delete raw.id;
    delete raw.admin_marked_paid_by;

    const { recipient_msisdn, amount_crypto_btc, currency } =
      validateUserPayload(raw);

    const { amount_usd, fee_total, recipient_amount } = await computeFromBtc({
      amount_crypto_btc,
      currency,
    });

    return res.json({
      sender_email: req.user.email,
      amount_recipient: to2(recipient_amount),
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

/* ================= CREATE ================= */
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress;

    const raw = { ...(req.body || {}) };
    delete raw.user_id;
    delete raw.userid;
    delete raw.id;
    delete raw.admin_marked_paid_by;

    const { recipient_msisdn, amount_crypto_btc, currency } =
      validateUserPayload(raw);

    const { amount_usd, fee_total, recipient_amount } = await computeFromBtc({
      amount_crypto_btc,
      currency,
    });

    const sql = `
      INSERT INTO public.transactions
        (user_id, guest_identifier, recipient_msisdn, amount_usd, amount_crypto_btc,
         fee_total, recipient_amount, currency, status, client_ip, created_at)
      VALUES
        (:user_id, NULL, :msisdn, :amount_usd, :amount_crypto, :fee_total,
         :recipient_amount, :currency, 'pending', :client_ip, NOW())
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
      client_ip: clientIp,
    };

    const rows = await sequelize.query(sql, {
      replacements,
      type: QueryTypes.INSERT,
    });

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
    return res
      .status(500)
      .json({ error: "Failed to create transaction", details: err.message });
  }
});

export default router;
