import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  const stats = await prisma.actionPerformanceStats.findMany();
  
  const interventions = await prisma.intervention.findMany({
    where: { outcomeStatus: { not: 'pending' } },
    select: { expectedRecoveryProbability: true, outcomeStatus: true, actionType: true }
  });

  let totalExpected = 0;
  let totalRecovered = 0;
  const actionStatsMap = new Map<string, { totalProb: number, count: number }>();

  for (const inv of interventions) {
    totalExpected += inv.expectedRecoveryProbability;
    if (inv.outcomeStatus === 'recovered') totalRecovered++;
    
    const s = actionStatsMap.get(inv.actionType) || { totalProb: 0, count: 0 };
    s.totalProb += inv.expectedRecoveryProbability;
    s.count++;
    actionStatsMap.set(inv.actionType, s);
  }
  
  const overallPredictedAvg = interventions.length > 0 ? totalExpected / interventions.length : 0;
  const overallObservedAvg = interventions.length > 0 ? totalRecovered / interventions.length : 0;

  const enrichedStats = stats.map(s => {
    const mapStats = actionStatsMap.get(s.actionType);
    const originalHeuristicAvg = mapStats && mapStats.count > 0 ? mapStats.totalProb / mapStats.count : 0;
    return {
      ...s,
      originalHeuristicAvg
    };
  });

  return NextResponse.json({
    stats: enrichedStats,
    overallPredictedAvg,
    overallObservedAvg,
    totalSimulated: interventions.length
  });
}
