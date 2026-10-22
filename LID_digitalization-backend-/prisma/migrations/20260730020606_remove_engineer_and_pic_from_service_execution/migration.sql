/*
  Warnings:

  - You are about to drop the column `engineer_name` on the `service_execution` table. All the data in the column will be lost.
  - You are about to drop the column `pic_name` on the `service_execution` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "service_execution" DROP COLUMN "engineer_name",
DROP COLUMN "pic_name";
