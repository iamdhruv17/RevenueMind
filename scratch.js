const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const pendingHumanSum = await prisma.intervention.findMany({
    where: { status: 'pending_human_approval' },
    select: { id: true, expectedRecoveredRevenue: true }
  });
  console.log('pending_human_approval rows:', pendingHumanSum.slice(0, 5));
}

run().catch(console.error).finally(() => prisma.$disconnect());
