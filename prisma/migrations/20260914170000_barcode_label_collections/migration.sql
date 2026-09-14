CREATE TABLE "barcode_label_collections" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "fields" JSONB NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "barcode_label_collections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "barcode_label_collections_name_key" ON "barcode_label_collections"("name");
CREATE INDEX "barcode_label_collections_created_at_idx" ON "barcode_label_collections"("created_at");

ALTER TABLE "barcode_label_collections"
ADD CONSTRAINT "barcode_label_collections_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "barcode_labels"
ADD COLUMN "collection_id" TEXT,
ADD COLUMN "details" JSONB;

CREATE INDEX "barcode_labels_collection_id_idx" ON "barcode_labels"("collection_id");

ALTER TABLE "barcode_labels"
ADD CONSTRAINT "barcode_labels_collection_id_fkey"
FOREIGN KEY ("collection_id") REFERENCES "barcode_label_collections"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "barcode_label_collections" ("id", "name", "fields", "is_default", "updated_at") VALUES
('default_clip_in', 'Clip-in', '[{"key":"color","label":"Colore","placeholder":"Biondo","required":true},{"key":"typology","label":"Tipologia","placeholder":"Clip-in","required":true},{"key":"length","label":"Lunghezza","placeholder":"55 cm","required":true},{"key":"productCode","label":"Codice","placeholder":"L","required":true},{"key":"weight","label":"Peso","placeholder":"190 g","required":true},{"key":"bands","label":"Fasce","placeholder":"9","required":true},{"key":"price","label":"Prezzo","placeholder":"550 €","required":true}]'::jsonb, true, CURRENT_TIMESTAMP),
('default_biadesivo', 'Biadesivo', '[{"key":"color","label":"Colore","placeholder":"Biondo nocciola","required":true},{"key":"weight","label":"Peso","placeholder":"50 g","required":true},{"key":"length","label":"Lunghezza","placeholder":"55 cm","required":true},{"key":"productCode","label":"Codice","placeholder":"L","required":true},{"key":"typology","label":"Tipologia","placeholder":"Biadesivo","required":true}]'::jsonb, true, CURRENT_TIMESTAMP),
('default_microcheratina', 'Microcheratina', '[{"key":"color","label":"Colore","placeholder":"Biondo platino perla","required":true},{"key":"weight","label":"Peso","placeholder":"50 g","required":true},{"key":"length","label":"Lunghezza","placeholder":"55 cm","required":true},{"key":"productCode","label":"Codice","placeholder":"L","required":true},{"key":"typology","label":"Tipologia","placeholder":"Microcheratina","required":true}]'::jsonb, true, CURRENT_TIMESTAMP),
('default_tessitura', 'Tessitura', '[{"key":"color","label":"Colore","placeholder":"Biondo cenere","required":true},{"key":"weight","label":"Peso","placeholder":"50 g","required":true},{"key":"length","label":"Lunghezza","placeholder":"55 cm","required":true},{"key":"productCode","label":"Codice","placeholder":"L","required":true},{"key":"typology","label":"Tipologia","placeholder":"Tessitura","required":true}]'::jsonb, true, CURRENT_TIMESTAMP),
('default_altro', 'Altro', '[{"key":"color","label":"Colore","placeholder":"Descrizione colore","required":true},{"key":"weight","label":"Peso","placeholder":"50 g o non applicabile","required":true},{"key":"length","label":"Lunghezza","placeholder":"55 cm o non applicabile","required":true},{"key":"productCode","label":"Codice","placeholder":"Codice prodotto","required":true},{"key":"typology","label":"Tipologia","placeholder":"Altro","required":true}]'::jsonb, true, CURRENT_TIMESTAMP);

UPDATE "barcode_labels"
SET
  "collection_id" = CASE
    WHEN LOWER(COALESCE("typology", '')) = 'clip' THEN 'default_clip_in'
    WHEN LOWER(COALESCE("typology", '')) = 'biadesivo' THEN 'default_biadesivo'
    WHEN LOWER(COALESCE("typology", '')) = 'microcheratina' THEN 'default_microcheratina'
    WHEN LOWER(COALESCE("typology", '')) IN ('tessitura', 'tessiture') THEN 'default_tessitura'
    ELSE 'default_altro'
  END,
  "details" = jsonb_strip_nulls(jsonb_build_object(
    'color', "color",
    'weight', "weight",
    'length', "length",
    'productCode', "product_code",
    'typology', "typology"
  ));
