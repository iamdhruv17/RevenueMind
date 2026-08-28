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

    const data = await Promise.all(interventions.map(async (inv) => {
      let violatedRule = null;
      if (inv.status === 'pending_human_approval') {
        const auditLog = await prisma.auditLog.findFirst({
          where: { entityType: 'Intervention', entityId: inv.id, action: 'capped_and_escalated' }
        });
        if (auditLog && auditLog.details && typeof auditLog.details === 'object' && 'violatedRule' in auditLog.details) {
          violatedRule = (auditLog.details as Record<string, unknown>).violatedRule;
        }
      }

      return {
        id: inv.id,
        actionType: inv.actionType,
        status: inv.status,
        cost: inv.cost,
        expectedRecoveredRevenue: inv.expectedRecoveredRevenue,
        createdAt: inv.createdAt,
        customerName: inv.customer.name,
        amountAtRisk: inv.revenueRiskEvent.amountAtRisk,
        sourceType: inv.revenueRiskEvent.sourceType,
        violatedRule,
        messageText: inv.messageText,
        language: inv.language,
        channel: inv.channel
      };
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch interventions' }, { status: 500 });
  }
}
