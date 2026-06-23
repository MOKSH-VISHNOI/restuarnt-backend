-- CreateTable
CREATE TABLE "DailyTokenCounter" (
    "id" SERIAL NOT NULL,
    "counterDate" TIMESTAMP(3) NOT NULL,
    "lastToken" INTEGER NOT NULL,

    CONSTRAINT "DailyTokenCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyTokenCounter_counterDate_key" ON "DailyTokenCounter"("counterDate");
