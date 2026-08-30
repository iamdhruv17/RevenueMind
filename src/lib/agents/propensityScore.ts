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
 * Uses a single raw SQL UPDATE to compute and set all scores in one round-trip.
 *
 * NOTE: recoveryPropensityScore is INTERNAL-ONLY -- never expose it in
 * customer-facing API responses.
 */

import { prisma } from '@/lib/db/prisma';

export async function computePropensityScores(): Promise<{ updated: number }> {
  // Single SQL statement computes and updates all scores in one round-trip.
  // The formula is evaluated entirely in Postgres, avoiding N individual UPDATE queries.
  const result = await prisma.$executeRaw`
    UPDATE "CustomerHistoryStats"
    SET "recoveryPropensityScore" = ROUND(
      100 * (
        0.5 * (
          CASE WHEN "totalPayments" > 0
               THEN "successfulPayments"::float / "totalPayments"
               ELSE 0.5
          END
        )
        + 0.3 * LEAST(
          "previousRecoveries"::float / GREATEST("previousAbandonments", 1),
          1
        )
        + 0.2 * (
          CASE WHEN "avgReminderResponseDays" IS NULL
               THEN 0.5
               ELSE GREATEST(0, LEAST(1, 1.0 - "avgReminderResponseDays" / 10.0))
          END
        )
      )
    ),
    "updatedAt" = NOW()
  `;

  // Single AuditLog summary entry for the batch run
  await prisma.auditLog.create({
    data: {
      entityType: 'CustomerHistoryStats',
      entityId: 'batch',
      action: 'propensity_scores_updated',
      actor: 'CustomerBehaviorAgent',
      details: { updatedCount: result },
    },
  });

  return { updated: result };
}
