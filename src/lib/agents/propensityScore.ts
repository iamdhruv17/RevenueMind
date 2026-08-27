/**
 * Customer Behavior Agent
 *
 * Computes a recoveryPropensityScore [0-100] for each CustomerHistoryStats row.
 *
 * Formula:
 *   successRate    = successfulPayments / totalPayments  (default 0.5 if no payments)
 *   recoveryRate   = min(previousRecoveries / max(previousAbandonments, 1), 1)
 *   responsiveness = avgReminderResponseDays == null
 *                      ? 0.5
 *                      : clamp(1 - avgReminderResponseDays / 10, 0, 1)
 *
 *   score = round(100 * (0.5 * successRate + 0.3 * recoveryRate + 0.2 * responsiveness))
 *
 * NOTE: recoveryPropensityScore is INTERNAL-ONLY -- never expose it in
 * customer-facing API responses.
 */

import { prisma } from '@/lib/db/prisma';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export async function computePropensityScores(): Promise<{ updated: number }> {
  const allStats = await prisma.customerHistoryStats.findMany();

  let updated = 0;

  for (const stats of allStats) {
    const successRate =
      stats.totalPayments > 0
        ? stats.successfulPayments / stats.totalPayments
        : 0.5;

    const recoveryRate = Math.min(
      stats.previousRecoveries / Math.max(stats.previousAbandonments, 1),
      1
    );

    const responsiveness =
      stats.avgReminderResponseDays == null
        ? 0.5
        : clamp(1 - stats.avgReminderResponseDays / 10, 0, 1);

    const propensityScore = Math.round(
      100 * (0.5 * successRate + 0.3 * recoveryRate + 0.2 * responsiveness)
    );

    await prisma.customerHistoryStats.update({
      where: { id: stats.id },
      data: { recoveryPropensityScore: propensityScore },
    });

    updated++;
  }

  // Single AuditLog summary entry for the batch run
  await prisma.auditLog.create({
    data: {
      entityType: 'CustomerHistoryStats',
      entityId: 'batch',
      action: 'propensity_scores_updated',
      actor: 'CustomerBehaviorAgent',
      details: { updatedCount: updated },
    },
  });

  return { updated };
}
