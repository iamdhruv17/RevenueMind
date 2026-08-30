import { prisma } from '@/lib/db/prisma';

export async function updateActionPerformanceStats(): Promise<{ updated: number }> {
  const interventions = await prisma.intervention.findMany({
    where: {
      outcomeStatus: {
        not: 'pending'
      }
    }
  });

  const statsMap = new Map<string, { recovered: number, total: number }>();

  for (const inv of interventions) {
    const stat = statsMap.get(inv.actionType) || { recovered: 0, total: 0 };
    stat.total++;
    if (inv.outcomeStatus === 'recovered') {
      stat.recovered++;
    }
    statsMap.set(inv.actionType, stat);
  }

  let updatedCount = 0;

  for (const [actionType, stat] of statsMap.entries()) {
    const observedSuccessRate = stat.recovered / stat.total;
    const sampleSize = stat.total;

    await prisma.actionPerformanceStats.upsert({
      where: { actionType },
      update: {
        observedSuccessRate,
        sampleSize
      },
      create: {
        actionType,
        observedSuccessRate,
        sampleSize
      }
    });
    
    updatedCount++;
  }

  await prisma.auditLog.create({
    data: {
      entityType: 'ActionPerformanceStats',
      entityId: 'system',
      action: 'stats_updated',
      actor: 'LearningAgent',
      details: {
        updatedStatsCount: updatedCount,
        simulated: true
      }
    }
  });

  return { updated: updatedCount };
}
