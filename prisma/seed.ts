import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// ── Helpers ──────────────────────────────────────────────────────────────────

function weightedRandom<T>(choices: { value: T; weight: number }[]): T {
  const total = choices.reduce((sum, c) => sum + c.weight, 0);
  let r = Math.random() * total;
  for (const choice of choices) {
    r -= choice.weight;
    if (r <= 0) return choice.value;
  }
  return choices[choices.length - 1].value;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Constants ────────────────────────────────────────────────────────────────

const CUSTOMER_COUNT = 10;
const TRANSACTION_COUNT = 20;
const CHECKOUT_COUNT = 15;
const INVOICE_COUNT = 8;

const LANGUAGES = [
  { value: 'en', weight: 50 },
  { value: 'hinglish', weight: 30 },
  { value: 'hi', weight: 20 },
];

const PAYMENT_METHODS = ['card', 'upi', 'netbanking', 'wallet', 'emandate'];
const TRANSACTION_TYPES = ['one_time', 'subscription', 'mandate'];
const FAILURE_REASONS = [
  'insufficient_funds',
  'card_declined',
  'network_error',
  'bank_timeout',
];

// ── Main seed function ───────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting seed...\n');

  // ── 1. Clean existing data (in dependency order) ──────────────────────────
  await prisma.intervention.deleteMany();
  await prisma.rootCauseAnalysis.deleteMany();
  await prisma.revenueRiskEvent.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.budgetAllocation.deleteMany();
  await prisma.policyRule.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.checkoutSession.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.customerHistoryStats.deleteMany();
  await prisma.customer.deleteMany();
  console.log('  ✓ Cleaned existing data');

  // ── 2. Create customers ───────────────────────────────────────────────────
  const customers = [];
  const usedEmails = new Set<string>();

  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    let email: string;
    do {
      email = faker.internet.email().toLowerCase();
    } while (usedEmails.has(email));
    usedEmails.add(email);

    const customer = await prisma.customer.create({
      data: {
        name: faker.person.fullName(),
        email,
        phone: faker.phone.number({ style: 'national' }),
        preferredLanguage: weightedRandom(LANGUAGES),
        createdAt: faker.date.past({ years: 2 }),
      },
    });
    customers.push(customer);
  }
  console.log(`  ✓ Created ${customers.length} customers`);

  // ── 3. Create CustomerHistoryStats ────────────────────────────────────────
  //    Three tiers:
  //      - Reliable (~50%):  high total, high success rate, low failures
  //      - Moderate (~30%):  mixed results, some abandonments
  //      - Unreliable (~20%): low total, high failure rate
  let statsCount = 0;
  for (const customer of customers) {
    const tierRoll = Math.random();
    let totalPayments: number;
    let successRate: number;
    let abandonments: number;
    let recoveries: number;
    let avgResponseDays: number | null;

    if (tierRoll < 0.5) {
      // Reliable
      totalPayments = randomInt(20, 80);
      successRate = randomFloat(0.85, 0.98);
      abandonments = randomInt(0, 2);
      recoveries = randomInt(0, 3);
      avgResponseDays = randomFloat(0.5, 2.0);
    } else if (tierRoll < 0.8) {
      // Moderate risk
      totalPayments = randomInt(8, 30);
      successRate = randomFloat(0.55, 0.80);
      abandonments = randomInt(2, 8);
      recoveries = randomInt(1, 5);
      avgResponseDays = randomFloat(2.0, 5.0);
    } else {
      // Unreliable / new
      totalPayments = randomInt(1, 10);
      successRate = randomFloat(0.20, 0.55);
      abandonments = randomInt(3, 12);
      recoveries = randomInt(0, 1);
      avgResponseDays = Math.random() > 0.4 ? randomFloat(4.0, 10.0) : null;
    }

    const successfulPayments = Math.round(totalPayments * successRate);
    const failedPayments = totalPayments - successfulPayments;

    await prisma.customerHistoryStats.create({
      data: {
        customerId: customer.id,
        totalPayments,
        successfulPayments,
        failedPayments,
        previousAbandonments: abandonments,
        previousRecoveries: recoveries,
        avgReminderResponseDays: avgResponseDays,
        recoveryPropensityScore: null, // Checkpoint B computes this
      },
    });
    statsCount++;
  }
  console.log(`  ✓ Created ${statsCount} customer history stats`);

  // ── 4. Create transactions ────────────────────────────────────────────────
  let txSuccessCount = 0;
  let txFailedCount = 0;

  for (let i = 0; i < TRANSACTION_COUNT; i++) {
    const customer = pickRandom(customers);
    const isFailed = Math.random() < 0.25;

    const tx = await prisma.transaction.create({
      data: {
        customerId: customer.id,
        amount: randomFloat(200, 15000),
        status: isFailed ? 'failed' : 'success',
        paymentMethod: pickRandom(PAYMENT_METHODS),
        type: pickRandom(TRANSACTION_TYPES),
        failureReasonCode: isFailed ? pickRandom(FAILURE_REASONS) : null,
        createdAt: faker.date.recent({ days: 90 }),
      },
    });

    if (isFailed) txFailedCount++;
    else txSuccessCount++;
  }
  console.log(
    `  ✓ Created ${TRANSACTION_COUNT} transactions (${txSuccessCount} success, ${txFailedCount} failed)`
  );

  // ── 5. Create checkout sessions ───────────────────────────────────────────
  let abandonedCount = 0;
  let completedCheckouts = 0;

  for (let i = 0; i < CHECKOUT_COUNT; i++) {
    const customer = pickRandom(customers);
    const isAbandoned = Math.random() < 0.4;

    let timeOnCheckoutSec: number | null = null;
    if (isAbandoned) {
      // Create meaningful variation for Root Cause Agent:
      //   - Short (<30s): distracted/interrupted
      //   - Medium (30-180s): normal dropout
      //   - Long (>180s): price comparison/hesitation
      const pattern = Math.random();
      if (pattern < 0.35) {
        timeOnCheckoutSec = randomInt(5, 29); // short — distracted
      } else if (pattern < 0.65) {
        timeOnCheckoutSec = randomInt(30, 180); // medium — normal
      } else {
        timeOnCheckoutSec = randomInt(181, 600); // long — price comparison
      }
    } else {
      // Completed checkouts have normal checkout times
      timeOnCheckoutSec = randomInt(20, 120);
    }

    await prisma.checkoutSession.create({
      data: {
        customerId: customer.id,
        cartValue: randomFloat(300, 25000),
        timeOnCheckoutSec,
        abandoned: isAbandoned,
        createdAt: faker.date.recent({ days: 60 }),
      },
    });

    if (isAbandoned) abandonedCount++;
    else completedCheckouts++;
  }
  console.log(
    `  ✓ Created ${CHECKOUT_COUNT} checkout sessions (${abandonedCount} abandoned, ${completedCheckouts} completed)`
  );

  // ── 6. Create invoices ────────────────────────────────────────────────────
  let overdueCount = 0;
  let paidCount = 0;

  for (let i = 0; i < INVOICE_COUNT; i++) {
    const customer = pickRandom(customers);
    const isOverdue = Math.random() < 0.3;
    const amount = randomFloat(20000, 500000);

    let dueDate: Date;
    let lateFeeAmount: number | null = null;

    if (isOverdue) {
      // Due date in the past (1–90 days ago)
      dueDate = faker.date.recent({ days: 90 });
      lateFeeAmount = parseFloat((amount * 0.025).toFixed(2)); // 2.5% late fee
    } else {
      // Due date in the future (1–60 days from now)
      dueDate = faker.date.soon({ days: 60 });
    }

    await prisma.invoice.create({
      data: {
        customerId: customer.id,
        amount,
        dueDate,
        status: isOverdue ? 'overdue' : 'paid',
        lateFeeAmount,
        createdAt: faker.date.past({ years: 1 }),
      },
    });

    if (isOverdue) overdueCount++;
    else paidCount++;
  }
  console.log(
    `  ✓ Created ${INVOICE_COUNT} invoices (${overdueCount} overdue, ${paidCount} paid)`
  );

  // ── 7. Create PolicyRule rows ──────────────────────────────────────────────
  const policyRules = [
    {
      ruleName: 'max_discount_pct',
      maxValue: 10,
      description: 'Maximum discount as % of order value',
    },
    {
      ruleName: 'max_waiver_pct',
      maxValue: 100,
      description: 'Maximum late fee % that can be waived',
    },
    {
      ruleName: 'max_contacts',
      maxValue: 2,
      description: 'Maximum recovery contacts per risk event',
    },
  ];

  for (const rule of policyRules) {
    await prisma.policyRule.upsert({
      where: { ruleName: rule.ruleName },
      update: { maxValue: rule.maxValue, description: rule.description },
      create: rule,
    });
  }
  console.log(`  ✓ Upserted ${policyRules.length} policy rules`);

  // ── 8. Create BudgetAllocation row for current month ──────────────────────
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Check if one already exists for this period
  const existing = await prisma.budgetAllocation.findFirst({
    where: {
      periodStart: { lte: now },
      periodEnd: { gte: now },
    },
  });

  if (!existing) {
    await prisma.budgetAllocation.create({
      data: {
        periodStart,
        periodEnd,
        totalBudget: 50000,
        allocatedSoFar: 0,
      },
    });
    console.log(`  ✓ Created BudgetAllocation for current month`);
  } else {
    console.log(`  ✓ BudgetAllocation already exists for current month`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const counts = {
    customers: await prisma.customer.count(),
    historyStats: await prisma.customerHistoryStats.count(),
    transactions: await prisma.transaction.count(),
    checkoutSessions: await prisma.checkoutSession.count(),
    invoices: await prisma.invoice.count(),
  };

  console.log('\n📊 Seed complete! Row counts:');
  console.log('  ┌─────────────────────────┬───────┐');
  console.log(`  │ Customer                │ ${String(counts.customers).padStart(5)} │`);
  console.log(`  │ CustomerHistoryStats     │ ${String(counts.historyStats).padStart(5)} │`);
  console.log(`  │ Transaction             │ ${String(counts.transactions).padStart(5)} │`);
  console.log(`  │ CheckoutSession         │ ${String(counts.checkoutSessions).padStart(5)} │`);
  console.log(`  │ Invoice                 │ ${String(counts.invoices).padStart(5)} │`);
  console.log('  └─────────────────────────┴───────┘');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
