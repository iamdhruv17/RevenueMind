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
    const interventionsAgg = await prisma.intervention.aggregate({
      _sum: { expectedRecoveredRevenue: true }
    });
    const expectedRecoverable = interventionsAgg._sum.expectedRecoveredRevenue || 0;

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

    // interventionsByAction — batch approach instead of N+1
    const actionGroups = await prisma.intervention.groupBy({
      by: ['actionType'],
      _count: { id: true }
    });

    const pendingHumanApprovalCount = await prisma.intervention.count({
      where: { status: 'pending_human_approval' }
    });

    // Get escalation IDs to classify them
    const escalationInterventions = await prisma.intervention.findMany({
      where: { actionType: 'escalation' },
      select: { id: true }
    });
    const escalationIds = escalationInterventions.map(e => e.id);

    // Single query to find all guardrail audit logs for escalations
    const guardrailLogs = escalationIds.length > 0
      ? await prisma.auditLog.findMany({
          where: {
            entityType: 'Intervention',
            entityId: { in: escalationIds },
            action: 'capped_and_escalated'
          },
          select: { entityId: true }
        })
      : [];
    const guardrailEntityIds = new Set(guardrailLogs.map(l => l.entityId));

    const interventionsByAction = {
      reminder: 0, retry: 0, discount_5: 0, discount_10: 0,
      waiver: 0, escalation_economic: 0, escalation_guardrail: 0
    };

    for (const g of actionGroups) {
      if (g.actionType === 'escalation') {
        // Split escalations into guardrail vs economic
        interventionsByAction.escalation_guardrail = guardrailEntityIds.size;
        interventionsByAction.escalation_economic = g._count.id - guardrailEntityIds.size;
      } else if (g.actionType in interventionsByAction) {
        // @ts-expect-error - indexing object with string
        interventionsByAction[g.actionType] = g._count.id;
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
