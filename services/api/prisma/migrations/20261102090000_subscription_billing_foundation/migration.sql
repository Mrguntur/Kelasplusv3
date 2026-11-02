-- KELAS+ Platform V2: subscription and billing foundation
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'REFUNDED', 'PARTIALLY_REFUNDED');

CREATE TABLE "plans" (
  "id" UUID NOT NULL,
  "code" VARCHAR(60) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500),
  "billing_interval" "BillingInterval" NOT NULL,
  "price_amount" DECIMAL(14,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
  "max_users" INTEGER,
  "max_students" INTEGER,
  "max_classes" INTEGER,
  "features" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "is_published" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");
CREATE INDEX "plans_is_published_billing_interval_idx" ON "plans"("is_published", "billing_interval");

CREATE TABLE "subscriptions" (
  "id" UUID NOT NULL,
  "school_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  "billing_interval" "BillingInterval" NOT NULL,
  "price_amount" DECIMAL(14,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "current_period_start" TIMESTAMPTZ(6) NOT NULL,
  "current_period_end" TIMESTAMPTZ(6) NOT NULL,
  "trial_ends_at" TIMESTAMPTZ(6),
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "canceled_at" TIMESTAMPTZ(6),
  "ended_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscriptions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "subscriptions_period_check" CHECK ("current_period_end" > "current_period_start"),
  CONSTRAINT "subscriptions_price_check" CHECK ("price_amount" >= 0)
);
CREATE INDEX "subscriptions_school_id_status_current_period_end_idx" ON "subscriptions"("school_id", "status", "current_period_end");
CREATE INDEX "subscriptions_plan_id_status_idx" ON "subscriptions"("plan_id", "status");
-- Only one current entitlement-bearing subscription is allowed per school.
CREATE UNIQUE INDEX "subscriptions_one_current_per_school_key"
  ON "subscriptions"("school_id")
  WHERE "status" IN ('TRIALING', 'ACTIVE', 'PAST_DUE');

CREATE TABLE "invoices" (
  "id" UUID NOT NULL,
  "subscription_id" UUID NOT NULL,
  "invoice_number" VARCHAR(80) NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
  "subtotal_amount" DECIMAL(14,2) NOT NULL,
  "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(14,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
  "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "due_at" TIMESTAMPTZ(6),
  "paid_at" TIMESTAMPTZ(6),
  "voided_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "invoices_amounts_check" CHECK ("subtotal_amount" >= 0 AND "tax_amount" >= 0 AND "total_amount" >= 0)
);
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");
CREATE INDEX "invoices_subscription_id_status_issued_at_idx" ON "invoices"("subscription_id", "status", "issued_at");
CREATE INDEX "invoices_status_due_at_idx" ON "invoices"("status", "due_at");

CREATE TABLE "payments" (
  "id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "provider" VARCHAR(40) NOT NULL,
  "provider_reference" VARCHAR(160),
  "provider_transaction_id" VARCHAR(160),
  "idempotency_key" VARCHAR(120) NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
  "payment_url" VARCHAR(1000),
  "expires_at" TIMESTAMPTZ(6),
  "paid_at" TIMESTAMPTZ(6),
  "raw_payload" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payments_amount_check" CHECK ("amount" >= 0)
);
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");
CREATE UNIQUE INDEX "payments_provider_provider_reference_key" ON "payments"("provider", "provider_reference");
CREATE UNIQUE INDEX "payments_provider_provider_transaction_id_key" ON "payments"("provider", "provider_transaction_id");
CREATE INDEX "payments_invoice_id_status_created_at_idx" ON "payments"("invoice_id", "status", "created_at");
CREATE INDEX "payments_provider_status_created_at_idx" ON "payments"("provider", "status", "created_at");
