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

  if (!rows.length || rows[0].rate === null || rows[0].rate === undefined) {
    throw new Error(`Missing exchange rate for ${code}`);
  }

  const rate = Number(rows[0].rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid exchange rate for ${code}`);
  }

  return rate;
}

/** round to 2dp number */
export function to2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Number(x.toFixed(2));
}

/**
 * Compute fees + recipient net from a USD gross.
 * currency: 'USD' | 'KES' | 'UGX' | 'TZS'
 */
export async function computeFromUsd({ amount_usd, currency = "KES" }) {
  const CUR = String(currency).toUpperCase();
  const usd = Number(amount_usd);

  if (!Number.isFinite(usd) || usd <= 0) {
    throw new Error("amount_usd must be a positive number");
  }

  const usd2cur = CUR === "USD" ? 1 : await getRate(CUR);
  const feePct  = await getRate("FEE");

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

  if (!Number.isFinite(netLocal) || netLocal <= 0) {
    throw new Error("recipient_amount_net_local must be a positive number");
  }

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

  if (!Number.isFinite(btc) || btc <= 0) {
    throw new Error("amount_crypto_btc must be a positive number");
  }

  const btcUsd  = await getRate("BTCUSD");   // BTC → USD
  const usd2cur = CUR === "USD" ? 1 : await getRate(CUR); // USD → Local
  const feePct  = await getRate("FEE");      // Fee %

  const usd        = btc * btcUsd;
  const grossLocal = usd * usd2cur;
  const recipient  = grossLocal * (1 - feePct);
  const feeTotal   = grossLocal - recipient;

  if (!Number.isFinite(recipient) || recipient <= 0) {
    throw new Error("Computed recipient amount is invalid");
  }

  return {
    amount_usd: to2(usd),
    recipient_amount: to2(recipient),
    fee_total: to2(feeTotal),
  };
}
