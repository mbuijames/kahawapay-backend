// src/routes/transactions.admin.js
import express from "express";
import sequelize from "../db.js";
import { QueryTypes } from "sequelize";
import nodemailer from "nodemailer";

const router = express.Router();

// Email transporter (use your real SMTP credentials in env)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === "true", // true for 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * DEBUG: /api/transactions/_debug
 * Helps confirm the backend is reading the right DB/schema and that rows exist.
 */
router.get("/_debug", async (_req, res) => {
  try {
    const [info] = await sequelize.query(
      `SELECT current_database() AS db, current_schema() AS schema`,
      { type: QueryTypes.SELECT }
    );
    const [cnt] = await sequelize.query(
      `SELECT COUNT(*)::int AS total FROM public.transactions`,
      { type: QueryTypes.SELECT }
    );
    return res.json({ ...info, total_transactions: cnt.total });
  } catch (e) {
    return res.status(500).json({ error: "debug failed", details: e.message });
  }
});

/**
 * GET /api/transactions/all
 * Return field names the AdminPanel/TransactionsTable can display & filter:
 *   email, msisdn, amount_recipient, amount_usd, currency, status, created_at
 */
router.get("/all", async (_req, res) => {
  try {
    const rows = await sequelize.query(
      `
      SELECT
        t.id,
        COALESCE(u.email, 'guest')           AS email,              -- normalized
        t.recipient_msisdn                   AS msisdn,             -- normalized
        t.recipient_amount                   AS amount_recipient,   -- normalized
        t.amount_usd,
        t.amount_crypto_btc,
        t.fee_total,
        t.currency,
        LOWER(COALESCE(t.status, 'pending')) AS status,
        t.created_at
      FROM public.transactions t
      LEFT JOIN public.users u ON u.id = t.user_id
      ORDER BY t.created_at DESC
      LIMIT 500
      `,
      { type: QueryTypes.SELECT }
    );

    console.log(`📦 /api/transactions/all -> ${rows.length} rows`);
    return res.json(rows);
  } catch (err) {
    console.error("🔥 /api/transactions/all error:", err);
    return res.status(500).json({ error: "Failed to load transactions", details: err.message });
  }
});

/** Mark paid */
router.put("/:id/mark-paid", async (req, res) => {
  try {
    const id = Number(req.params.id);
    console.log("➡️ Marking transaction paid:", id);

    const updated = await sequelize.query(
      `
      UPDATE public.transactions
      SET status = 'paid', paid_at = NOW()
      WHERE id = :id
      RETURNING *;
      `,
      { replacements: { id }, type: QueryTypes.SELECT }
    );

    if (!updated.length) {
      console.log("❌ Transaction not found");
      return res.status(404).json({ error: "Transaction not found" });
    }

    const tx = updated[0];
    console.log("✅ Updated TX:", tx.id, "User ID:", tx.user_id);

    let userEmail = null;

    if (tx.user_id) {
      const [user] = await sequelize.query(
        `SELECT email FROM public.users WHERE id = :uid LIMIT 1;`,
        {
          replacements: { uid: tx.user_id },
          type: QueryTypes.SELECT
        }
      );

      console.log("👤 User record:", user);

      userEmail = user?.email || null;
    }

    if (userEmail) {
      console.log("📧 Sending email to:", userEmail);

      try {
        await transporter.sendMail({
          from: `"KahawaPay" <${process.env.EMAIL_USER}>`,
          to: userEmail,
          subject: "Transaction Successful – KahawaPay",
          html: `
            <h2>Transaction Successful ☕</h2>
            <p>Your transaction has been completed.</p>
            <p><strong>Amount Received:</strong> ${tx.recipient_amount} ${tx.currency}</p>
          `
        });

        console.log("✅ Email sent successfully");
      } catch (mailErr) {
        console.error("❌ Email send failed:", mailErr);
      }
    } else {
      console.log("ℹ️ No authenticated user email found, skipping email.");
    }

    return res.json(tx);

  } catch (err) {
    console.error("🔥 mark-paid fatal error:", err);
    return res.status(500).json({ error: "Failed to mark paid", details: err.message });
  }
});


/** Archive */
router.put("/:id/archive", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await sequelize.query(
      `
      UPDATE public.transactions
      SET status = 'archived'
      WHERE id = :id
      RETURNING *;
      `,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    if (!rows.length) return res.status(404).json({ error: "Transaction not found" });
    return res.json(rows[0]);
  } catch (err) {
    console.error("🔥 archive error:", err);
    return res.status(500).json({ error: "Failed to archive", details: err.message });
  }
});

export default router;
