/**
 * POST /api/agents/run-pipeline
 *
 * Orchestrator that runs the full recovery pipeline in order:
 *   1. detectRevenueRisk()     -- find at-risk events
 *   2. computePropensityScores()  -- score customers
 *   3. runRootCauseAnalysis()  -- classify each event
 *   4. runRecoveryStrategyAndAllocate()  -- choose + budget-allocate interventions
 *   5. runGuardrails()         -- enforce policy caps
 *
 * Returns a JSON summary suitable for demo and monitoring.
 */

import { NextResponse } from 'next/server';
import { detectRevenueRisk } from '@/lib/agents/revenueRisk';
import { computePropensityScores } from '@/lib/agents/propensityScore';
import { runRootCauseAnalysis } from '@/lib/agents/rootCause';
import { runRecoveryStrategyAndAllocate } from '@/lib/agents/recoveryStrategy';
import { runGuardrails } from '@/lib/agents/guardrails';

// Vercel Hobby plan max: 60s. Safety net for runs with real work.
export const maxDuration = 60;

export async function POST() {
  try {
    // Step 1: Detect revenue risk events
    const riskEventsDetected = await detectRevenueRisk();

    // Step 2: Compute propensity scores for all customers
    await computePropensityScores();

    // Step 3: Root cause analysis for all new events
    await runRootCauseAnalysis();

    // Step 4: Recovery strategy + batch budget allocation
    const {
      interventionsCreated,
      totalExpectedRecoveredRevenue,
      budgetAllocated,
      budgetRemaining,
    } = await runRecoveryStrategyAndAllocate();

    // Step 5: Guardrails enforcement
    const { escalated: escalatedByGuardrails } = await runGuardrails();

    return NextResponse.json({
      riskEventsDetected: {
        transaction: riskEventsDetected.transaction,
        checkout: riskEventsDetected.checkout,
        invoice: riskEventsDetected.invoice,
      },
      interventionsCreated,
      totalExpectedRecoveredRevenue: Math.round(totalExpectedRecoveredRevenue * 100) / 100,
      budgetAllocated: Math.round(budgetAllocated * 100) / 100,
      budgetRemaining: Math.round(budgetRemaining * 100) / 100,
      escalatedByGuardrails,
    });
  } catch (error) {
    console.error('[run-pipeline] Error:', error);
    return NextResponse.json(
      { error: 'Pipeline failed', details: String(error) },
      { status: 500 }
    );
  }
}
