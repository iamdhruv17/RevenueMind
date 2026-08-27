/**
 * Root Cause Agent
 *
 * For every RevenueRiskEvent without an existing RootCauseAnalysis,
 * applies signal-to-label mapping based on sourceType and observable data.
 *
 * Labels map to real, observable signals -- not guesses about feelings.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export async function runRootCauseAnalysis(): Promise<{ analyzed: number }> {
  // Fetch events that don't have a root cause analysis yet
  const events = await prisma.revenueRiskEvent.findMany({
    where: { rootCause: null },
  });

  let analyzed = 0;

  for (const event of events) {
    let predictedReason: string;
    let confidence: number;
    let purchaseIntentScore: number;
    let signalsUsed: Prisma.InputJsonValue;

    if (event.sourceType === 'transaction') {
      const tx = await prisma.transaction.findUnique({
        where: { id: event.sourceId },
      });
      if (!tx) continue;

      predictedReason = 'technical_or_payment_issue';
      confidence = 0.85;
      purchaseIntentScore = 0.8;
      signalsUsed = { failureReasonCode: tx.failureReasonCode };

    } else if (event.sourceType === 'checkout') {
      const checkout = await prisma.checkoutSession.findUnique({
        where: { id: event.sourceId },
      });
      if (!checkout) continue;

      const t = checkout.timeOnCheckoutSec ?? 60; // default mid-range if null
      signalsUsed = { timeOnCheckoutSec: t, cartValue: checkout.cartValue };

      if (t < 30) {
        predictedReason = 'distracted_or_interrupted';
        confidence = 0.6;
        purchaseIntentScore = 0.4;
      } else if (t <= 180) {
        predictedReason = 'normal_dropout';
        confidence = 0.5;
        purchaseIntentScore = 0.5;
      } else {
        predictedReason = 'price_sensitivity_or_comparison';
        confidence = 0.7;
        purchaseIntentScore = 0.7;
      }

    } else if (event.sourceType === 'invoice') {
      const invoice = await prisma.invoice.findUnique({
        where: { id: event.sourceId },
      });
      if (!invoice) continue;

      const historyStats = await prisma.customerHistoryStats.findUnique({
        where: { customerId: event.customerId },
      });

      const rawSuccessRate =
        historyStats && historyStats.totalPayments > 0
          ? historyStats.successfulPayments / historyStats.totalPayments
          : 0.5;

      const daysOverdue = invoice.dueDate
        ? Math.max(0, Math.floor((Date.now() - invoice.dueDate.getTime()) / 86_400_000))
        : 0;

      signalsUsed = { successRate: rawSuccessRate, daysOverdue };

      if (rawSuccessRate >= 0.8) {
        predictedReason = 'cash_flow_delay_likely_to_pay';
        confidence = 0.75;
        purchaseIntentScore = 0.85;
      } else {
        predictedReason = 'collection_risk';
        confidence = 0.6;
        purchaseIntentScore = 0.4;
      }

    } else {
      // Unknown source type -- skip
      continue;
    }

    const analysis = await prisma.rootCauseAnalysis.create({
      data: {
        revenueRiskEventId: event.id,
        predictedReason,
        confidence,
        purchaseIntentScore,
        signalsUsed,
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'RootCauseAnalysis',
        entityId: analysis.id,
        action: 'analyzed',
        actor: 'RootCauseAgent',
        details: {
          revenueRiskEventId: event.id,
          sourceType: event.sourceType,
          predictedReason,
          confidence,
          signalsUsed,
        },
      },
    });

    analyzed++;
  }

  return { analyzed };
}
