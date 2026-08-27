import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    const riskEvents = await prisma.revenueRiskEvent.findMany({
      orderBy: { amountAtRisk: 'desc' },
      take: 50,
      include: {
        customer: {
          select: { name: true }
        },
        rootCause: {
          select: { predictedReason: true, confidence: true }
        }
      }
    });

    const data = riskEvents.map(event => ({
      id: event.id,
      customerName: event.customer.name,
      sourceType: event.sourceType,
      amountAtRisk: event.amountAtRisk,
      predictedReason: event.rootCause?.predictedReason || null,
      confidence: event.rootCause?.confidence || null,
      detectedAt: event.detectedAt
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch risk events' }, { status: 500 });
  }
}
