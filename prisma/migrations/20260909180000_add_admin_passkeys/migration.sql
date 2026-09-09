CREATE TABLE "webauthn_credentials" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "credential_id" TEXT NOT NULL,
  "public_key" BYTEA NOT NULL,
  "counter" BIGINT NOT NULL DEFAULT 0,
  "transports" TEXT[] NOT NULL,
  "device_type" TEXT,
  "backed_up" BOOLEAN NOT NULL DEFAULT false,
  "label" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMP(3),
  CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webauthn_challenges" (
  "id" TEXT NOT NULL,
  "challenge" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "user_id" TEXT,
  "device_id" TEXT,
  "rp_id" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webauthn_challenges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "passkey_grants" (
  "id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "passkey_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webauthn_credentials_credential_id_key" ON "webauthn_credentials"("credential_id");
CREATE INDEX "webauthn_credentials_user_id_idx" ON "webauthn_credentials"("user_id");
CREATE UNIQUE INDEX "webauthn_challenges_challenge_key" ON "webauthn_challenges"("challenge");
CREATE INDEX "webauthn_challenges_user_id_purpose_expires_at_idx" ON "webauthn_challenges"("user_id", "purpose", "expires_at");
CREATE INDEX "webauthn_challenges_device_id_purpose_expires_at_idx" ON "webauthn_challenges"("device_id", "purpose", "expires_at");
CREATE UNIQUE INDEX "passkey_grants_token_hash_key" ON "passkey_grants"("token_hash");
CREATE INDEX "passkey_grants_user_id_purpose_expires_at_idx" ON "passkey_grants"("user_id", "purpose", "expires_at");

ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webauthn_challenges" ADD CONSTRAINT "webauthn_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "passkey_grants" ADD CONSTRAINT "passkey_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
