-- Web Push (VAPID) subscriptions per user.
-- One row = one browser tab/profile that opted in to push.
CREATE TABLE "web_push_subscriptions" (
  "id"           TEXT NOT NULL,
  "user_id"      TEXT NOT NULL,
  "endpoint"     TEXT NOT NULL,
  "p256dh"       TEXT NOT NULL,
  "auth"         TEXT NOT NULL,
  "user_agent"   TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMP(3),
  CONSTRAINT "web_push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- A given push endpoint is unique across the whole table (browsers issue one
-- per subscription). We use this to upsert.
CREATE UNIQUE INDEX "web_push_subscriptions_endpoint_key"
  ON "web_push_subscriptions"("endpoint");

CREATE INDEX "web_push_subscriptions_user_id_idx"
  ON "web_push_subscriptions"("user_id");

ALTER TABLE "web_push_subscriptions"
  ADD CONSTRAINT "web_push_subscriptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
