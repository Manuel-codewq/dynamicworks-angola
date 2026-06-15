ALTER TABLE "AccessLog" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "AccessLog" ADD COLUMN IF NOT EXISTS "city" TEXT;
CREATE INDEX IF NOT EXISTS "AccessLog_action_createdAt_idx" ON "AccessLog"("action", "createdAt");
