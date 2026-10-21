CREATE TABLE "google_business_connections" (
 "id" TEXT PRIMARY KEY DEFAULT 'primary', "tokens_encrypted" TEXT NOT NULL,
 "location_name" TEXT, "location_title" TEXT, "average_rating" DOUBLE PRECISION, "total_reviews" INTEGER,
 "synced_at" TIMESTAMP(3), "attempted_at" TIMESTAMP(3), "sync_error" TEXT, "lock_until" TIMESTAMP(3), "lock_owner" TEXT
);
CREATE TABLE "google_business_oauth_states" (
 "hash" TEXT PRIMARY KEY, "user_id" TEXT NOT NULL, "verifier" TEXT NOT NULL, "expires_at" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "reviews" (
 "id" TEXT PRIMARY KEY, "location_name" TEXT NOT NULL, "rating" INTEGER NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
 "comment" TEXT, "reviewer_name" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL, "updated_at" TIMESTAMP(3) NOT NULL,
 "reply_text" TEXT, "replied_at" TIMESTAMP(3),
 "match_type" TEXT CHECK ("match_type" IN ('testo','manuale')), "manual_match" BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX "reviews_location_name_created_at_id_idx" ON "reviews" ("location_name", "created_at", "id");

CREATE TABLE "review_staff" (
 "review_id" TEXT NOT NULL REFERENCES "reviews"("id") ON DELETE CASCADE,
 "staff_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 PRIMARY KEY ("review_id", "staff_id")
);
CREATE INDEX "review_staff_staff_id_idx" ON "review_staff" ("staff_id");
