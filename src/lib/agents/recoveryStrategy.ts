/**
 * Recovery Strategy Agent + Batch Budget Allocator
 *
 * For every RevenueRiskEvent with a RootCauseAnalysis but no Intervention yet:
 *   Step A: Compute candidate actions per event, create zero-cost interventions immediately.
 *   Step B: Collect paid-action candidates, sort by ROI, allocate from budget.
 *
 * This is the project differentiator: economic batch optimization over all events
 * rather than greedy per-event decisions.
 */

import { prisma } from '@/lib/db/prisma';

type CandidateAction = {
  eventId: string;
  customerId: string;
  amountAtRisk: number;
  sourceType: string;
  actionType: string;
  cost: number;
  adjustedProb: number;
  expectedRecoveredRevenue: number;
  netValue: number;
  rootCauseId: string;
};

function cap(value: number, max: number): number {
  return Math.min(value, max);
}

export async function runRecoveryStrategyAndAllocate(): Promise<{
  interventionsCreated: number;
  totalExpectedRecoveredRevenue: number;
  budgetAllocated: number;
  budgetRemaining: number;
}> {
  // Fetch all events with root cause but no intervention
  const events = await prisma.revenueRiskEvent.findMany({
    where: {
      rootCause: { isNot: null },
      interventions: { none: {} },
    },
    include: {
      rootCause: true,
      customer: {
        include: { historyStats: true },
      },
    },
  });

  const stats = await prisma.actionPerformanceStats.findMany();
  const statsMap = new Map(stats.map(s => [s.actionType, s]));

  const freeCandidates: CandidateAction[] = [];
  const paidCandidates: CandidateAction[] = [];

  for (const event of events) {
    const rootCause = event.rootCause!;
    const A = event.amountAtRisk;
    const historyStats = event.customer.historyStats;
    const p = historyStats?.recoveryPropensityScore != null
      ? historyStats.recoveryPropensityScore / 100
      : 0.5;
    const I = rootCause.purchaseIntentScore;

    // Build eligible actions
    type ActionDef = { actionType: string; cost: number; baseProb: number };
    const eligibleActions: ActionDef[] = [];

    // reminder -- always eligible
    eligibleActions.push({ actionType: 'reminder', cost: 2, baseProb: 0.15 });

    // retry -- only for technical/payment issues
    if (rootCause.predictedReason === 'technical_or_payment_issue') {
      eligibleActions.push({ actionType: 'retry', cost: 5, baseProb: 0.30 });
    }

    // discount_5 -- only if not invoice
    if (event.sourceType !== 'invoice') {
      eligibleActions.push({
        actionType: 'discount_5',
        cost: 0.05 * A,
        baseProb: cap(0.15 + 0.5 * I, 0.9),
      });
    }

    // discount_10 -- only if not invoice
    if (event.sourceType !== 'invoice') {
      eligibleActions.push({
        actionType: 'discount_10',
        cost: 0.10 * A,
        baseProb: cap(0.15 + 0.6 * I, 0.92),
      });
    }

    // waiver -- only for invoices
    if (event.sourceType === 'invoice') {
      const invoice = await prisma.invoice.findUnique({
        where: { id: event.sourceId },
      });
      const waiveCost = invoice?.lateFeeAmount ?? 0;
      eligibleActions.push({
        actionType: 'waiver',
        cost: waiveCost,
        baseProb: cap(0.15 + 0.6 * p, 1),
      });
    }

    // escalation -- always, as fallback
    eligibleActions.push({ actionType: 'escalation', cost: 0, baseProb: 0.5 });

    // Compute adjusted metrics for each eligible action
    const scored = eligibleActions.map((action) => {
      let blendedBaseProb = action.baseProb;
      const stat = statsMap.get(action.actionType);
      if (stat && stat.sampleSize >= 5) {
        blendedBaseProb = 0.6 * action.baseProb + 0.4 * stat.observedSuccessRate;
      }
      const adjustedProb = blendedBaseProb * (0.5 + 0.5 * p);
      const expectedRecoveredRevenue = A * adjustedProb;
      const netValue = expectedRecoveredRevenue - action.cost;
      return { ...action, adjustedProb, expectedRecoveredRevenue, netValue };
    });


    // Pick the best action by netValue
    scored.sort((a, b) => b.netValue - a.netValue);
    const best = scored[0];

    const candidate: CandidateAction = {
      eventId: event.id,
      customerId: event.customerId,
      amountAtRisk: A,
      sourceType: event.sourceType,
      actionType: best.actionType,
      cost: best.cost,
      adjustedProb: best.adjustedProb,
      expectedRecoveredRevenue: best.expectedRecoveredRevenue,
      netValue: best.netValue,
      rootCauseId: rootCause.id,
    };

    const isPaid = ['discount_5', 'discount_10', 'waiver'].includes(best.actionType);

    if (isPaid) {
      paidCandidates.push(candidate);
    } else {
      freeCandidates.push(candidate);
    }
  }

  // Step A: Create free/zero-cost interventions immediately
  let interventionsCreated = 0;
  let totalExpectedRecoveredRevenue = 0;

  for (const c of freeCandidates) {
    const intervention = await prisma.intervention.create({
      data: {
        revenueRiskEventId: c.eventId,
        customerId: c.customerId,
        actionType: c.actionType,
        cost: c.cost,
        expectedRecoveryProbability: c.adjustedProb,
        expectedRecoveredRevenue: c.expectedRecoveredRevenue,
        status: 'pending',
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'Intervention',
        entityId: intervention.id,
        action: 'created',
        actor: 'RecoveryStrategyAgent',
        details: {
          eventId: c.eventId,
          actionType: c.actionType,
          cost: c.cost,
          netValue: c.netValue,
          source: 'free_action',
        },
      },
    });

    interventionsCreated++;
    totalExpectedRecoveredRevenue += c.expectedRecoveredRevenue;
  }

  // Step B: Batch budget allocator for paid actions
  // Sort by ROI descending (netValue / cost); guard division by zero
  paidCandidates.sort((a, b) => {
    const roiA = a.cost > 0 ? a.netValue / a.cost : 0;
    const roiB = b.cost > 0 ? b.netValue / b.cost : 0;
    return roiB - roiA;
  });

  // Fetch current budget allocation
  const budget = await prisma.budgetAllocation.findFirst({
    where: {
      periodStart: { lte: new Date() },
      periodEnd: { gte: new Date() },
    },
  });

  let budgetAllocated = budget?.allocatedSoFar ?? 0;
  const totalBudget = budget?.totalBudget ?? 0;

  for (const c of paidCandidates) {
    const remaining = totalBudget - budgetAllocated;
    let chosenAction = c.actionType;
    let chosenCost = c.cost;
    let chosenProb = c.adjustedProb;
    let chosenERR = c.expectedRecoveredRevenue;
    let wasDowngraded = false;

    if (remaining >= c.cost) {
      // Approve paid action
      if (budget) {
        budgetAllocated += c.cost;
        await prisma.budgetAllocation.update({
          where: { id: budget.id },
          data: { allocatedSoFar: budgetAllocated },
        });
      }
    } else {
      // Budget exhausted -- fall back to cheapest eligible free action
      wasDowngraded = true;
      const A = c.amountAtRisk;
      const historyStats = await prisma.customerHistoryStats.findUnique({
        where: { customerId: c.customerId },
      });
      const p = historyStats?.recoveryPropensityScore != null
        ? historyStats.recoveryPropensityScore / 100
        : 0.5;

      // Fallback: prefer retry if technical issue, else reminder
      const rootCause = await prisma.rootCauseAnalysis.findUnique({
        where: { id: c.rootCauseId },
      });
      const isTechnical = rootCause?.predictedReason === 'technical_or_payment_issue';
      if (isTechnical) {
        chosenAction = 'retry';
        chosenCost = 5;
      } else {
        chosenAction = 'reminder';
        chosenCost = 2;
      }
      const baseProb = isTechnical ? 0.30 : 0.15;
      chosenProb = baseProb * (0.5 + 0.5 * p);
      chosenERR = A * chosenProb;
    }

    const intervention = await prisma.intervention.create({
      data: {
        revenueRiskEventId: c.eventId,
        customerId: c.customerId,
        actionType: chosenAction,
        cost: chosenCost,
        expectedRecoveryProbability: chosenProb,
        expectedRecoveredRevenue: chosenERR,
        status: 'pending',
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'Intervention',
        entityId: intervention.id,
        action: wasDowngraded ? 'created_budget_downgraded' : 'created',
        actor: 'RecoveryStrategyAgent',
        details: {
          eventId: c.eventId,
          actionType: chosenAction,
          originalAction: wasDowngraded ? c.actionType : undefined,
          cost: chosenCost,
          netValue: c.netValue,
          wasDowngraded,
          source: 'budget_allocator',
        },
      },
    });

    interventionsCreated++;
    totalExpectedRecoveredRevenue += chosenERR;
  }

  // Refresh budget to get final state
  const finalBudget = budget
    ? await prisma.budgetAllocation.findUnique({ where: { id: budget.id } })
    : null;

  return {
    interventionsCreated,
    totalExpectedRecoveredRevenue,
    budgetAllocated: finalBudget?.allocatedSoFar ?? budgetAllocated,
    budgetRemaining: totalBudget - (finalBudget?.allocatedSoFar ?? budgetAllocated),
  };
}
