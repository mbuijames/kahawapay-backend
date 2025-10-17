// src/routes/wallet.js
import express from "express";
import dotenv from "dotenv";
import sequelize from "../db.js";
import { QueryTypes } from "sequelize";
import requireAuth from "../middleware/requireAuth.js";

dotenv.config();
const router = express.Router();

/**
 * GET /api/wallet/deposit-address
 * Public: returns the BTC deposit address from .env
 */
router.get("/deposit-address", (req, res) => {
  const address = process.env.BITCOIN_APP_ADDRESS || "";
  if (!address) {
    // Helps diagnose env loading issues
    return res.status(500).json({ error: "BITCOIN_APP_ADDRESS not set" });
  }
  return res.json({ address });
});

/**
 * GET /api/wallet/mine
 * Auth-required: returns current user's own transactions
 * (No dependency on users.is_guest — filters by user_id only.)
 */
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Transactions that belong to the logged-in user
    const rows = await sequelize.query(
      `
      SELECT
        t.id,
        t.user_id,
        t.recipient_msisdn,
        t.amount_usd,
        t.recipient_amount,
        t.currency,
        t.status,
        t.created_at
      FROM public.transactions t
      WHERE t.user_id = :uid
      ORDER BY t.created_at DESC
      `,
      { replacements: { uid: userId }, type: QueryTypes.SELECT }
    );

    return res.json(rows);
  } catch (e) {
    console.error("wallet/mine error:", e);
    return res
      .status(500)
      .json({ error: "Failed to load wallet", details: e.message });
  }
});

export default router;
