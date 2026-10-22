-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SALES', 'PROCUREMENT', 'LOGISTIC', 'FINANCE', 'PROJECT', 'TFS');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('OPEN', 'FOLLOW_UP', 'CLOSED', 'DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'WAITING', 'PROCESS', 'DONE', 'PENDING', 'SHIPPED', 'DELIVERED', 'PAID', 'ACTIVE', 'COMPLETED', 'REVIEW');

-- CreateEnum
CREATE TYPE "WorkflowType" AS ENUM ('SPARE_PART', 'SERVICE', 'PROJECT');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SALES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_status" (
    "id" BIGSERIAL NOT NULL,
    "status_code" VARCHAR(30) NOT NULL,
    "status_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_source" (
    "id" BIGSERIAL NOT NULL,
    "source_code" VARCHAR(30) NOT NULL,
    "source_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry" (
    "id" BIGSERIAL NOT NULL,
    "inquiry_number" VARCHAR(50) NOT NULL,
    "inquiry_date" DATE NOT NULL,
    "customer_name" VARCHAR(200) NOT NULL,
    "source_id" BIGINT,
    "status_id" BIGINT NOT NULL,
    "request_type" VARCHAR(20) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "due_date" DATE,
    "assigned_to" INTEGER,
    "attachment_url" TEXT,
    "internal_note" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_detail" (
    "id" BIGSERIAL NOT NULL,
    "inquiry_id" BIGINT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "item_type" VARCHAR(20) NOT NULL,
    "request_description" TEXT NOT NULL,
    "requested_item_name" VARCHAR(200),
    "requested_part_number" VARCHAR(100),
    "qty" DECIMAL(18,2) NOT NULL DEFAULT 1,
    "uom" VARCHAR(30),
    "mapped_service_id" BIGINT,
    "mapped_spare_part_id" BIGINT,
    "stock_available" BOOLEAN,
    "stock_qty" DECIMAL(18,2),
    "clarification_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_status_history" (
    "id" BIGSERIAL NOT NULL,
    "inquiry_id" BIGINT NOT NULL,
    "old_status_id" BIGINT,
    "new_status_id" BIGINT NOT NULL,
    "changed_by" INTEGER,
    "change_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation" (
    "id" BIGSERIAL NOT NULL,
    "quotation_number" VARCHAR(50) NOT NULL,
    "inquiry_id" BIGINT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'DRAFT',
    "basePrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "margin" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lead_time_days" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_detail" (
    "id" BIGSERIAL NOT NULL,
    "quotation_id" BIGINT NOT NULL,
    "inquiry_detail_id" BIGINT,
    "line_no" INTEGER NOT NULL,
    "item_type" VARCHAR(20) NOT NULL,
    "mapped_service_id" BIGINT,
    "mapped_spare_part_id" BIGINT,
    "qty" DECIMAL(18,2) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lead_time_days" INTEGER NOT NULL DEFAULT 0,
    "stock_available" BOOLEAN,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_service_category" (
    "id" BIGSERIAL NOT NULL,
    "category_code" VARCHAR(30) NOT NULL,
    "category_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_service_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_service_item" (
    "id" BIGSERIAL NOT NULL,
    "service_code" VARCHAR(50) NOT NULL,
    "service_name" VARCHAR(200) NOT NULL,
    "category_id" BIGINT NOT NULL,
    "description" TEXT,
    "service_scope" TEXT,
    "uom" VARCHAR(30) NOT NULL,
    "standard_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'IDR',
    "lead_time_days" INTEGER NOT NULL DEFAULT 0,
    "requires_engineer" BOOLEAN NOT NULL DEFAULT false,
    "requires_tfs" BOOLEAN NOT NULL DEFAULT false,
    "requires_material" BOOLEAN NOT NULL DEFAULT false,
    "target_customer_type" VARCHAR(20) DEFAULT 'external',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_service_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_spare_part_category" (
    "id" BIGSERIAL NOT NULL,
    "category_code" VARCHAR(30) NOT NULL,
    "category_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_spare_part_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_spare_part" (
    "id" BIGSERIAL NOT NULL,
    "part_code" VARCHAR(50) NOT NULL,
    "part_name" VARCHAR(200) NOT NULL,
    "category_id" BIGINT NOT NULL,
    "part_number" VARCHAR(100),
    "drawing_number" VARCHAR(100),
    "brand" VARCHAR(100),
    "model" VARCHAR(100),
    "specification" TEXT,
    "description" TEXT,
    "uom" VARCHAR(30) NOT NULL,
    "standard_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'IDR',
    "lead_time_days" INTEGER NOT NULL DEFAULT 0,
    "stock_qty" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "min_stock" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "warehouse_location" VARCHAR(100),
    "supplier_name" VARCHAR(150),
    "country_of_origin" VARCHAR(100),
    "weight_kg" DECIMAL(12,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_spare_part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order" (
    "id" BIGSERIAL NOT NULL,
    "po_number" VARCHAR(50),
    "quotation_id" BIGINT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'REVIEW',
    "sd_document" VARCHAR(50),
    "net_value" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'IDR',
    "code_word" VARCHAR(100),
    "sales_organization" VARCHAR(100),
    "ship_to_party_name" VARCHAR(200),
    "expected_to" DATE,
    "remarks" TEXT,
    "reminder_email" VARCHAR(150),
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_detail" (
    "id" BIGSERIAL NOT NULL,
    "purchase_order_id" BIGINT NOT NULL,
    "quotation_detail_id" BIGINT,
    "item_type" VARCHAR(20) NOT NULL,
    "mapped_service_id" BIGINT,
    "mapped_spare_part_id" BIGINT,
    "qty" DECIMAL(18,2) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_detail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_status_status_code_key" ON "inquiry_status"("status_code");

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_source_source_code_key" ON "inquiry_source"("source_code");

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_inquiry_number_key" ON "inquiry"("inquiry_number");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_quotation_number_key" ON "quotation"("quotation_number");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_inquiry_id_key" ON "quotation"("inquiry_id");

-- CreateIndex
CREATE UNIQUE INDEX "master_service_category_category_code_key" ON "master_service_category"("category_code");

-- CreateIndex
CREATE UNIQUE INDEX "master_service_item_service_code_key" ON "master_service_item"("service_code");

-- CreateIndex
CREATE UNIQUE INDEX "master_spare_part_category_category_code_key" ON "master_spare_part_category"("category_code");

-- CreateIndex
CREATE UNIQUE INDEX "master_spare_part_part_code_key" ON "master_spare_part"("part_code");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_po_number_key" ON "purchase_order"("po_number");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_quotation_id_key" ON "purchase_order"("quotation_id");

-- AddForeignKey
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "inquiry_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "inquiry_status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_detail" ADD CONSTRAINT "inquiry_detail_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_detail" ADD CONSTRAINT "inquiry_detail_mapped_service_id_fkey" FOREIGN KEY ("mapped_service_id") REFERENCES "master_service_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_detail" ADD CONSTRAINT "inquiry_detail_mapped_spare_part_id_fkey" FOREIGN KEY ("mapped_spare_part_id") REFERENCES "master_spare_part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_status_history" ADD CONSTRAINT "inquiry_status_history_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_status_history" ADD CONSTRAINT "inquiry_status_history_old_status_id_fkey" FOREIGN KEY ("old_status_id") REFERENCES "inquiry_status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_status_history" ADD CONSTRAINT "inquiry_status_history_new_status_id_fkey" FOREIGN KEY ("new_status_id") REFERENCES "inquiry_status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_status_history" ADD CONSTRAINT "inquiry_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_detail" ADD CONSTRAINT "quotation_detail_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_detail" ADD CONSTRAINT "quotation_detail_mapped_service_id_fkey" FOREIGN KEY ("mapped_service_id") REFERENCES "master_service_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_detail" ADD CONSTRAINT "quotation_detail_mapped_spare_part_id_fkey" FOREIGN KEY ("mapped_spare_part_id") REFERENCES "master_spare_part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_service_item" ADD CONSTRAINT "master_service_item_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "master_service_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_spare_part" ADD CONSTRAINT "master_spare_part_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "master_spare_part_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_detail" ADD CONSTRAINT "purchase_order_detail_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_detail" ADD CONSTRAINT "purchase_order_detail_mapped_service_id_fkey" FOREIGN KEY ("mapped_service_id") REFERENCES "master_service_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_detail" ADD CONSTRAINT "purchase_order_detail_mapped_spare_part_id_fkey" FOREIGN KEY ("mapped_spare_part_id") REFERENCES "master_spare_part"("id") ON DELETE SET NULL ON UPDATE CASCADE;
