/**
 * Guardrails Agent
 *
 * Validates every pending Intervention against PolicyRule limits:
 *   - max_discount_pct: discount cost as % of amountAtRisk must be within limit
 *   - max_waiver_pct: waiver cost must be within % of lateFeeAmount
 *   - max_contacts: interventions per customer in last 30 days must not exceed limit
 *
 * Violations: change actionType to "escalation", status to "pending_human_approval",
 * and log the violation to AuditLog.
 */

import { prisma } from '@/lib/db/prisma';

export async function runGuardrails(): Promise<{ escalated: number }> {
  // Load all policy rules as a map
  const rules = await prisma.policyRule.findMany();
  const ruleMap = new Map(rules.map((r) => [r.ruleName, r.maxValue]));

  const maxDiscountPct = ruleMap.get('max_discount_pct') ?? 10;
  const maxWaiverPct = ruleMap.get('max_waiver_pct') ?? 100;
  const maxContacts = ruleMap.get('max_contacts') ?? 2;

  // Fetch all pending interventions (not yet human-approved or executed)
  const pendingInterventions = await prisma.intervention.findMany({
    where: { status: 'pending' },
    include: {
      revenueRiskEvent: true,
    },
  });

  // Early exit: nothing to check
  if (pendingInterventions.length === 0) {
    return { escalated: 0 };
  }

  // ── Batch: contact counts per customer (last 30 days) ─────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const contactCountGroups = await prisma.intervention.groupBy({
    by: ['customerId'],
    where: {
      createdAt: { gte: thirtyDaysAgo },
    },
    _count: { id: true },
  });
  const contactCountMap = new Map(
    contactCountGroups.map((g) => [g.customerId, g._count.id])
  );

  // ── Batch: fetch invoices for waiver checks ───────────────────────────────
  const waiverInterventions = pendingInterventions.filter(
    (i) => i.actionType === 'waiver'
  );
  const invoiceSourceIds = waiverInterventions.map(
    (i) => i.revenueRiskEvent.sourceId
  );
  const invoices = invoiceSourceIds.length > 0
    ? await prisma.invoice.findMany({
        where: { id: { in: invoiceSourceIds } },
        select: { id: true, lateFeeAmount: true },
      })
    : [];
  const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]));

  let escalated = 0;

  for (const intervention of pendingInterventions) {
    const violations: string[] = [];

    // ── Check max_discount_pct ───────────────────────────────────────────────
    if (
      intervention.actionType === 'discount_5' ||
      intervention.actionType === 'discount_10'
    ) {
      const discountPct =
        intervention.revenueRiskEvent.amountAtRisk > 0
          ? (intervention.cost / intervention.revenueRiskEvent.amountAtRisk) * 100
          : 0;

      if (discountPct > maxDiscountPct) {
        violations.push(`max_discount_pct: ${discountPct.toFixed(2)}% > ${maxDiscountPct}%`);
      }
    }

    // ── Check max_waiver_pct ─────────────────────────────────────────────────
    if (intervention.actionType === 'waiver') {
      const invoice = invoiceMap.get(intervention.revenueRiskEvent.sourceId);
      const maxWaiverAmount = (invoice?.lateFeeAmount ?? 0) * (maxWaiverPct / 100);
      if (intervention.cost > maxWaiverAmount) {
        violations.push(
          `max_waiver_pct: cost ${intervention.cost} > max allowed ${maxWaiverAmount}`
        );
      }
    }

    // ── Check max_contacts (from pre-fetched map) ───────────────────────────
    // Total count includes this intervention, so subtract 1 to exclude self
    const totalCountIncludingSelf = contactCountMap.get(intervention.customerId) ?? 0;
    const recentContactCount = Math.max(0, totalCountIncludingSelf - 1);

    if (recentContactCount >= maxContacts) {
      violations.push(
        `max_contacts: ${recentContactCount} existing contacts >= limit of ${maxContacts}`
      );
    }

    // ── Apply escalation if any violation ───────────────────────────────────
    if (violations.length > 0) {
      const originalAction = intervention.actionType;

      await prisma.intervention.update({
        where: { id: intervention.id },
        data: {
          actionType: 'escalation',
          status: 'pending_human_approval',
        },
      });

      await prisma.auditLog.create({
        data: {
          entityType: 'Intervention',
          entityId: intervention.id,
          action: 'capped_and_escalated',
          actor: 'GuardrailAgent',
          details: {
            originalAction,
            violatedRule: violations,
            revenueRiskEventId: intervention.revenueRiskEventId,
            customerId: intervention.customerId,
          },
        },
      });

      escalated++;
    }
  }

  return { escalated };
}
