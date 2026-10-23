ALTER TABLE "PaymentTransaction" ADD COLUMN "refundRequestKey" TEXT;

CREATE UNIQUE INDEX "PaymentTransaction_refundRequestKey_key"
ON "PaymentTransaction"("refundRequestKey");
