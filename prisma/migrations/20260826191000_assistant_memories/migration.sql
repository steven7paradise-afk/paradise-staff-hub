CREATE TABLE "assistant_memories" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'REGOLA',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deactivated_at" TIMESTAMP(3),

    CONSTRAINT "assistant_memories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assistant_memories_content_hash_key" ON "assistant_memories"("content_hash");
CREATE INDEX "assistant_memories_active_updated_at_idx" ON "assistant_memories"("active", "updated_at");
CREATE INDEX "assistant_memories_created_by_id_created_at_idx" ON "assistant_memories"("created_by_id", "created_at");

ALTER TABLE "assistant_memories"
ADD CONSTRAINT "assistant_memories_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
