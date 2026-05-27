ALTER TABLE "users" ADD COLUMN "pin_lookup" TEXT;
CREATE UNIQUE INDEX "users_pin_lookup_key" ON "users"("pin_lookup");
