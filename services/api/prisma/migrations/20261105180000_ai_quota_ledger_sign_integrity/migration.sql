-- Prevent malformed ledger rows from minting quota through a negative grant
-- or increasing quota through a consume/expiry/reversal entry.
ALTER TABLE "ai_quota_ledger_entries"
  ADD CONSTRAINT "ai_quota_ledger_entry_direction_check"
  CHECK (
    ("entry_type" IN ('GRANT', 'RELEASE') AND "units_delta" > 0)
    OR
    ("entry_type" IN ('CONSUME', 'EXPIRE', 'REVERSAL') AND "units_delta" < 0)
  );
