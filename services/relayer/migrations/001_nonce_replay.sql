CREATE TABLE used_nonces (
  account TEXT,
  nonce BIGINT,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (account, nonce)
);
