// Remove this line:
// import fetch from "node-fetch";

import express from "express";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

router.get("/api/rates", async (req, res) => {
  try {
    const response = await fetch(process.env.RATES_API_URL); // built-in fetch
    if (!response.ok) throw new Error("Failed to fetch rates");
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
