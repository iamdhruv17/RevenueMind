import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status'); // e.g. pending|pending_human_approval

    let statusFilter = undefined;
    if (statusParam) {
      statusFilter = { in: statusParam.split('|') };
    }

    const interventions = await prisma.intervention.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { name: true } },
        revenueRiskEvent: { select: { amountAtRisk: true, sourceType: true } }
      }
    });

    // Batch fetch violated rules for pending_human_approval interventions
    const pendingIds = interventions
      .filter(i => i.status === 'pending_human_approval')
      .map(i => i.id);

    const auditLogs = pendingIds.length > 0
      ? await prisma.auditLog.findMany({
          where: {
            entityType: 'Intervention',
            entityId: { in: pendingIds },
            action: 'capped_and_escalated'
          },
          select: { entityId: true, details: true }
        })
      : [];

    const violatedRuleMap = new Map<string, unknown>();
    for (const log of auditLogs) {
      if (log.details && typeof log.details === 'object' && 'violatedRule' in log.details) {
        violatedRuleMap.set(log.entityId, (log.details as Record<string, unknown>).violatedRule);
      }
    }

    const data = interventions.map(inv => ({
      id: inv.id,
      actionType: inv.actionType,
      status: inv.status,
      cost: inv.cost,
      expectedRecoveredRevenue: inv.expectedRecoveredRevenue,
      createdAt: inv.createdAt,
      customerName: inv.customer.name,
      amountAtRisk: inv.revenueRiskEvent.amountAtRisk,
      sourceType: inv.revenueRiskEvent.sourceType,
      violatedRule: violatedRuleMap.get(inv.id) || null,
      messageText: inv.messageText,
      language: inv.language,
      channel: inv.channel
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch interventions' }, { status: 500 });
  }
}
