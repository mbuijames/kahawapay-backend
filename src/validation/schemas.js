// src/validation/schemas.js
import { z } from "zod";

export const CurrencyEnum = z.enum((process.env.SUPPORTED_CURRENCIES || "KES,UGX,TZS")
  .split(",")
  .map(s => s.trim().toUpperCase())
  .filter(Boolean));

export const GuestTxSchema = z.object({
  amount_crypto_btc: z.number().positive("BTC amount must be > 0"),
  currency: CurrencyEnum,
  recipient_msisdn: z.string().regex(/^\d{12}$/, "MSISDN must be 12 digits"),
});

export const UserTxSchema = z.object({
  amount_crypto_btc: z.number().positive(),
  currency: CurrencyEnum,
  recipient_msisdn: z.string().regex(/^\d{12}$/),
});

export const ExchangeRateUpsertSchema = z.object({
  targetCurrency: z.string().regex(/^[A-Z]{3}$/),
  rate: z.number().positive(),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const TwoFALoginSchema = z.object({
  tempToken: z.string().min(10),
  code: z.string().regex(/^\d{6}$/),
});
