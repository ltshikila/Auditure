-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "compGrantedAt" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "compExpiresAt" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "compReason" TEXT;

-- CreateIndex
CREATE INDEX "subscriptions_compExpiresAt_idx" ON "subscriptions"("compExpiresAt");
