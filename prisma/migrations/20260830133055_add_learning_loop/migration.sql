-- AlterTable
ALTER TABLE "Intervention" ADD COLUMN     "actualRecoveredAmount" DOUBLE PRECISION,
ADD COLUMN     "outcomeRecordedAt" TIMESTAMP(3),
ADD COLUMN     "outcomeStatus" TEXT NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "ActionPerformanceStats" (
    "id" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "observedSuccessRate" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionPerformanceStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActionPerformanceStats_actionType_key" ON "ActionPerformanceStats"("actionType");
