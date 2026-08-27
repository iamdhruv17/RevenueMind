import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    // revenueAtRisk
    const riskEvents = await prisma.revenueRiskEvent.aggregate({
      _sum: { amountAtRisk: true },
      _count: { customerId: true }
    });
    const revenueAtRisk = riskEvents._sum.amountAtRisk || 0;

    // expectedRecoverable
    const interventions = await prisma.intervention.aggregate({
      _sum: { expectedRecoveredRevenue: true }
    });
    const expectedRecoverable = interventions._sum.expectedRecoveredRevenue || 0;

    // recoveryRatePct
    const recoveryRatePct = revenueAtRisk > 0 ? (expectedRecoverable / revenueAtRisk) * 100 : 0;

    // customersAtRisk (distinct)
    const customersAtRiskGroups = await prisma.revenueRiskEvent.groupBy({
      by: ['customerId'],
    });
    const customersAtRisk = customersAtRiskGroups.length;

    // budget
    const now = new Date();
    const currentAllocation = await prisma.budgetAllocation.findFirst({
      where: {
        periodStart: { lte: now },
        periodEnd: { gte: now }
      }
    });
    const budgetTotal = currentAllocation?.totalBudget || 50000;
    const budgetAllocated = currentAllocation?.allocatedSoFar || 0;
    const budgetRemaining = budgetTotal - budgetAllocated;

    // riskBySourceType
    const sourceTypeGroups = await prisma.revenueRiskEvent.groupBy({
      by: ['sourceType'],
      _sum: { amountAtRisk: true }
    });
    const riskBySourceType = { transaction: 0, checkout: 0, invoice: 0 };
    sourceTypeGroups.forEach(g => {
      if (g.sourceType in riskBySourceType) {
        // @ts-expect-error - indexing object with string
        riskBySourceType[g.sourceType] += g._sum.amountAtRisk || 0;
      }
    });

    // interventionsByAction
    const interventionsList = await prisma.intervention.findMany({
      include: {
        // Need to check audit logs to distinguish escalation types
      }
    });

    const interventionsByAction = {
      reminder: 0, retry: 0, discount_5: 0, discount_10: 0, waiver: 0, escalation_economic: 0, escalation_guardrail: 0
    };

    let pendingHumanApprovalCount = 0;

    for (const inv of interventionsList) {
      if (inv.status === 'pending_human_approval') {
        pendingHumanApprovalCount++;
      }

      if (inv.actionType === 'escalation') {
        // Find if this escalation has a guardrail audit log
        const guardrailLog = await prisma.auditLog.findFirst({
          where: {
            entityType: 'Intervention',
            entityId: inv.id,
            action: 'capped_and_escalated'
          }
        });
        if (guardrailLog) {
          interventionsByAction.escalation_guardrail++;
        } else {
          interventionsByAction.escalation_economic++;
        }
      } else {
        if (inv.actionType in interventionsByAction) {
          // @ts-expect-error - indexing object with string
          interventionsByAction[inv.actionType]++;
        }
      }
    }

    return NextResponse.json({
      revenueAtRisk,
      expectedRecoverable,
      recoveryRatePct,
      customersAtRisk,
      budgetTotal,
      budgetAllocated,
      budgetRemaining,
      riskBySourceType,
      interventionsByAction,
      pendingHumanApprovalCount
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to get summary' }, { status: 500 });
  }
}
