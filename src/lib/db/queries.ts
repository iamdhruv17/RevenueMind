/**
 * Shared dashboard data-access functions.
 * Single source of truth — imported by both the landing page and the API routes.
 * If the filter logic ever changes, it changes here and nowhere else.
 */
import { prisma } from './prisma';

export interface DashboardSummary {
  revenueAtRisk: number;
  expectedRecoverable: number;
  recoveryRatePct: number;
}

/**
 * Returns the three headline numbers shown on both the landing page hero card
 * and the dashboard overview. The expectedRecoverable filter must be kept
 * identical in both contexts — status IN (pending, approved) — to exclude
 * rejected interventions and unreviewed escalations.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [riskAgg, interventionAgg] = await Promise.all([
    prisma.revenueRiskEvent.aggregate({
      _sum: { amountAtRisk: true },
    }),
    prisma.intervention.aggregate({
      _sum: { expectedRecoveredRevenue: true },
      where: { status: { in: ['pending', 'approved'] } },
    }),
  ]);

  const revenueAtRisk = Number(riskAgg._sum.amountAtRisk ?? 0);
  const expectedRecoverable = Number(interventionAgg._sum.expectedRecoveredRevenue ?? 0);
  const recoveryRatePct =
    revenueAtRisk > 0 ? (expectedRecoverable / revenueAtRisk) * 100 : 0;

  return { revenueAtRisk, expectedRecoverable, recoveryRatePct };
}

/**
 * Returns the prediction-vs-actual gap from the learning loop as a
 * percentage-point difference. Returns null if there are no resolved
 * interventions to compare against.
 */
export async function getLearningGap(): Promise<number | null> {
  const interventions = await prisma.intervention.findMany({
    where: { outcomeStatus: { not: 'pending' } },
    select: {
      expectedRecoveryProbability: true,
      outcomeStatus: true,
    },
  });

  const total = interventions.length;
  if (total === 0) return null;

  const totalExpected = interventions.reduce(
    (sum, i) => sum + i.expectedRecoveryProbability,
    0
  );
  const totalRecovered = interventions.filter(i => i.outcomeStatus === 'recovered').length;

  const predictedAvg = totalExpected / total;
  const observedAvg = totalRecovered / total;
  return Math.abs(predictedAvg - observedAvg) * 100;
}
