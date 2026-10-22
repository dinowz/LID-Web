-- CreateEnum
CREATE TYPE "ForecastType" AS ENUM ('WORST', 'NORMAL', 'BEST');

-- AlterTable
ALTER TABLE "quotation" ADD COLUMN "forecast" "ForecastType" NOT NULL DEFAULT 'NORMAL';
