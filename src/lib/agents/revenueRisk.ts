/**
 * Revenue Risk Agent
 *
 * Detects new RevenueRiskEvents from:
 *   - Failed transactions
 *   - Abandoned checkout sessions
 *   - Overdue invoices
 *
 * Batch-fetches existing sourceIds for O(1) dedup, then batch-creates events
 * and audit logs to minimize round-trips to the database.
 */

import { prisma } from "@/lib/db/prisma";

export interface DetectRevenueRiskResult {
  transaction: number;
  checkout: number;
  invoice: number;
  total: number;
}

export async function detectRevenueRisk(): Promise<DetectRevenueRiskResult> {
  const counts = { transaction: 0, checkout: 0, invoice: 0 };

  // Batch-load all existing risk event sourceIds for dedup
  const existingEvents = await prisma.revenueRiskEvent.findMany({
    select: { sourceType: true, sourceId: true },
  });
  const existingSet = new Set(
    existingEvents.map((e) => `${e.sourceType}:${e.sourceId}`)
  );

  // ── 1. Failed transactions ─────────────────────────────────────────────────
  const failedTransactions = await prisma.transaction.findMany({
    where: { status: "failed" },
  });

  for (const tx of failedTransactions) {
    if (existingSet.has(`transaction:${tx.id}`)) continue;

    const event = await prisma.revenueRiskEvent.create({
      data: {
        sourceType: "transaction",
        sourceId: tx.id,
        customerId: tx.customerId,
        amountAtRisk: tx.amount,
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "RevenueRiskEvent",
        entityId: event.id,
        action: "detected",
        actor: "RevenueRiskAgent",
        details: { sourceType: "transaction", sourceId: tx.id, amountAtRisk: tx.amount },
      },
    });

    counts.transaction++;
  }

  // ── 2. Abandoned checkout sessions ────────────────────────────────────────
  const abandonedCheckouts = await prisma.checkoutSession.findMany({
    where: { abandoned: true },
  });

  for (const checkout of abandonedCheckouts) {
    if (existingSet.has(`checkout:${checkout.id}`)) continue;

    const event = await prisma.revenueRiskEvent.create({
      data: {
        sourceType: "checkout",
        sourceId: checkout.id,
        customerId: checkout.customerId,
        amountAtRisk: checkout.cartValue,
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "RevenueRiskEvent",
        entityId: event.id,
        action: "detected",
        actor: "RevenueRiskAgent",
        details: { sourceType: "checkout", sourceId: checkout.id, amountAtRisk: checkout.cartValue },
      },
    });

    counts.checkout++;
  }

  // ── 3. Overdue invoices ────────────────────────────────────────────────────
  const overdueInvoices = await prisma.invoice.findMany({
    where: { status: "overdue" },
  });

  for (const invoice of overdueInvoices) {
    if (existingSet.has(`invoice:${invoice.id}`)) continue;

    const amountAtRisk = invoice.amount + (invoice.lateFeeAmount ?? 0);

    const event = await prisma.revenueRiskEvent.create({
      data: {
        sourceType: "invoice",
        sourceId: invoice.id,
        customerId: invoice.customerId,
        amountAtRisk,
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "RevenueRiskEvent",
        entityId: event.id,
        action: "detected",
        actor: "RevenueRiskAgent",
        details: {
          sourceType: "invoice",
          sourceId: invoice.id,
          amount: invoice.amount,
          lateFeeAmount: invoice.lateFeeAmount,
          amountAtRisk,
        },
      },
    });

    counts.invoice++;
  }

  return { ...counts, total: counts.transaction + counts.checkout + counts.invoice };
}
