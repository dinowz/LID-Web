-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
