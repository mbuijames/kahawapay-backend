// src/routes/transactions.user.js
import express from "express";
import sequelize from "../db.js";
import { QueryTypes } from "sequelize";
import requireAuth from "../middleware/requireAuth.js";
import { computeFromBtc, to2 } from "../helpers/transactions.js"; // use your existing helpers

const router = express.Router();

/**
 * POST /api/transactions
 * Auth required. Creates a "normal user" transaction (no guest).
 * Body: { amount_crypto_btc, currency, recipient_msisdn }
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id; // comes from JWT
    const { amount_crypto_btc, currency = "KES", recipient_msisdn } = req.body || {};

    if (!amount_crypto_btc || !recipient_msisdn) {
      return res.status(400).json({ error: "amount_crypto_btc and recipient_msisdn are required" });
    }

    // IMPORTANT: No guest cap here. This is a registered user.
    const calc = await computeFromBtc({ amount_crypto_btc: Number(amount_crypto_btc), currency });
    const {
      fee_total,
      recipient_amount: recipient_amount_final,
      amount_usd: amount_usd_to_store,
    } = calc;

    const sql = `
      INSERT INTO public.transactions
        (user_id, guest_identifier, recipient_msisdn, amount_usd, amount_crypto_btc,
         fee_total, recipient_amount, currency, status, created_at)
      VALUES
        (:user_id, NULL, :msisdn, :amount_usd, :amount_crypto, :fee_total, :recipient_amount, :currency, 'pending', NOW())
      RETURNING *;
    `;
    const replacements = {
      user_id: userId,
      msisdn: String(recipient_msisdn),
      amount_usd: to2(amount_usd_to_store),
      amount_crypto: Number(amount_crypto_btc),
      fee_total: to2(fee_total),
      recipient_amount: to2(recipient_amount_final),
      currency: String(currency),
    };

    const [rows] = await sequelize.query(sql, { replacements, type: QueryTypes.INSERT });
    const row = Array.isArray(rows) ? rows[0] : rows;
    return res.json(row);
  } catch (err) {
    console.error("🔥 user TX error:", err);
    return res.status(500).json({ error: "Failed to create transaction", details: err.message });
  }
});

export default router;
