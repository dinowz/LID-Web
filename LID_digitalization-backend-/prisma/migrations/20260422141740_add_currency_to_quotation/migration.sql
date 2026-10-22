-- AlterTable
ALTER TABLE "quotation" ADD COLUMN     "currency" VARCHAR(10) NOT NULL DEFAULT 'IDR',
ADD COLUMN     "exchange_rate" DECIMAL(18,2) NOT NULL DEFAULT 1;
