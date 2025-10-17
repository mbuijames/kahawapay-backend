// src/helpers/transactions.js
import sequelize from "../db.js";
import { QueryTypes } from "sequelize";

/** Read a rate from exchange_rates by code (e.g., 'BTCUSD', 'KES', 'FEE') */
export async function getRate(code) {
  const rows = await sequelize.query(
    `SELECT rate
     FROM public.exchange_rates
     WHERE target_currency = :code
     ORDER BY updated_at DESC
     LIMIT 1`,
    { replacements: { code }, type: QueryTypes.SELECT }
  );
  if (!rows.length) throw new Error(`Missing exchange rate for ${code}`);
  return Number(rows[0].rate);
}

/** round to 2dp number */
export function to2(n) {
  return Number(Number(n).toFixed(2));
}

/**
 * Compute fees + recipient net from a USD gross.
 * currency: 'USD' | 'KES' | 'UGX' | 'TZS' (must exist in exchange_rates)
 * FEE is read from exchange_rates as a decimal fraction (e.g., 0.02 for 2%).
 */
export async function computeFromUsd({ amount_usd, currency = "KES" }) {
  const CUR = String(currency).toUpperCase();
  const usd = Number(amount_usd);

  if (!Number.isFinite(usd)) throw new Error("amount_usd must be a number");

  const usd2cur = CUR === "USD" ? 1 : await getRate(CUR);
  const feePct  = await getRate("FEE"); // e.g., 0.02

  const grossLocal = usd * usd2cur;
  const recipient  = grossLocal * (1 - feePct);
  const feeTotal   = grossLocal - recipient;

  return {
    amount_usd: to2(usd),
    recipient_amount: to2(recipient),
    fee_total: to2(feeTotal),
  };
}

/**
 * Compute from recipient's desired net local amount back to USD gross.
 */
export async function computeFromLocalNet({ recipient_amount_net_local, currency = "KES" }) {
  const CUR = String(currency).toUpperCase();
  const netLocal = Number(recipient_amount_net_local);

  if (!Number.isFinite(netLocal)) throw new Error("recipient_amount_net_local must be a number");

  const usd2cur = CUR === "USD" ? 1 : await getRate(CUR);
  const feePct  = await getRate("FEE");

  const grossLocal = netLocal / (1 - feePct);
  const usd        = grossLocal / usd2cur;
  const feeTotal   = grossLocal - netLocal;

  return {
    amount_usd: to2(usd),
    recipient_amount: to2(netLocal),
    fee_total: to2(feeTotal),
  };
}

/**
 * Compute from BTC: BTC → USD via BTCUSD, then same fee/FX logic.
 */
export async function computeFromBtc({ amount_crypto_btc, currency = "KES" }) {
  const CUR = String(currency).toUpperCase();
  const btc = Number(amount_crypto_btc);

  if (!Number.isFinite(btc)) throw new Error("amount_crypto_btc must be a number");

  const btcUsd  = await getRate("BTCUSD");          // price of 1 BTC in USD
  const usd2cur = CUR === "USD" ? 1 : await getRate(CUR);
  const feePct  = await getRate("FEE");

  const usd        = btc * btcUsd;
  const grossLocal = usd * usd2cur;
  const recipient  = grossLocal * (1 - feePct);
  const feeTotal   = grossLocal - recipient;

  return {
    amount_usd: to2(usd),
    recipient_amount: to2(recipient),
    fee_total: to2(feeTotal),
  };
}
