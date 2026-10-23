CREATE TYPE "GatewayPaymentStatus" AS ENUM (
    'PENDING',
    'AUTHORIZED',
    'FAILED',
    'CAPTURED',
    'REFUNDED',
    'PARTIALLY_REFUNDED'
);

CREATE TABLE "PaymentTransaction" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "gatewayPaymentId" TEXT NOT NULL,
    "status" "GatewayPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "method" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentTransaction_gatewayPaymentId_key"
    ON "PaymentTransaction"("gatewayPaymentId");
CREATE INDEX "PaymentTransaction_paymentId_status_idx"
    ON "PaymentTransaction"("paymentId", "status");
CREATE INDEX "PaymentTransaction_status_idx"
    ON "PaymentTransaction"("status");

ALTER TABLE "PaymentTransaction"
    ADD CONSTRAINT "PaymentTransaction_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the latest gateway payment ID already known for each Razorpay order.
-- Older individual retries cannot be recovered from the current Payment rows.
INSERT INTO "PaymentTransaction" (
    "paymentId",
    "gatewayPaymentId",
    "status",
    "amountMinor",
    "currency",
    "method",
    "createdAt",
    "updatedAt"
)
SELECT
    p."id",
    p."gatewayPaymentId",
    CASE p."status"
        WHEN 'SUCCESS' THEN 'CAPTURED'::"GatewayPaymentStatus"
        WHEN 'FAILED' THEN 'FAILED'::"GatewayPaymentStatus"
        WHEN 'CANCELLED' THEN 'FAILED'::"GatewayPaymentStatus"
        WHEN 'REFUNDED' THEN 'REFUNDED'::"GatewayPaymentStatus"
        WHEN 'PARTIALLY_REFUNDED' THEN 'PARTIALLY_REFUNDED'::"GatewayPaymentStatus"
        ELSE 'PENDING'::"GatewayPaymentStatus"
    END,
    ROUND(p."amount" * 100)::INTEGER,
    'INR',
    p."method"::TEXT,
    p."createdAt",
    p."updatedAt"
FROM "Payment" AS p
WHERE p."gateway" = 'RAZORPAY'
  AND p."gatewayPaymentId" IS NOT NULL
ON CONFLICT ("gatewayPaymentId") DO NOTHING;
