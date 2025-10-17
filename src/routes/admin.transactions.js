import express from "express";
import sequelize from "../db.js";
import { QueryTypes } from "sequelize";

const router = express.Router();

/** GET /api/admin/transactions */
router.get("/transactions", async (_req, res) => {
  try {
    const rows = await sequelize.query(
      `
      SELECT
        t.id,
        COALESCE(u.email, 'guest')              AS email,              -- normalized
        t.recipient_msisdn                      AS msisdn,             -- normalized
        t.recipient_amount                      AS amount_recipient,   -- normalized
        t.amount_usd,
        t.amount_crypto_btc,
        t.fee_total,
        t.currency,
        t.status,
        t.created_at
      FROM public.transactions t
      LEFT JOIN public.users u ON u.id = t.user_id
      ORDER BY t.created_at DESC
      LIMIT 500
      `,
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    console.error("🔥 /api/admin/transactions error:", err);
    res.status(500).json({ error: "Failed to load transactions", details: err.message });
  }
});

export default router;
