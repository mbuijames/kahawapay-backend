// src/routes/rates.js
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

router.get("/api/rates", async (req, res) => {
  try {
    const response = await fetch(process.env.RATES_API_URL); // external API
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    const data = await response.json();
    res.json(data); // send the actual data
  } catch (err) {
    console.error("Error fetching rates:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
