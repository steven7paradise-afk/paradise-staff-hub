UPDATE "users"
SET "name" = initcap(lower(regexp_replace(btrim("name"), '\s+', ' ', 'g')))
WHERE "name" IS NOT NULL
  AND "name" <> initcap(lower(regexp_replace(btrim("name"), '\s+', ' ', 'g')));
