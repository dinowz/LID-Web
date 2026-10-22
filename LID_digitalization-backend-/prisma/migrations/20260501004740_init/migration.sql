-- AlterTable
ALTER TABLE "project_execution" ADD COLUMN     "issue" TEXT,
ADD COLUMN     "next_action" TEXT,
ADD COLUMN     "pic_name" VARCHAR(150),
ADD COLUMN     "progress_percentage" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE "project_execution_history" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT NOT NULL,
    "old_status" TEXT,
    "new_status" TEXT NOT NULL,
    "old_progress" INTEGER,
    "new_progress" INTEGER NOT NULL,
    "progress_note" TEXT,
    "issue" TEXT,
    "next_action" TEXT,
    "changed_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_execution_history_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "project_execution_history" ADD CONSTRAINT "project_execution_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project_execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_execution_history" ADD CONSTRAINT "project_execution_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
