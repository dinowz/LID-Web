/*
  Warnings:

  - You are about to drop the column `customer_name` on the `inquiry` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "inquiry" DROP COLUMN "customer_name",
ADD COLUMN     "code_word_id" INTEGER,
ADD COLUMN     "customer_id" INTEGER;

-- CreateTable
CREATE TABLE "CodeWord" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeWord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CodeWord_code_key" ON "CodeWord"("code");

-- AddForeignKey
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_code_word_id_fkey" FOREIGN KEY ("code_word_id") REFERENCES "CodeWord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
