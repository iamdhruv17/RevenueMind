import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // discount
  const discount = await prisma.intervention.findFirst({
    where: { actionType: { in: ['discount_5', 'discount_10'] } }
  });
  console.log('Discount Intervention:', discount);
  
  // waiver
  const waiver = await prisma.intervention.findFirst({
    where: { actionType: 'waiver' }
  });
  console.log('Waiver Intervention:', waiver);
  
  // escalation + pending_human_approval (guardrail)
  const escalationGuardrail = await prisma.intervention.findFirst({
    where: { actionType: 'escalation', status: 'pending_human_approval' }
  });
  
  if (escalationGuardrail) {
    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'Intervention', entityId: escalationGuardrail.id }
    });
    console.log('Escalation Guardrail Intervention:', escalationGuardrail);
    console.log('Audit logs for above:', logs);
  } else {
    console.log('Escalation Guardrail Intervention: null');
  }

  // 2. Count of escalations broken down by guardrail vs economic
  const escalations = await prisma.intervention.findMany({
    where: { actionType: 'escalation' }
  });
  
  let guardrailCount = 0;
  let economicCount = 0;
  
  for (const esc of escalations) {
    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'Intervention', entityId: esc.id }
    });
    const hasGuardrail = logs.some(log => log.action === 'capped_and_escalated');
    if (hasGuardrail) {
      guardrailCount++;
    } else {
      economicCount++;
    }
  }
  
  console.log(`\nEscalations - Guardrail (capped_and_escalated): ${guardrailCount}`);
  console.log(`Escalations - Economic (no good proactive option): ${economicCount}`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
