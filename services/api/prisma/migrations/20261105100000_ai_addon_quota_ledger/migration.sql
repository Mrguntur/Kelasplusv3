-- School-scoped AI add-on catalog, purchases, and append-only quota ledger.
CREATE TYPE "AiAddonPurchaseStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELED', 'EXPIRED', 'REFUNDED');
CREATE TYPE "AiQuotaLedgerEntryType" AS ENUM ('GRANT', 'CONSUME', 'RELEASE', 'EXPIRE', 'REVERSAL');

CREATE TABLE "ai_addon_packs" (
  "id" UUID NOT NULL,
  "code" VARCHAR(60) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500),
  "request_units" INTEGER NOT NULL,
  "price_amount" DECIMAL(14,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
  "expires_after_days" INTEGER,
  "is_published" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "ai_addon_packs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_addon_packs_request_units_check" CHECK ("request_units" > 0),
  CONSTRAINT "ai_addon_packs_price_check" CHECK ("price_amount" >= 0),
  CONSTRAINT "ai_addon_packs_expiry_check" CHECK ("expires_after_days" IS NULL OR "expires_after_days" > 0)
);
CREATE UNIQUE INDEX "ai_addon_packs_code_key" ON "ai_addon_packs"("code");
CREATE INDEX "ai_addon_packs_published_price_idx" ON "ai_addon_packs"("is_published", "price_amount");

CREATE TABLE "ai_addon_purchases" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "pack_id" UUID NOT NULL,
  "request_units" INTEGER NOT NULL,
  "price_amount" DECIMAL(14,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
  "status" "AiAddonPurchaseStatus" NOT NULL DEFAULT 'PENDING',
  "idempotency_key" VARCHAR(120) NOT NULL,
  "payment_provider" VARCHAR(40),
  "provider_reference" VARCHAR(160),
  "provider_payment_id" VARCHAR(160),
  "expires_at" TIMESTAMPTZ(6),
  "paid_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "ai_addon_purchases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_addon_purchases_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ai_addon_purchases_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "ai_addon_packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ai_addon_purchases_units_check" CHECK ("request_units" > 0),
  CONSTRAINT "ai_addon_purchases_price_check" CHECK ("price_amount" >= 0)
);
CREATE UNIQUE INDEX "ai_addon_purchases_idempotency_key_key" ON "ai_addon_purchases"("idempotency_key");
CREATE UNIQUE INDEX "ai_addon_purchases_provider_reference_key" ON "ai_addon_purchases"("payment_provider", "provider_reference");
CREATE UNIQUE INDEX "ai_addon_purchases_provider_payment_id_key" ON "ai_addon_purchases"("payment_provider", "provider_payment_id");
CREATE INDEX "ai_addon_purchases_school_status_created_idx" ON "ai_addon_purchases"("school_id", "status", "created_at");
CREATE INDEX "ai_addon_purchases_school_expiry_idx" ON "ai_addon_purchases"("school_id", "expires_at");

CREATE TABLE "ai_quota_ledger_entries" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "purchase_id" UUID,
  "entry_type" "AiQuotaLedgerEntryType" NOT NULL,
  "units_delta" INTEGER NOT NULL,
  "reference_key" VARCHAR(160) NOT NULL,
  "expires_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_quota_ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_quota_ledger_entries_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ai_quota_ledger_entries_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "ai_addon_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ai_quota_ledger_entries_units_nonzero_check" CHECK ("units_delta" <> 0)
);
CREATE UNIQUE INDEX "ai_quota_ledger_entries_reference_key_key" ON "ai_quota_ledger_entries"("reference_key");
CREATE INDEX "ai_quota_ledger_entries_school_expiry_created_idx" ON "ai_quota_ledger_entries"("school_id", "expires_at", "created_at");
CREATE INDEX "ai_quota_ledger_entries_school_type_created_idx" ON "ai_quota_ledger_entries"("school_id", "entry_type", "created_at");

-- Published catalog is readable by authenticated school members; only platform
-- admins may create or change catalog entries.
ALTER TABLE "ai_addon_packs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_addon_packs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ai_addon_packs_published_read" ON "ai_addon_packs"
  FOR SELECT USING (
    "is_published" = true
    OR NULLIF(current_setting('app.is_platform_admin', true), '') = 'true'
  );
CREATE POLICY "ai_addon_packs_platform_admin_write" ON "ai_addon_packs"
  FOR ALL
  USING (NULLIF(current_setting('app.is_platform_admin', true), '') = 'true')
  WITH CHECK (NULLIF(current_setting('app.is_platform_admin', true), '') = 'true');

-- Purchases are visible only in their active tenant. Initiation is restricted
-- to school admins; payment state transitions are performed by trusted
-- platform payment processing with the platform-admin transaction context.
ALTER TABLE "ai_addon_purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_addon_purchases" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ai_addon_purchases_tenant_read" ON "ai_addon_purchases"
  FOR SELECT USING (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM "school_memberships" m
      WHERE m."school_id" = "ai_addon_purchases"."school_id"
        AND m."user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );
CREATE POLICY "ai_addon_purchases_school_admin_insert" ON "ai_addon_purchases"
  FOR INSERT WITH CHECK (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM "school_memberships" m
      WHERE m."school_id" = "ai_addon_purchases"."school_id"
        AND m."user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND m."role" = 'SCHOOL_ADMIN'
    )
  );
CREATE POLICY "ai_addon_purchases_platform_payment_update" ON "ai_addon_purchases"
  FOR UPDATE
  USING (NULLIF(current_setting('app.is_platform_admin', true), '') = 'true')
  WITH CHECK (NULLIF(current_setting('app.is_platform_admin', true), '') = 'true');

-- Ledger is append-only: deliberately no UPDATE or DELETE policy.
ALTER TABLE "ai_quota_ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_quota_ledger_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ai_quota_ledger_tenant_read" ON "ai_quota_ledger_entries"
  FOR SELECT USING (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM "school_memberships" m
      WHERE m."school_id" = "ai_quota_ledger_entries"."school_id"
        AND m."user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );
CREATE POLICY "ai_quota_ledger_tenant_insert" ON "ai_quota_ledger_entries"
  FOR INSERT WITH CHECK (
    "school_id" = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM "school_memberships" m
      WHERE m."school_id" = "ai_quota_ledger_entries"."school_id"
        AND m."user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );
