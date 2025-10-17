// src/routes/transactions.guest.js
import express from "express";
import sequelize from "../db.js";
import { QueryTypes } from "sequelize";
import { computeFromBtc, to2 } from "../helpers/transactions.js";

const router = express.Router();

/** Resolve supported currencies from ENV (fallback to KES/UGX/TZS) */
function getSupportedCurrencies() {
  const fromEnv = (process.env.SUPPORTED_CURRENCIES || "KES,UGX,TZS")
    .split(",")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : ["KES", "UGX", "TZS"];
}

/** Tiny validation helper (no extra deps) */
function validateGuestPayload(body) {
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

/** Create a sequential guest like guest-00001@kahawapay.com (5 digits) */
async function createSequentialGuestUser() {
  const sql = `
    WITH next_num AS (
      SELECT COALESCE(
        MAX(CAST(SUBSTRING(email FROM 'guest-(\\d+)') AS INT)), 0
      ) + 1 AS n
      FROM public.users
      WHERE email LIKE 'guest-%@kahawapay.com'
    )
    INSERT INTO public.users (email, password, role, is_guest, created_at)
    SELECT
      'guest-' || LPAD(n::text, 5, '0') || '@kahawapay.com',
      '',
      'guest',
      true,
      NOW()
    FROM next_num
    RETURNING id, email;
  `;
  const rows = await sequelize.query(sql, { type: QueryTypes.SELECT });
  const row = rows[0];
  if (!row?.id) throw new Error("Failed to create guest user (no ID returned)");
  return { id: row.id, email: row.email };
}

/**
 * POST /api/transactions/guest
 * Body: { recipient_msisdn, amount_crypto_btc, currency? }
 * Computes USD/net from BTC (no user-entered USD/local).
 * Responds: { sender_email, amount, msisdn }
 */
router.post("/guest", async (req, res) => {
  try {
    // 0) Validate + normalize input (and never accept client-sent IDs)
    const raw = { ...(req.body || {}) };
    delete raw.user_id; delete raw.userid; delete raw.id; delete raw.admin_marked_paid_by;
    const { recipient_msisdn, amount_crypto_btc, currency } = validateGuestPayload(raw);

    // 1) Create guest user (sequential)
    const { id: guestUserId, email: guestEmail } = await createSequentialGuestUser();

    // 2) Compute from BTC only
    const { amount_usd, fee_total, recipient_amount } = await computeFromBtc({
      amount_crypto_btc,
      currency,
    });

    // 3) Guest USD limit
    if (Number(amount_usd) > 10000) {
      return res.status(403).json({
        error: "Guests cannot complete transactions above $10,000. Please login.",
      });
    }

    // 4) Insert transaction
    const insertSql = `
      INSERT INTO public.transactions
        (user_id, recipient_msisdn, amount_usd, amount_crypto_btc,
         fee_total, recipient_amount, currency, status, created_at)
      VALUES
        ($1::integer, $2::text, $3::numeric(12,2), $4::numeric(18,8),
         $5::numeric(12,2), $6::numeric(12,2), $7::varchar(10), 'pending', NOW())
      RETURNING id, recipient_msisdn, recipient_amount, currency, status, created_at;
    `;
    const bind = [
      Number(guestUserId),
      recipient_msisdn,
      to2(amount_usd),
      amount_crypto_btc,
      to2(fee_total),
      to2(recipient_amount),
      currency,
    ];
    const rows = await sequelize.query(insertSql, { bind, type: QueryTypes.SELECT });
    const tx = rows[0];

    // 5) Respond with the minimal fields you want to show on the UI
    return res.json({
      sender_email: guestEmail,
      amount: Number(tx.recipient_amount), // “Amt recipient to receive”
      msisdn: tx.recipient_msisdn,
    });
  } catch (err) {
    console.error("🔥 Guest TX error:", err);
    return res.status(err.status || 500).json({
      error: "Failed to create guest transaction",
      details: err.message,
    });
  }
});

export default router;
