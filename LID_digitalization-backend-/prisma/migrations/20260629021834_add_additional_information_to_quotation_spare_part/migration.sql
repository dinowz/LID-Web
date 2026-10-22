/*
  Warnings:

  - The values [SALES] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `inquiry` on the `pipeline_target` table. All the data in the column will be lost.
  - You are about to drop the column `po` on the `pipeline_target` table. All the data in the column will be lost.
  - You are about to drop the column `quotation` on the `pipeline_target` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'PROCUREMENT', 'LOGISTIC', 'FINANCE', 'PROJECT', 'TFS', 'SPARE_PART', 'SERVICE', 'MANAGEMENT');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'SPARE_PART';
COMMIT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'SPARE_PART';

-- AlterTable
ALTER TABLE "inquiry_detail" ADD COLUMN     "service_sub_type" VARCHAR(30);

-- AlterTable
ALTER TABLE "pipeline_target" DROP COLUMN "inquiry",
DROP COLUMN "po",
DROP COLUMN "quotation",
ADD COLUMN     "exchange_rate_eur" DECIMAL(18,2) NOT NULL DEFAULT 16500,
ADD COLUMN     "exchange_rate_usd" DECIMAL(18,2) NOT NULL DEFAULT 15000,
ADD COLUMN     "role_targets" JSONB,
ADD COLUMN     "target" DECIMAL(20,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quotation_spare_part" ADD COLUMN     "additional_information" TEXT;
