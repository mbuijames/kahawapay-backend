// src/routes/rates.js
import express from "express";
import sequelize from "../db.js";
import { QueryTypes } from "sequelize";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const rows = await sequelize.query(
      "SELECT id, rate, base_currency, target_currency, updated_at FROM exchange_rates ORDER BY id ASC",
      { type: QueryTypes.SELECT }
    );

    res.json({
      rates: rows,
      source: "database",
      lastUpdated: rows?.[0]?.updated_at || new Date().toISOString()
    });

  } catch (err) {
    console.error("Rates error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
