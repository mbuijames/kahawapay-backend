// src/routes/transactions.status.js
import express from "express";
import sequelize from "../db.js";
import { QueryTypes } from "sequelize";

const router = express.Router();

/**
 * Utility: quick UUID v4-ish check (good enough to catch obvious mistakes
 * before we hit the DB's ::uuid cast).
 */
function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
}

/**
 * POST /api/transactions/guest/complete
 * Body: { tx_id, guest_key }
 *
 * Marks the transaction as "completed" by the user (guest).
 * - Idempotent: if already completed, it keeps the original timestamp.
 * - Does NOT change status from 'pending'; admin will later mark it 'paid'.
 */
router.post("/transactions/guest/complete", async (req, res) => {
  try {
    const { tx_id, guest_key } = req.body || {};

    if (!tx_id || !guest_key) {
      return res.status(400).json({ error: "tx_id and guest_key are required" });
    }
    if (!isUuid(guest_key)) {
      return res.status(400).json({ error: "guest_key must be a valid UUID" });
    }

    const sql = `
      UPDATE public.transactions
      SET user_marked_complete = TRUE,
          user_completed_at    = COALESCE(user_completed_at, NOW())
      WHERE id = $1::integer
        AND guest_key = $2::uuid
      RETURNING *;
    `;

    const rows = await sequelize.query(sql, {
      bind: [Number(tx_id), String(guest_key)],
      type: QueryTypes.SELECT,
    });

    const updated = rows?.[0];
    if (!updated) {
      return res
        .status(404)
        .json({ error: "Transaction not found or guest_key mismatch" });
    }

    return res.json(updated);
  } catch (err) {
    console.error("🔥 Guest complete TX error:", err);
    return res
      .status(500)
      .json({ error: "Failed to mark complete", details: err.message });
  }
});

/**
 * GET /api/transactions/guest/status?tx_id=...&guest_key=...
 *
 * Lets the guest check the current state of their transaction.
 * Returns a minimal, safe subset of fields.
 */
router.get("/transactions/guest/status", async (req, res) => {
  try {
    const tx_id = req.query.tx_id;
    const guest_key = req.query.guest_key;

    if (!tx_id || !guest_key) {
      return res.status(400).json({ error: "tx_id and guest_key are required" });
    }
    if (!isUuid(guest_key)) {
      return res.status(400).json({ error: "guest_key must be a valid UUID" });
    }

    const sql = `
      SELECT
        id,
        status,
        user_marked_complete,
        user_completed_at,
        paid_at,
        created_at
      FROM public.transactions
      WHERE id = $1::integer
        AND guest_key = $2::uuid
      LIMIT 1;
    `;

    const rows = await sequelize.query(sql, {
      bind: [Number(tx_id), String(guest_key)],
      type: QueryTypes.SELECT,
    });

    const tx = rows?.[0];
    if (!tx) {
      return res
        .status(404)
        .json({ error: "Transaction not found or guest_key mismatch" });
    }

    return res.json(tx);
  } catch (err) {
    console.error("🔥 Guest status TX error:", err);
    return res
      .status(500)
      .json({ error: "Failed to fetch status", details: err.message });
  }
});

export default router;
