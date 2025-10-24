// src/routes/transactions.guest.js
import express from "express";
import sequelize from "../db.js";
import { QueryTypes } from "sequelize";
import { computeFromBtc, to2 } from "../helpers/transactions.js";

const router = express.Router();

/* ===========================
   CONFIG / CONSTANTS
=========================== */
// One source of truth for the guest USD limit (defaults to 100 if unset)
const GUEST_TX_LIMIT_USD = Number(process.env.GUEST_TX_LIMIT_USD ?? 100);

/** Resolve supported currencies from ENV (fallback to KES/UGX/TZS) */
function getSupportedCurrencies() {
  const fromEnv = (process.env.SUPPORTED_CURRENCIES || "KES,UGX,TZS")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : ["KES", "UGX", "TZS"];
}

/* ===========================
   VALIDATION HELPERS
=========================== */
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

  // MSISDN: 12 digits exactly
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

/* ===========================
   DB HELPERS
=========================== */
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

  // Using SELECT for RETURNING rows
  const rows = await sequelize.query(sql, { type: QueryTypes.SELECT });
  const row = rows?.[0];
  if (!row?.id) throw new Error("Failed to create guest user (no ID returned)");
  return { id: row.id, email: row.email };
}

/* ===========================
   PREVIEW (NO DB INSERT)
   POST /api/transactions/guest/preview
=========================== */
router.post("/guest/preview", async (req, res) => {
  try {
    const { amount_crypto_btc, currency, recipient_msisdn } =
      validateGuestPayload(req.body || {});

    // Compute settlement figures from BTC
    const calc = await computeFromBtc({ amount_crypto_btc, currency });
    const { amount_usd, fee_total, recipient_amount } = calc || {};

    // Guard against missing/invalid rates producing NaN/0
    if (![amount_usd, fee_total, recipient_amount].every(Number.isFinite)) {
      return res.status(422).json({
        error: `Unable to compute preview. Exchange rates may be missing for ${currency}.`,
      });
    }

    // Enforce guest USD limit at preview time
    if (Number(amount_usd) > GUEST_TX_LIMIT_USD) {
      return res
        .status(403)
        .json({ error: `Guests cannot exceed $${GUEST_TX_LIMIT_USD}` });
    }

    // Return fields the frontend expects
    return res.json({
      sender_email: "guest-preview@kahawapay.com",
      amount_recipient: to2(recipient_amount), // frontend reads amount_recipient / recipient_amount
      currency,                                // e.g., "KES"
      recipient_msisdn,
      amount_usd: to2(amount_usd),
      fee_total: to2(fee_total),
    });
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({ error: "Failed to preview transaction", details: err.message });
  }
});

/* ===========================
   CREATE (AFTER SUBMIT)
   POST /api/transactions/guest
=========================== */
router.post("/guest", async (req, res) => {
  try {
    // Never accept client-sent IDs or admin flags
    const raw = { ...(req.body || {}) };
    delete raw.user_id;
    delete raw.userid;
    delete raw.id;
    delete raw.admin_marked_paid_by;

    const { recipient_msisdn, amount_crypto_btc, currency } =
      validateGuestPayload(raw);

    // Create the guest user only on create
    const { id: guestUserId, email: guestEmail } =
      await createSequentialGuestUser();

    // Compute values to store
    const calc = await computeFromBtc({ amount_crypto_btc, currency });
    const { amount_usd, fee_total, recipient_amount } = calc || {};

    if (![amount_usd, fee_total, recipient_amount].every(Number.isFinite)) {
      return res.status(422).json({
        error: `Unable to compute transaction. Exchange rates may be missing for ${currency}.`,
      });
    }

    // Enforce limit again on create
    if (Number(amount_usd) > GUEST_TX_LIMIT_USD) {
      return res.status(403).json({
        error: `Guests cannot complete transactions above $${GUEST_TX_LIMIT_USD}. Please login.`,
      });
    }

    // Insert into DB (pending)
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

    // Use SELECT to read rows from RETURNING
    const rows = await sequelize.query(insertSql, {
      bind,
      type: QueryTypes.SELECT,
    });
    const tx = rows?.[0];

    // Respond with fields the UI can use
    return res.json({
      sender_email: guestEmail,
      amount_recipient: to2(recipient_amount), // local currency amount (string like "1234.56")
      currency: tx.currency,
      recipient_msisdn: tx.recipient_msisdn,
      amount_usd: to2(amount_usd),
      status: tx.status,
      id: tx.id,
    });
  } catch (err) {
    console.error("🔥 Guest TX error:", err);
    return res
      .status(err.status || 500)
      .json({ error: "Failed to create guest transaction", details: err.message });
  }
});

export default router;
