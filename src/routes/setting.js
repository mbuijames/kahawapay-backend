// kahawapay-backend/src/routes/settings.js
import express from 'express'
import pool from '../db.js'
import { requireAdmin } from '../middleware/auth.js'

const router = express.Router()

// ✅ Get all exchange rates
router.get('/exchange-rates', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT currency_code, rate_to_usd, updated_at 
       FROM exchange_rates
       ORDER BY currency_code ASC`
    )
    res.json({ rates: result.rows })
  } catch (err) {
    console.error('Error fetching rates:', err)
    res.status(500).json({ error: 'Failed to fetch exchange rates' })
  }
})

// ✅ Admin-only: update or insert an exchange rate
router.post('/exchange-rates', requireAdmin, async (req, res) => {
  const { currency_code, rate_to_usd } = req.body

  if (!currency_code || !rate_to_usd) {
    return res
      .status(400)
      .json({ error: 'currency_code and rate_to_usd required' })
  }

  try {
    const result = await pool.query(
      `INSERT INTO exchange_rates (currency_code, rate_to_usd, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (currency_code)
       DO UPDATE SET rate_to_usd = EXCLUDED.rate_to_usd, updated_at = now()
       RETURNING currency_code, rate_to_usd, updated_at`,
      [currency_code.toUpperCase(), rate_to_usd]
    )

    res.json({
      message: `Rate for ${currency_code.toUpperCase()} updated`,
      rate: result.rows[0],
    })
  } catch (err) {
    console.error('Error updating rate:', err)
    res.status(500).json({ error: 'Failed to update exchange rate' })
  }
})

export default router
