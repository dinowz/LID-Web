-- CreateTable
CREATE TABLE "po_status_history" (
    "id" BIGSERIAL NOT NULL,
    "po_id" BIGINT NOT NULL,
    "old_status" TEXT,
    "new_status" TEXT NOT NULL,
    "change_note" TEXT,
    "changed_by" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "po_status_history_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "po_status_history" ADD CONSTRAINT "po_status_history_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_status_history" ADD CONSTRAINT "po_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
