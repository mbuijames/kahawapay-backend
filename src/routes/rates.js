// src/routes/rates.js
import express from "express";
import sequelize from "../db.js";
import { QueryTypes } from "sequelize";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const rows = await sequelize.query(
      "SELECT id, rate, base_currency, target_currency, updated_at FROM exchange_rates",
      { type: QueryTypes.SELECT }
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Rates error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;

