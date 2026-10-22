-- CreateTable
CREATE TABLE "quotation_status_history" (
    "id" BIGSERIAL NOT NULL,
    "quotation_id" BIGINT NOT NULL,
    "old_status" "EntityStatus",
    "new_status" "EntityStatus" NOT NULL,
    "change_note" TEXT,
    "changed_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_status_history_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "quotation_status_history" ADD CONSTRAINT "quotation_status_history_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_status_history" ADD CONSTRAINT "quotation_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
