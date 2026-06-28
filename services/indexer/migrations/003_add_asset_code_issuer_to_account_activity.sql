-- Normalised asset columns for consistent native/credit-asset identification.
-- asset_code: "XLM" for native, or the alphabetic code for credit assets (e.g. "USDC").
-- asset_issuer: NULL for native XLM, issuing account address for credit assets.
ALTER TABLE account_activity
    ADD COLUMN IF NOT EXISTS asset_code   VARCHAR(12),
    ADD COLUMN IF NOT EXISTS asset_issuer VARCHAR(56);

-- Back-fill from the existing asset column where possible.
UPDATE account_activity
SET
    asset_code   = CASE
                       WHEN asset = 'native' THEN 'XLM'
                       WHEN asset LIKE '%:%'  THEN split_part(asset, ':', 1)
                       ELSE asset
                   END,
    asset_issuer = CASE
                       WHEN asset LIKE '%:%' THEN split_part(asset, ':', 2)
                       ELSE NULL
                   END
WHERE asset IS NOT NULL;
