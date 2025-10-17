// src/routes/guest.tx.simple.js
import express from "express";
import sequelize from "../db.js";
import { QueryTypes } from "sequelize";
import { computeFromUsd, computeFromLocalNet, to2 } from "../helpers/transactions.js";

const router = express.Router();

/** Minimal, reliable guest creator (uses RETURNING properly) */
async function createGuest() {
  const sql = `
    WITH next_num AS (
      SELECT COALESCE(MAX(CAST(SUBSTRING(email FROM 'guest-(\\d+)') AS INT)), 0) + 1 AS n
      FROM public.users
      WHERE email LIKE 'guest-%@kahawapay.com'
    )
    INSERT INTO public.users (email, password, role, is_guest, created_at)
    SELECT
      'guest-' || LPAD(n::text, 4, '0') || '@kahawapay.com',
      '',
      'guest',
      true,
      NOW()
    FROM next_num
    RETURNING id, email;
  `;
  const rows = await sequelize.query(sql, { type: QueryTypes.SELECT });
  const row = rows[0];
  if (!row || !row.id) throw new Error("Failed to create guest user");
  return row; // { id, email }
}

/**
 * POST /api/guest-tx
 * Body: { recipient_msisdn, amount_usd?, recipient_amount?, amount_crypto_btc, currency? }
 * Creates guest user + transaction (status 'pending').
 *
 * 👉 This endpoint is unique and isolated to avoid any collisions.
 */
router.post("/guest-tx", async (req, res) => {
  console.log("✅ HITTING: /api/guest-tx (minimal path)");

  try {
    let {
      recipient_msisdn,
      amount_usd,
      amount_crypto_btc,
      currency = "KES",
      recipient_amount,
    } = req.body || {};

    if (!recipient_msisdn || !amount_crypto_btc) {
      return res.status(400).json({ error: "recipient_msisdn and amount_crypto_btc are required" });
    }

    // Optional cap (keep as-is from your rules)
    if (amount_usd != null && Number(amount_usd) > 10000) {
      return res.status(403).json({ error: "Guests cannot complete transactions above $10,000. Please login." });
    }

    // 1) Guest
    const guest = await createGuest(); // { id, email }

    // 2) Compute figures (support either USD gross or local net)
    let calc;
    if (recipient_amount != null && recipient_amount !== "") {
      calc = await computeFromLocalNet({
        recipient_amount_net_local: Number(recipient_amount),
        currency,
      });
    } else if (amount_usd != null) {
      calc = await computeFromUsd({
        amount_usd: Number(amount_usd),
        currency,
      });
    } else {
      return res.status(400).json({ error: "Provide either amount_usd or recipient_amount" });
    }

    const {
      fee_total,
      recipient_amount: recipient_amount_final,
      amount_usd: amount_usd_to_store,
    } = calc;

    // 3) Insert TX — positional binds + explicit casts (MSISDN forced to TEXT)
    const insertSql = `
      INSERT INTO public.transactions
        (user_id, recipient_msisdn, amount_usd, amount_crypto_btc,
         fee_total, recipient_amount, currency, status, created_at)
      VALUES
        ($1::integer, $2::text, $3::numeric(12,2), $4::numeric(18,8),
         $5::numeric(12,2), $6::numeric(12,2), $7::varchar(10), 'pending', NOW())
      RETURNING *;
    `;

    const bind = [
      Number(guest.id),
      String(recipient_msisdn),      // 🔒 this + ::text ends the integer overflow
      to2(amount_usd_to_store),
      Number(amount_crypto_btc),
      to2(fee_total),
      to2(recipient_amount_final),
      String(currency),
    ];

    const rows = await sequelize.query(insertSql, { bind, type: QueryTypes.SELECT });
    const tx = rows[0];

    // Return normalized response with payer email
    return res.json({ ...tx, payer: guest.email });
  } catch (err) {
    console.error("🔥 /api/guest-tx error:", err);
    // Improve the error message if it’s that integer overflow
    if ((err.message || "").includes("out of range for type integer")) {
      return res.status(500).json({
        error: "Failed to create guest transaction",
        details: "MSISDN was coerced to integer elsewhere. This endpoint forces TEXT; ensure your request is hitting /api/guest-tx.",
      });
    }
    return res.status(500).json({ error: "Failed to create guest transaction", details: err.message });
  }
});

export default router;
