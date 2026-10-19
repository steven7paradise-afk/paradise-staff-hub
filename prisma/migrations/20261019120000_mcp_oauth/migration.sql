-- CreateTable
CREATE TABLE "mcp_clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirect_uris" TEXT[],
    "auth_method" TEXT NOT NULL,
    "secret_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_authorizations" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "csrf_hash" TEXT NOT NULL,
    "code_hash" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "mcp_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_grants" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "mcp_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_tokens" (
    "id" TEXT NOT NULL,
    "grant_id" TEXT NOT NULL,
    "access_hash" TEXT NOT NULL,
    "refresh_hash" TEXT NOT NULL,
    "access_expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_expires_at" TIMESTAMP(3) NOT NULL,
    "rotated_at" TIMESTAMP(3),

    CONSTRAINT "mcp_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_rate_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_rate_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_authorizations_code_hash_key" ON "mcp_authorizations"("code_hash");

-- CreateIndex
CREATE INDEX "mcp_authorizations_expires_at_idx" ON "mcp_authorizations"("expires_at");

-- CreateIndex
CREATE INDEX "mcp_grants_user_id_idx" ON "mcp_grants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_tokens_access_hash_key" ON "mcp_tokens"("access_hash");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_tokens_refresh_hash_key" ON "mcp_tokens"("refresh_hash");

-- CreateIndex
CREATE INDEX "mcp_rate_buckets_expires_at_idx" ON "mcp_rate_buckets"("expires_at");

-- AddForeignKey
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "mcp_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
