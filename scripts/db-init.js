CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  fee_percent NUMERIC DEFAULT 0
);

INSERT INTO settings (fee_percent) VALUES (0)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS exchange_rates (
  currency_code TEXT PRIMARY KEY,
  rate_to_usd NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  recipient_msisdn TEXT NOT NULL,
  amount_btc NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
-- exchange_rates table (if not present)
CREATE TABLE IF NOT EXISTS exchange_rates (
  currency_code TEXT PRIMARY KEY,      -- e.g. KES, UGX, TZS, USD
  rate_to_usd NUMERIC NOT NULL,        -- how many local units = 1 USD (units per USD)
  updated_at TIMESTAMP DEFAULT now()
);

-- transactions table: stores both local and BTC amounts and status
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INT NULL,                    -- nullable: guest sends allowed
  recipient_msisdn TEXT NOT NULL,
  amount_local NUMERIC NOT NULL,       -- local units (e.g., KES)
  currency TEXT NOT NULL,              -- currency code (KES/UGX/TZS)
  amount_crypto_btc NUMERIC NOT NULL,  -- BTC amount user must send
  status TEXT NOT NULL DEFAULT 'pending', -- pending / paid / failed / settled
  created_at TIMESTAMP DEFAULT now(),
  created_by TEXT NULL                 -- user identifier or 'guest'
);

-- audit table to track changes to transactions
CREATE TABLE IF NOT EXISTS transaction_audit (
  id SERIAL PRIMARY KEY,
  transaction_id INT REFERENCES transactions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                -- e.g., 'created', 'status_changed'
  actor TEXT,                          -- user email/id or 'guest' or 'system'
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT now()
);
