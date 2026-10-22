/*
  Warnings:

  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `stock_available` on the `quotation_detail` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "roles" "Role"[] DEFAULT ARRAY['SPARE_PART']::"Role"[];

-- AlterTable
ALTER TABLE "delivery" ADD COLUMN     "pic" VARCHAR(200);

-- AlterTable
ALTER TABLE "quotation_detail" DROP COLUMN "stock_available";
