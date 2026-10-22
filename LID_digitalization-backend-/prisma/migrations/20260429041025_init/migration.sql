-- AlterTable
ALTER TABLE "delivery" ADD COLUMN     "dimensions" VARCHAR(100),
ADD COLUMN     "freight_cost" DECIMAL(18,2),
ADD COLUMN     "weight_kg" DECIMAL(10,2);
