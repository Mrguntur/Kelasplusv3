-- Preserve the purchased pack's expiry terms and Midtrans checkout response.
-- Pack edits must not retroactively change already-created purchases.
ALTER TABLE "ai_addon_purchases"
  ADD COLUMN "expires_after_days" INTEGER,
  ADD COLUMN "payment_url" VARCHAR(1000),
  ADD COLUMN "provider_token" VARCHAR(500);

ALTER TABLE "ai_addon_purchases"
  ADD CONSTRAINT "ai_addon_purchases_expiry_days_check"
  CHECK ("expires_after_days" IS NULL OR "expires_after_days" > 0);
