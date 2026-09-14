CREATE TABLE "barcode_labels" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT,
  "format" TEXT NOT NULL DEFAULT 'CODE128',
  "print_count" INTEGER NOT NULL DEFAULT 0,
  "last_printed_at" TIMESTAMP(3),
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "barcode_labels_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "barcode_labels_print_count_check" CHECK ("print_count" >= 0)
);

CREATE UNIQUE INDEX "barcode_labels_code_key" ON "barcode_labels"("code");
CREATE INDEX "barcode_labels_created_at_idx" ON "barcode_labels"("created_at");
CREATE INDEX "barcode_labels_title_idx" ON "barcode_labels"("title");

ALTER TABLE "barcode_labels"
ADD CONSTRAINT "barcode_labels_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
