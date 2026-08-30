import { NextResponse } from 'next/server';
import { simulateOutcomes } from '@/lib/agents/outcomeSimulator';
import { updateActionPerformanceStats } from '@/lib/agents/learningAgent';
import { prisma } from '@/lib/db/prisma';

export async function POST() {
  try {
    const { simulated } = await simulateOutcomes();
    const { updated } = await updateActionPerformanceStats();
    
    const stats = await prisma.actionPerformanceStats.findMany();

    return NextResponse.json({
      simulated,
      updated,
      stats
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to simulate outcomes' }, { status: 500 });
  }
}
