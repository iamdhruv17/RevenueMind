import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function simulateOutcomes(): Promise<{ simulated: number }> {
  const interventions = await prisma.intervention.findMany({
    where: {
      status: {
        in: ['pending', 'approved']
      },
      outcomeStatus: 'pending'
    },
    include: {
      revenueRiskEvent: true
    }
  });

  let simulatedCount = 0;

  for (const intervention of interventions) {
    let trueProb = 0;

    switch (intervention.actionType) {
      case 'reminder':
        trueProb = 0.22;
        break;
      case 'retry':
        trueProb = 0.35;
        break;
      case 'escalation':
        trueProb = 0.5;
        break;
      case 'discount_5':
        trueProb = intervention.expectedRecoveryProbability * 0.85;
        break;
      case 'discount_10':
        trueProb = intervention.expectedRecoveryProbability * 0.75;
        break;
      case 'waiver':
        trueProb = Math.min(intervention.expectedRecoveryProbability * 1.10, 0.95);
        break;
      default:
        trueProb = intervention.expectedRecoveryProbability;
    }

    const roll = Math.random();
    const success = roll < trueProb;

    const outcomeStatus = success ? 'recovered' : 'not_recovered';
    const actualRecoveredAmount = success ? intervention.revenueRiskEvent.amountAtRisk : 0;

    await prisma.intervention.update({
      where: { id: intervention.id },
      data: {
        outcomeStatus,
        actualRecoveredAmount,
        outcomeRecordedAt: new Date(),
      }
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'Intervention',
        entityId: intervention.id,
        action: 'outcome_simulated',
        actor: 'OutcomeSimulator',
        details: {
          simulated: true,
          trueProb,
          roll,
          success
        }
      }
    });

    simulatedCount++;
  }

  return { simulated: simulatedCount };
}
