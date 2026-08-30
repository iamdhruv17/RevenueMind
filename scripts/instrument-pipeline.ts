/**
 * Instrumentation script: measures per-stage timing of the recovery pipeline.
 * Run with: npx tsx scripts/instrument-pipeline.ts
 * 
 * This script does NOT modify data — it calls each stage and measures wall time.
 * However, some stages ARE write operations (propensity scores, etc.), so this
 * will reflect real production behavior.
 */

import { detectRevenueRisk } from '../src/lib/agents/revenueRisk';
import { computePropensityScores } from '../src/lib/agents/propensityScore';
import { runRootCauseAnalysis } from '../src/lib/agents/rootCause';
import { runRecoveryStrategyAndAllocate } from '../src/lib/agents/recoveryStrategy';
import { runGuardrails } from '../src/lib/agents/guardrails';

async function main() {
  console.log('=== Pipeline Instrumentation ===\n');
  const overall = Date.now();

  // Stage 1
  console.log('Stage 1: detectRevenueRisk...');
  let t = Date.now();
  const riskResult = await detectRevenueRisk();
  console.log(`  -> ${Date.now() - t}ms | Result: ${JSON.stringify(riskResult)}`);

  // Stage 2
  console.log('Stage 2: computePropensityScores...');
  t = Date.now();
  const propResult = await computePropensityScores();
  console.log(`  -> ${Date.now() - t}ms | Result: ${JSON.stringify(propResult)}`);

  // Stage 3
  console.log('Stage 3: runRootCauseAnalysis...');
  t = Date.now();
  const rcaResult = await runRootCauseAnalysis();
  console.log(`  -> ${Date.now() - t}ms | Result: ${JSON.stringify(rcaResult)}`);

  // Stage 4
  console.log('Stage 4: runRecoveryStrategyAndAllocate...');
  t = Date.now();
  const stratResult = await runRecoveryStrategyAndAllocate();
  console.log(`  -> ${Date.now() - t}ms | Result: ${JSON.stringify(stratResult)}`);

  // Stage 5
  console.log('Stage 5: runGuardrails...');
  t = Date.now();
  const guardResult = await runGuardrails();
  console.log(`  -> ${Date.now() - t}ms | Result: ${JSON.stringify(guardResult)}`);

  console.log(`\n=== Total: ${Date.now() - overall}ms ===`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
