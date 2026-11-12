-- CreateEnum
CREATE TYPE "Activity" AS ENUM ('BAND', 'SCHOOL', 'SHARED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'DIRECT_DEBIT', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceSeries" AS ENUM ('ALC', 'ESC');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierKind" AS ENUM ('COMPANY', 'PROFESSIONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('PROFESSIONAL_SERVICES', 'TEACHING_REINFORCEMENT', 'MATERIALS_INSTRUMENTS', 'SUPPLIES', 'RENT', 'INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "RecurringPartyType" AS ENUM ('SUPPLIER', 'WORKER');

-- CreateEnum
CREATE TYPE "SchoolModality" AS ENUM ('EARLY_MUSIC', 'SOLFEGE', 'SOLFEGE_INSTRUMENT', 'INSTRUMENT');

-- CreateEnum
CREATE TYPE "SchoolTariffKind" AS ENUM ('ORDINARY', 'BAND_MEMBER', 'SIBLINGS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SchoolTariffKey" AS ENUM ('EARLY_MUSIC', 'SOLFEGE', 'SOLFEGE_INSTRUMENT', 'INSTRUMENT', 'BAND_MEMBER', 'SIBLINGS');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "FiscalYearStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "JournalSourceType" AS ENUM ('MANUAL', 'OPENING', 'INVOICE', 'INVOICE_PAYMENT', 'EXPENSE', 'EXPENSE_PAYMENT', 'PAYROLL', 'PAYROLL_PAYMENT', 'REVERSAL', 'REGULARIZATION', 'CLOSING');

-- CreateEnum
CREATE TYPE "BudgetKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "GrantStatus" AS ENUM ('PENDING', 'IN_PREPARATION', 'SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CashDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "InternalCashCategory" AS ENUM ('RAFFLE', 'MUSIC_REINFORCEMENT', 'EVENT', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'REVIEWED');

-- AlterTable
ALTER TABLE "band_profile" ADD COLUMN     "iban" VARCHAR(34),
ADD COLUMN     "invoice_footer" VARCHAR(1000);

-- CreateTable
CREATE TABLE "client" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(160) NOT NULL,
    "tax_id" VARCHAR(32),
    "address_line" VARCHAR(255),
    "city" VARCHAR(160),
    "email" VARCHAR(254),
    "phone" VARCHAR(40),
    "notes" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_sequence" (
    "series" "InvoiceSeries" NOT NULL,
    "year" SMALLINT NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_sequence_pkey" PRIMARY KEY ("series","year")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "series" "InvoiceSeries" NOT NULL,
    "year" SMALLINT NOT NULL,
    "number" INTEGER NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "issue_date" DATE NOT NULL,
    "operation_date" DATE,
    "client_id" UUID,
    "recipient_name" VARCHAR(160) NOT NULL,
    "recipient_tax_id" VARCHAR(32),
    "recipient_address" VARCHAR(255),
    "recipient_city" VARCHAR(160),
    "recipient_email" VARCHAR(254),
    "tax_rate_bp" INTEGER NOT NULL,
    "withholding_rate_bp" INTEGER NOT NULL DEFAULT 0,
    "base_cents" BIGINT NOT NULL,
    "tax_cents" BIGINT NOT NULL,
    "withholding_cents" BIGINT NOT NULL,
    "total_cents" BIGINT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "paid_on" DATE,
    "payment_method" "PaymentMethod",
    "notes" VARCHAR(2000),
    "journal_entry_id" UUID,
    "payment_entry_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(14,4) NOT NULL,
    "amount_cents" BIGINT NOT NULL,

    CONSTRAINT "invoice_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(160) NOT NULL,
    "tax_id" VARCHAR(32),
    "kind" "SupplierKind" NOT NULL DEFAULT 'COMPANY',
    "default_withholding_bp" INTEGER NOT NULL DEFAULT 0,
    "address_line" VARCHAR(255),
    "city" VARCHAR(160),
    "email" VARCHAR(254),
    "phone" VARCHAR(40),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id" UUID NOT NULL,
    "number" VARCHAR(60) NOT NULL,
    "issue_date" DATE NOT NULL,
    "operation_date" DATE,
    "activity" "Activity" NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "concept" VARCHAR(500) NOT NULL,
    "base_cents" BIGINT NOT NULL,
    "tax_rate_bp" INTEGER NOT NULL,
    "tax_cents" BIGINT NOT NULL,
    "other_cents" BIGINT NOT NULL DEFAULT 0,
    "withholding_rate_bp" INTEGER NOT NULL DEFAULT 0,
    "withholding_cents" BIGINT NOT NULL DEFAULT 0,
    "total_cents" BIGINT NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "paid_on" DATE,
    "payment_method" "PaymentMethod",
    "notes" VARCHAR(2000),
    "journal_entry_id" UUID,
    "payment_entry_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_expense" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "concept" VARCHAR(160) NOT NULL,
    "party_type" "RecurringPartyType" NOT NULL,
    "supplier_id" UUID,
    "worker_id" UUID,
    "activity" "Activity" NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "next_due_on" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID,
    "full_name" VARCHAR(160) NOT NULL,
    "family_label" VARCHAR(100),
    "modality" "SchoolModality" NOT NULL,
    "tariff_kind" "SchoolTariffKind" NOT NULL DEFAULT 'ORDINARY',
    "custom_fee_cents" BIGINT,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolled_on" DATE,
    "payment_method" "PaymentMethod",
    "billing_name" VARCHAR(160),
    "billing_tax_id" VARCHAR(32),
    "billing_address" VARCHAR(255),
    "billing_city" VARCHAR(160),
    "billing_email" VARCHAR(254),
    "billing_phone" VARCHAR(40),
    "notes" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_tariff" (
    "key" "SchoolTariffKey" NOT NULL,
    "amount_cents" BIGINT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_tariff_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "student_fee" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "period" DATE NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "invoice_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_fee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID,
    "full_name" VARCHAR(160) NOT NULL,
    "role_title" VARCHAR(130),
    "activity" "Activity" NOT NULL DEFAULT 'SCHOOL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "worker_id" UUID NOT NULL,
    "period" DATE NOT NULL,
    "accrual_date" DATE NOT NULL,
    "activity" "Activity" NOT NULL,
    "gross_cents" BIGINT NOT NULL,
    "employee_ss_cents" BIGINT NOT NULL DEFAULT 0,
    "irpf_cents" BIGINT NOT NULL DEFAULT 0,
    "other_deductions_cents" BIGINT NOT NULL DEFAULT 0,
    "employer_ss_cents" BIGINT NOT NULL DEFAULT 0,
    "net_cents" BIGINT NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'PENDING',
    "paid_on" DATE,
    "payment_method" "PaymentMethod",
    "notes" VARCHAR(500),
    "journal_entry_id" UUID,
    "payment_entry_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_account" (
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_account_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "fiscal_year" (
    "year" SMALLINT NOT NULL,
    "status" "FiscalYearStatus" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMPTZ(3),
    "closed_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_year_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "journal_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "year" SMALLINT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "entry_date" DATE NOT NULL,
    "activity" "Activity" NOT NULL,
    "reference" VARCHAR(80) NOT NULL,
    "concept" VARCHAR(300) NOT NULL,
    "source_type" "JournalSourceType" NOT NULL,
    "source_id" UUID,
    "reversal_of_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_line" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entry_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "account_code" VARCHAR(10) NOT NULL,
    "description" VARCHAR(300),
    "debit_cents" BIGINT NOT NULL DEFAULT 0,
    "credit_cents" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "journal_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_movement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_label" VARCHAR(80) NOT NULL,
    "booked_on" DATE NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "journal_entry_id" UUID,
    "reconciled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_line" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "year" SMALLINT NOT NULL,
    "activity" "Activity" NOT NULL,
    "kind" "BudgetKind" NOT NULL,
    "account_prefix" VARCHAR(10) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "issuer" VARCHAR(160) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "year" SMALLINT NOT NULL,
    "activity" "Activity" NOT NULL,
    "awarded_cents" BIGINT NOT NULL,
    "received_cents" BIGINT NOT NULL DEFAULT 0,
    "justification_deadline" DATE,
    "status" "GrantStatus" NOT NULL DEFAULT 'PENDING',
    "reference" VARCHAR(120),
    "notes" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grant_expense" (
    "grant_id" UUID NOT NULL,
    "expense_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grant_expense_pkey" PRIMARY KEY ("grant_id","expense_id")
);

-- CreateTable
CREATE TABLE "internal_cash_movement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "occurred_on" DATE NOT NULL,
    "direction" "CashDirection" NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "activity" "Activity" NOT NULL,
    "category" "InternalCashCategory" NOT NULL,
    "concept" VARCHAR(240) NOT NULL,
    "notes" VARCHAR(500),
    "review" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "internal_cash_movement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_name_idx" ON "client"("name");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_code_key" ON "invoice"("code");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_journal_entry_id_key" ON "invoice"("journal_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_payment_entry_id_key" ON "invoice"("payment_entry_id");

-- CreateIndex
CREATE INDEX "invoice_issue_date_idx" ON "invoice"("issue_date");

-- CreateIndex
CREATE INDEX "invoice_status_idx" ON "invoice"("status");

-- CreateIndex
CREATE INDEX "invoice_client_id_idx" ON "invoice"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_series_year_number_key" ON "invoice"("series", "year", "number");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_line_invoice_id_position_key" ON "invoice_line"("invoice_id", "position");

-- CreateIndex
CREATE INDEX "supplier_name_idx" ON "supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "expense_journal_entry_id_key" ON "expense"("journal_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_payment_entry_id_key" ON "expense"("payment_entry_id");

-- CreateIndex
CREATE INDEX "expense_issue_date_idx" ON "expense"("issue_date");

-- CreateIndex
CREATE INDEX "expense_status_idx" ON "expense"("status");

-- CreateIndex
CREATE INDEX "expense_paid_on_idx" ON "expense"("paid_on");

-- CreateIndex
CREATE UNIQUE INDEX "expense_supplier_id_number_key" ON "expense"("supplier_id", "number");

-- CreateIndex
CREATE INDEX "recurring_expense_next_due_on_idx" ON "recurring_expense"("next_due_on");

-- CreateIndex
CREATE INDEX "student_full_name_idx" ON "student"("full_name");

-- CreateIndex
CREATE INDEX "student_status_idx" ON "student"("status");

-- CreateIndex
CREATE UNIQUE INDEX "student_fee_invoice_id_key" ON "student_fee"("invoice_id");

-- CreateIndex
CREATE INDEX "student_fee_period_idx" ON "student_fee"("period");

-- CreateIndex
CREATE UNIQUE INDEX "student_fee_student_id_period_key" ON "student_fee"("student_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_journal_entry_id_key" ON "payroll"("journal_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_payment_entry_id_key" ON "payroll"("payment_entry_id");

-- CreateIndex
CREATE INDEX "payroll_period_idx" ON "payroll"("period");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_worker_id_period_key" ON "payroll"("worker_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entry_reversal_of_id_key" ON "journal_entry"("reversal_of_id");

-- CreateIndex
CREATE INDEX "journal_entry_entry_date_idx" ON "journal_entry"("entry_date");

-- CreateIndex
CREATE INDEX "journal_entry_source_type_source_id_idx" ON "journal_entry"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entry_year_sequence_key" ON "journal_entry"("year", "sequence");

-- CreateIndex
CREATE INDEX "journal_line_account_code_idx" ON "journal_line"("account_code");

-- CreateIndex
CREATE UNIQUE INDEX "journal_line_entry_id_position_key" ON "journal_line"("entry_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "bank_movement_fingerprint_key" ON "bank_movement"("fingerprint");

-- CreateIndex
CREATE INDEX "bank_movement_booked_on_idx" ON "bank_movement"("booked_on");

-- CreateIndex
CREATE INDEX "bank_movement_journal_entry_id_idx" ON "bank_movement"("journal_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_line_year_activity_kind_account_prefix_key" ON "budget_line"("year", "activity", "kind", "account_prefix");

-- CreateIndex
CREATE INDEX "grant_year_idx" ON "grant"("year");

-- CreateIndex
CREATE INDEX "grant_expense_expense_id_idx" ON "grant_expense"("expense_id");

-- CreateIndex
CREATE INDEX "internal_cash_movement_occurred_on_idx" ON "internal_cash_movement"("occurred_on");

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_payment_entry_id_fkey" FOREIGN KEY ("payment_entry_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_payment_entry_id_fkey" FOREIGN KEY ("payment_entry_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expense" ADD CONSTRAINT "recurring_expense_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expense" ADD CONSTRAINT "recurring_expense_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student" ADD CONSTRAINT "student_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee" ADD CONSTRAINT "student_fee_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee" ADD CONSTRAINT "student_fee_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker" ADD CONSTRAINT "worker_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_payment_entry_id_fkey" FOREIGN KEY ("payment_entry_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_year" ADD CONSTRAINT "fiscal_year_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_year_fkey" FOREIGN KEY ("year") REFERENCES "fiscal_year"("year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_account_code_fkey" FOREIGN KEY ("account_code") REFERENCES "ledger_account"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_movement" ADD CONSTRAINT "bank_movement_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_expense" ADD CONSTRAINT "grant_expense_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_expense" ADD CONSTRAINT "grant_expense_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ───────────── Restricciones que Prisma no expresa ─────────────

-- Porcentajes en puntos básicos (0 % … 100 %).
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_rates_chk" CHECK ("tax_rate_bp" BETWEEN 0 AND 10000 AND "withholding_rate_bp" BETWEEN 0 AND 10000);
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_number_chk" CHECK ("number" > 0 AND "code" ~ '^(ALC|ESC)-[0-9]{4}-[0-9]{3,}$');
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_amounts_chk" CHECK ("base_cents" >= 0 AND "tax_cents" >= 0 AND "withholding_cents" >= 0 AND "total_cents" = "base_cents" + "tax_cents" - "withholding_cents");
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_year_chk" CHECK ("year" = EXTRACT(YEAR FROM "issue_date"));
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_paid_chk" CHECK (("status" = 'PAID') = ("paid_on" IS NOT NULL));
ALTER TABLE "invoice_sequence" ADD CONSTRAINT "invoice_sequence_number_chk" CHECK ("last_number" >= 0);
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_values_chk" CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "amount_cents" >= 0 AND "position" > 0);

ALTER TABLE "supplier" ADD CONSTRAINT "supplier_withholding_chk" CHECK ("default_withholding_bp" BETWEEN 0 AND 10000);
ALTER TABLE "expense" ADD CONSTRAINT "expense_rates_chk" CHECK ("tax_rate_bp" BETWEEN 0 AND 10000 AND "withholding_rate_bp" BETWEEN 0 AND 10000);
ALTER TABLE "expense" ADD CONSTRAINT "expense_amounts_chk" CHECK ("base_cents" >= 0 AND "tax_cents" >= 0 AND "withholding_cents" >= 0 AND "total_cents" = "base_cents" + "tax_cents" + "other_cents" - "withholding_cents");
ALTER TABLE "expense" ADD CONSTRAINT "expense_paid_chk" CHECK (("status" = 'PAID') = ("paid_on" IS NOT NULL));

ALTER TABLE "recurring_expense" ADD CONSTRAINT "recurring_expense_party_chk" CHECK (
  ("party_type" = 'SUPPLIER' AND "worker_id" IS NULL) OR
  ("party_type" = 'WORKER' AND "supplier_id" IS NULL AND "worker_id" IS NOT NULL)
);
ALTER TABLE "recurring_expense" ADD CONSTRAINT "recurring_expense_amount_chk" CHECK ("amount_cents" >= 0);

ALTER TABLE "student" ADD CONSTRAINT "student_custom_fee_chk" CHECK (
  ("custom_fee_cents" IS NULL OR "custom_fee_cents" >= 0) AND
  ("tariff_kind" <> 'CUSTOM' OR "custom_fee_cents" IS NOT NULL)
);
ALTER TABLE "school_tariff" ADD CONSTRAINT "school_tariff_amount_chk" CHECK ("amount_cents" IS NULL OR "amount_cents" >= 0);
ALTER TABLE "student_fee" ADD CONSTRAINT "student_fee_values_chk" CHECK ("amount_cents" > 0 AND EXTRACT(DAY FROM "period") = 1);

ALTER TABLE "payroll" ADD CONSTRAINT "payroll_amounts_chk" CHECK (
  "gross_cents" > 0 AND "employee_ss_cents" >= 0 AND "irpf_cents" >= 0 AND
  "other_deductions_cents" >= 0 AND "employer_ss_cents" >= 0 AND "net_cents" > 0 AND
  "net_cents" = "gross_cents" - "employee_ss_cents" - "irpf_cents" - "other_deductions_cents"
);
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_period_chk" CHECK (EXTRACT(DAY FROM "period") = 1);
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_paid_chk" CHECK (("status" = 'PAID') = ("paid_on" IS NOT NULL));

ALTER TABLE "ledger_account" ADD CONSTRAINT "ledger_account_code_chk" CHECK ("code" ~ '^[0-9]{3,10}$');
ALTER TABLE "fiscal_year" ADD CONSTRAINT "fiscal_year_closed_chk" CHECK (("status" = 'CLOSED') = ("closed_at" IS NOT NULL));
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_values_chk" CHECK ("sequence" > 0 AND "year" = EXTRACT(YEAR FROM "entry_date"));
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_amounts_chk" CHECK (
  "debit_cents" >= 0 AND "credit_cents" >= 0 AND (("debit_cents" > 0) <> ("credit_cents" > 0))
);

ALTER TABLE "bank_movement" ADD CONSTRAINT "bank_movement_amount_chk" CHECK ("amount_cents" <> 0);
ALTER TABLE "bank_movement" ADD CONSTRAINT "bank_movement_reconciled_chk" CHECK (("journal_entry_id" IS NULL) = ("reconciled_at" IS NULL));
ALTER TABLE "budget_line" ADD CONSTRAINT "budget_line_values_chk" CHECK ("amount_cents" >= 0 AND "account_prefix" ~ '^[67][0-9]{0,9}$');
ALTER TABLE "grant" ADD CONSTRAINT "grant_amounts_chk" CHECK ("awarded_cents" >= 0 AND "received_cents" >= 0);
ALTER TABLE "internal_cash_movement" ADD CONSTRAINT "internal_cash_amount_chk" CHECK ("amount_cents" > 0);

-- ───────────── Diario contable: inmutable y siempre cuadrado ─────────────

CREATE FUNCTION "journal_reject_mutation"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'journal entries are immutable: post a reversal entry instead'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "journal_entry_no_update_delete"
  BEFORE UPDATE OR DELETE ON "journal_entry"
  FOR EACH ROW EXECUTE FUNCTION "journal_reject_mutation"();
CREATE TRIGGER "journal_entry_no_truncate"
  BEFORE TRUNCATE ON "journal_entry"
  FOR EACH STATEMENT EXECUTE FUNCTION "journal_reject_mutation"();
CREATE TRIGGER "journal_line_no_update_delete"
  BEFORE UPDATE OR DELETE ON "journal_line"
  FOR EACH ROW EXECUTE FUNCTION "journal_reject_mutation"();
CREATE TRIGGER "journal_line_no_truncate"
  BEFORE TRUNCATE ON "journal_line"
  FOR EACH STATEMENT EXECUTE FUNCTION "journal_reject_mutation"();

-- Se evalúa al confirmar la transacción, cuando ya están insertadas todas las líneas del asiento.
CREATE FUNCTION "journal_entry_check_balance"() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  total_debit BIGINT;
  total_credit BIGINT;
BEGIN
  SELECT COALESCE(SUM("debit_cents"), 0), COALESCE(SUM("credit_cents"), 0)
    INTO total_debit, total_credit
    FROM "journal_line" WHERE "entry_id" = NEW."entry_id";
  IF total_debit <> total_credit OR total_debit = 0 THEN
    RAISE EXCEPTION 'journal entry % is not balanced (debit %, credit %)', NEW."entry_id", total_debit, total_credit
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "journal_line_balanced"
  AFTER INSERT ON "journal_line"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "journal_entry_check_balance"();

-- ───────────── Datos iniciales ─────────────

-- Tarifas de la escuela (IGIC incluido) tomadas de Alcaraván Gestión 2.13; sin importe = por definir.
INSERT INTO "school_tariff" ("key", "amount_cents") VALUES
  ('EARLY_MUSIC', 1500),
  ('SOLFEGE', NULL),
  ('SOLFEGE_INSTRUMENT', 3500),
  ('INSTRUMENT', NULL),
  ('BAND_MEMBER', 1000),
  ('SIBLINGS', 3000)
ON CONFLICT ("key") DO NOTHING;

-- Plan de cuentas base (PGC de entidades sin fines lucrativos, subconjunto). Se amplía desde la app.
INSERT INTO "ledger_account" ("code", "name") VALUES
  ('100', 'Fondo social'),
  ('120', 'Remanente'),
  ('121', 'Excedentes negativos de ejercicios anteriores'),
  ('129', 'Excedente del ejercicio'),
  ('130', 'Subvenciones oficiales de capital'),
  ('170', 'Deudas a largo plazo con entidades de crédito'),
  ('216', 'Mobiliario'),
  ('217', 'Equipos para procesos de información'),
  ('219', 'Otro inmovilizado material (instrumentos)'),
  ('281', 'Amortización acumulada del inmovilizado material'),
  ('400', 'Proveedores'),
  ('410', 'Acreedores por prestaciones de servicios'),
  ('430', 'Clientes'),
  ('440', 'Deudores'),
  ('465', 'Remuneraciones pendientes de pago'),
  ('470', 'Hacienda Pública, deudora por diversos conceptos'),
  ('4708', 'Hacienda Pública, deudora por subvenciones concedidas'),
  ('472', 'IGIC soportado'),
  ('473', 'Hacienda Pública, retenciones y pagos a cuenta'),
  ('475', 'Hacienda Pública, acreedora por diversos conceptos'),
  ('4751', 'Hacienda Pública, acreedora por retenciones practicadas'),
  ('4759', 'Otras deducciones de nómina pendientes de aplicar'),
  ('476', 'Organismos de la Seguridad Social, acreedores'),
  ('477', 'IGIC repercutido'),
  ('480', 'Gastos anticipados'),
  ('485', 'Ingresos anticipados'),
  ('520', 'Deudas a corto plazo con entidades de crédito'),
  ('570', 'Caja'),
  ('572', 'Bancos e instituciones de crédito'),
  ('602', 'Compras de otros aprovisionamientos'),
  ('621', 'Arrendamientos y cánones'),
  ('622', 'Reparaciones y conservación'),
  ('623', 'Servicios de profesionales independientes'),
  ('624', 'Transportes'),
  ('625', 'Primas de seguros'),
  ('626', 'Servicios bancarios y similares'),
  ('627', 'Publicidad, propaganda y relaciones públicas'),
  ('628', 'Suministros'),
  ('629', 'Otros servicios'),
  ('631', 'Otros tributos'),
  ('640', 'Sueldos y salarios'),
  ('642', 'Seguridad Social a cargo de la entidad'),
  ('649', 'Otros gastos sociales'),
  ('662', 'Intereses de deudas'),
  ('681', 'Amortización del inmovilizado material'),
  ('705', 'Prestaciones de servicios'),
  ('720', 'Cuotas de asociados y afiliados'),
  ('721', 'Cuotas de usuarios'),
  ('722', 'Promociones para captación de recursos'),
  ('723', 'Ingresos de patrocinadores y colaboraciones'),
  ('740', 'Subvenciones, donaciones y legados a la explotación'),
  ('747', 'Otras subvenciones, donaciones y legados transferidos al excedente'),
  ('759', 'Ingresos por servicios diversos'),
  ('769', 'Otros ingresos financieros'),
  ('778', 'Ingresos excepcionales')
ON CONFLICT ("code") DO NOTHING;
