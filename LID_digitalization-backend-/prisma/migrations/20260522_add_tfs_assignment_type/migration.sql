-- CreateEnum
CREATE TYPE "TfsAssignmentType" AS ENUM ('PAID_ASSIGNMENT', 'FREE_ASSIGNMENT', 'DAY_OFF');

-- AlterTable
ALTER TABLE "tfs" ADD COLUMN     "assignment_type" "TfsAssignmentType" NOT NULL DEFAULT 'PAID_ASSIGNMENT',
ALTER COLUMN "service_execution_id" DROP NOT NULL;
