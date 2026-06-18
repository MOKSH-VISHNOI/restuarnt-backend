/*
  Warnings:

  - A unique constraint covering the columns `[tokenNumber]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tokenNumber` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "tokenNumber" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Order_tokenNumber_key" ON "Order"("tokenNumber");
