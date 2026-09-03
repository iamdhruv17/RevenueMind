"use client";

import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SummaryData {
  revenueAtRisk: number;
  expectedRecoverable: number;
  recoveryRatePct: number;
  customersAtRisk: number;
  budgetTotal: number;
  budgetAllocated: number;
  budgetRemaining: number;
  riskBySourceType: { transaction: number; checkout: number; invoice: number };
  interventionsByAction: {
    reminder: number; retry: number; discount_5: number; discount_10: number;
    waiver: number; escalation_economic: number; escalation_guardrail: number;
  };
  pendingHumanApprovalCount: number;
}

interface RiskEventRow {
  id: string; customerName: string; sourceType: string; amountAtRisk: number;
  predictedReason: string | null; confidence: number | null; detectedAt: string;
}

interface InterventionRow {
  id: string; actionType: string; status: string; cost: number;
  expectedRecoveredRevenue: number; createdAt: string; customerName: string;
  amountAtRisk: number; sourceType: string; violatedRule: string[] | string | null;
  messageText?: string | null; language?: string | null; channel?: string | null;
}

interface AuditLogRow {
  id: string; timestamp: string; actor: string; action: string;
  entityType: string; entityId: string;
}

interface LearningStats {
  stats: {
    id: string; actionType: string; observedSuccessRate: number;
    sampleSize: number; originalHeuristicAvg: number;
  }[];
  overallPredictedAvg: number;
  overallObservedAvg: number;
  totalSimulated: number;
}

type Section = 'overview' | 'risk-events' | 'approvals' | 'messages' | 'learning' | 'audit';

// ─── Shared utility ──────────────────────────────────────────────────────────

function fmt(val: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(val);
}

// ─── Section: Overview ───────────────────────────────────────────────────────

interface OverviewProps {
  summary: SummaryData;
  riskEvents: RiskEventRow[];
  budgetPct: number;
  riskChartData: { name: string; amount: number }[];
  interventionChartData: { name: string; count: number }[];
  onViewAll: () => void;
}

function SectionOverview({
  summary, riskEvents, budgetPct, riskChartData, interventionChartData, onViewAll,
}: OverviewProps) {
  return (
    <div className="space-y-6">
      {/* Budget panel */}
      <div
        className="rounded-xl border p-5"
        style={{ backgroundColor: 'var(--rm-surface)', borderColor: 'var(--rm-border)' }}
      >
        <div className="flex flex-wrap justify-between items-end gap-2 mb-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--rm-ink)' }}>
            Budget Allocation
          </h2>
          <div className="text-xs" style={{ color: 'var(--rm-ink-muted)' }}>
            <span className="font-mono font-semibold" style={{ color: 'var(--rm-accent-recover)' }}>
              {fmt(summary.budgetRemaining)}
            </span>
            <span className="mx-1">remaining of</span>
            <span className="font-mono">{fmt(summary.budgetTotal)}</span>
          </div>
        </div>
        <div
          className="w-full rounded-full h-2.5 overflow-hidden"
          style={{ backgroundColor: 'var(--rm-border)' }}
        >
          <div
            className="h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${budgetPct}%`, backgroundColor: 'var(--rm-accent-recover)' }}
          />
        </div>
        <div className="text-xs mt-2 text-right" style={{ color: 'var(--rm-ink-muted)' }}>
          <span className="font-mono">{fmt(summary.budgetAllocated)}</span>
          {' allocated ('}{budgetPct.toFixed(1)}{'%)'}
        </div>
      </div>

      {/* Charts — 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div
          className="rounded-xl border p-5 h-72"
          style={{ backgroundColor: 'var(--rm-surface)', borderColor: 'var(--rm-border)' }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--rm-ink)' }}>
            Risk by Source Type
          </h2>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={riskChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--rm-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--rm-ink-muted)' }} />
              <YAxis
                tickFormatter={(v) => `₹${v / 1000}k`}
                tick={{ fontSize: 11, fill: 'var(--rm-ink-muted)' }}
              />
              <RechartsTooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [fmt(Number(value) || 0), 'Amount']}
              />
              <Bar dataKey="amount" fill="var(--rm-accent-risk)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div
          className="rounded-xl border p-5 h-72"
          style={{ backgroundColor: 'var(--rm-surface)', borderColor: 'var(--rm-border)' }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--rm-ink)' }}>
            Interventions by Action Type
          </h2>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={interventionChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--rm-border)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--rm-ink-muted)' }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={48}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--rm-ink-muted)' }} />
              <RechartsTooltip />
              <Bar dataKey="count" fill="var(--rm-accent-escalate)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top-5 risk preview */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--rm-surface)', borderColor: 'var(--rm-border)' }}
      >
        <div
          className="px-5 py-3 border-b flex justify-between items-center"
          style={{ borderColor: 'var(--rm-border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--rm-ink)' }}>
            Top Risk Events
          </h2>
          <button
            onClick={onViewAll}
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--rm-accent-escalate)' }}
          >
            View all →
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead
              className="sticky top-0"
              style={{ backgroundColor: 'var(--rm-bg)' }}
            >
              <tr style={{ color: 'var(--rm-ink-muted)' }}>
                <th className="px-5 py-2.5 font-medium">Customer</th>
                <th className="px-5 py-2.5 font-medium">Source</th>
                <th className="px-5 py-2.5 font-medium">Amount at Risk</th>
                <th className="px-5 py-2.5 font-medium hidden md:table-cell">Predicted Reason</th>
                <th className="px-5 py-2.5 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {riskEvents.slice(0, 5).length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-6 text-center"
                    style={{ color: 'var(--rm-ink-muted)' }}
                  >
                    No risk events found.
                  </td>
                </tr>
              ) : (
                riskEvents.slice(0, 5).map((event) => (
                  <tr
                    key={event.id}
                    className="border-t transition-colors"
                    style={{ borderColor: 'var(--rm-border)' }}
                  >
                    <td className="px-5 py-3 font-medium" style={{ color: 'var(--rm-ink)' }}>
                      {event.customerName}
                    </td>
                    <td className="px-5 py-3 capitalize" style={{ color: 'var(--rm-ink-muted)' }}>
                      {event.sourceType}
                    </td>
                    <td
                      className="px-5 py-3 font-mono font-semibold"
                      style={{ color: 'var(--rm-accent-risk)' }}
                    >
                      {fmt(event.amountAtRisk)}
                    </td>
                    <td
                      className="px-5 py-3 hidden md:table-cell"
                      style={{ color: 'var(--rm-ink-muted)' }}
                    >
                      {event.predictedReason || '—'}
                    </td>
                    <td className="px-5 py-3">
                      {event.confidence ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-12 rounded-full h-1 shrink-0"
                            style={{ backgroundColor: 'var(--rm-border)' }}
                          >
                            <div
                              className="h-1 rounded-full"
                              style={{
                                width: `${event.confidence * 100}%`,
                                backgroundColor: 'var(--rm-accent-escalate)',
                              }}
                            />
                          </div>
                          <span
                            className="font-mono tabular-nums"
                            style={{ color: 'var(--rm-ink-muted)' }}
                          >
                            {(event.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Risk Events ────────────────────────────────────────────────────

function SectionRiskEvents({ riskEvents }: { riskEvents: RiskEventRow[] }) {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-base font-semibold" style={{ color: 'var(--rm-ink)' }}>Risk Events</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--rm-ink-muted)' }}>
          Top 50 highest-risk revenue events detected by the system.
        </p>
      </div>
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--rm-surface)', borderColor: 'var(--rm-border)' }}
      >
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
          <table className="w-full text-sm text-left">
            <thead
              className="sticky top-0"
              style={{ backgroundColor: 'var(--rm-bg)' }}
            >
              <tr style={{ color: 'var(--rm-ink-muted)' }}>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide">Customer</th>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide">Source</th>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide">Amount at Risk</th>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide hidden md:table-cell">
                  Predicted Reason
                </th>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {riskEvents.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm"
                    style={{ color: 'var(--rm-ink-muted)' }}
                  >
                    No risk events found. Run the pipeline to detect risk.
                  </td>
                </tr>
              ) : (
                riskEvents.map((event) => (
                  <tr
                    key={event.id}
                    className="border-t transition-colors"
                    style={{ borderColor: 'var(--rm-border)' }}
                  >
                    <td
                      className="px-6 py-4 font-medium text-sm"
                      style={{ color: 'var(--rm-ink)' }}
                    >
                      {event.customerName}
                    </td>
                    <td
                      className="px-6 py-4 capitalize text-sm"
                      style={{ color: 'var(--rm-ink-muted)' }}
                    >
                      {event.sourceType}
                    </td>
                    <td
                      className="px-6 py-4 font-mono text-sm font-semibold"
                      style={{ color: 'var(--rm-accent-risk)' }}
                    >
                      {fmt(event.amountAtRisk)}
                    </td>
                    <td
                      className="px-6 py-4 text-sm hidden md:table-cell"
                      style={{ color: 'var(--rm-ink-muted)' }}
                    >
                      {event.predictedReason || '—'}
                    </td>
                    <td className="px-6 py-4">
                      {event.confidence ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-16 rounded-full h-1.5 shrink-0"
                            style={{ backgroundColor: 'var(--rm-border)' }}
                          >
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: `${event.confidence * 100}%`,
                                backgroundColor: 'var(--rm-accent-escalate)',
                              }}
                            />
                          </div>
                          <span
                            className="font-mono text-xs tabular-nums"
                            style={{ color: 'var(--rm-ink-muted)' }}
                          >
                            {(event.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Approvals ──────────────────────────────────────────────────────

interface ApprovalsProps {
  pendingApprovals: InterventionRow[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function SectionApprovals({ pendingApprovals, onApprove, onReject }: ApprovalsProps) {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-base font-semibold" style={{ color: 'var(--rm-ink)' }}>
          Guardrail Escalations
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--rm-ink-muted)' }}>
          Interventions blocked by policy rules pending your approval.
        </p>
      </div>
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--rm-surface)', borderColor: 'var(--rm-border)' }}
      >
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0" style={{ backgroundColor: 'var(--rm-bg)' }}>
              <tr style={{ color: 'var(--rm-ink-muted)' }}>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide">Customer</th>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide">Context</th>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide">Violated Rule</th>
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {pendingApprovals.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-10 text-center text-sm"
                    style={{ color: 'var(--rm-ink-muted)' }}
                  >
                    No escalations pending review.
                  </td>
                </tr>
              ) : (
                pendingApprovals.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-t transition-colors"
                    style={{ borderColor: 'var(--rm-border)' }}
                  >
                    <td className="px-6 py-4 font-medium" style={{ color: 'var(--rm-ink)' }}>
                      {inv.customerName}
                    </td>
                    <td className="px-6 py-4">
                      <div className="capitalize text-sm" style={{ color: 'var(--rm-ink)' }}>
                        {inv.sourceType}
                      </div>
                      <div
                        className="font-mono text-xs mt-0.5"
                        style={{ color: 'var(--rm-ink-muted)' }}
                      >
                        {fmt(inv.amountAtRisk)} at risk
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border"
                        style={{
                          backgroundColor: '#FEF3F2',
                          color: '#B42318',
                          borderColor: '#FECDCA',
                        }}
                      >
                        {inv.violatedRule || 'Unknown policy'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => onReject(inv.id)}
                        className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors"
                        style={{
                          color: 'var(--rm-ink-muted)',
                          borderColor: 'var(--rm-border)',
                          backgroundColor: 'transparent',
                        }}
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => onApprove(inv.id)}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: 'var(--rm-accent-recover)' }}
                      >
                        Approve
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Messages ───────────────────────────────────────────────────────

interface MessagesProps {
  interventions: InterventionRow[];
  generatingMessages: boolean;
  runningPipeline: boolean;
  onGenerate: () => void;
}

function SectionMessages({
  interventions, generatingMessages, runningPipeline, onGenerate,
}: MessagesProps) {
  const withMessages = interventions.filter((i) => i.messageText).slice(0, 6);
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--rm-ink)' }}>
            Recovery Messages
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--rm-ink-muted)' }}>
            Personalized, multilingual messages generated for at-risk customers.
          </p>
        </div>
        <button
          onClick={onGenerate}
          disabled={generatingMessages || runningPipeline}
          className="text-sm px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 shrink-0"
          style={{ backgroundColor: 'var(--rm-accent-escalate)' }}
        >
          {generatingMessages ? 'Generating…' : 'Generate Messages'}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {withMessages.length === 0 ? (
          <div
            className="col-span-full rounded-xl border p-10 text-center text-sm"
            style={{
              backgroundColor: 'var(--rm-surface)',
              borderColor: 'var(--rm-border)',
              color: 'var(--rm-ink-muted)',
            }}
          >
            No messages generated yet. Click &ldquo;Generate Messages&rdquo; to create them.
          </div>
        ) : (
          withMessages.map((inv) => (
            <div
              key={inv.id}
              className="rounded-xl border p-5 relative"
              style={{ backgroundColor: 'var(--rm-surface)', borderColor: 'var(--rm-border)' }}
            >
              <div
                className="absolute top-4 right-4 rounded px-2 py-0.5 text-xs font-semibold uppercase border"
                style={{
                  backgroundColor: 'var(--rm-bg)',
                  color: 'var(--rm-ink-muted)',
                  borderColor: 'var(--rm-border)',
                }}
              >
                {inv.language}
              </div>
              <div
                className="font-semibold text-sm mb-1"
                style={{ color: 'var(--rm-ink)' }}
              >
                {inv.customerName}
              </div>
              <div
                className="text-xs mb-3 capitalize"
                style={{ color: 'var(--rm-ink-muted)' }}
              >
                {inv.actionType.replace(/_/g, ' ')} · {inv.channel}
              </div>
              <div
                className="rounded-lg p-3 text-sm italic border"
                style={{
                  backgroundColor: 'var(--rm-bg)',
                  borderColor: 'var(--rm-border)',
                  color: 'var(--rm-ink)',
                }}
              >
                &ldquo;{inv.messageText}&rdquo;
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Section: Learning ───────────────────────────────────────────────────────

interface LearningProps {
  learningStats: LearningStats | null;
  simulating: boolean;
  onSimulate: () => void;
}

function SectionLearning({ learningStats, simulating, onSimulate }: LearningProps) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--rm-ink)' }}>
            Learning &amp; Outcomes
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--rm-ink-muted)' }}>
            Simulated outcomes comparing predicted vs. actual recovery rates.
          </p>
        </div>
        <button
          onClick={onSimulate}
          disabled={simulating}
          className="text-sm px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 shrink-0"
          style={{ backgroundColor: 'var(--rm-accent-escalate)' }}
        >
          {simulating ? 'Simulating…' : 'Simulate Outcomes'}
        </button>
      </div>

      {learningStats && (
        <>
          {/* Headline stats grid */}
          <div
            className="rounded-xl border p-5 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-5"
            style={{ backgroundColor: 'var(--rm-surface)', borderColor: 'var(--rm-border)' }}
          >
            {[
              {
                label: 'Predicted avg',
                value: `${(learningStats.overallPredictedAvg * 100).toFixed(1)}%`,
                color: 'var(--rm-ink)',
              },
              {
                label: 'Observed avg',
                value: `${(learningStats.overallObservedAvg * 100).toFixed(1)}%`,
                color: 'var(--rm-accent-recover)',
              },
              {
                label: 'Total simulated',
                value: String(learningStats.totalSimulated),
                color: 'var(--rm-ink)',
              },
              {
                label: 'Action types',
                value: String(learningStats.stats.length),
                color: 'var(--rm-ink)',
              },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="text-xs mb-1" style={{ color: 'var(--rm-ink-muted)' }}>{label}</div>
                <div className="font-mono text-xl font-semibold" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Per-action table */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{ backgroundColor: 'var(--rm-surface)', borderColor: 'var(--rm-border)' }}
          >
            <div className="max-h-[28rem] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0" style={{ backgroundColor: 'var(--rm-bg)' }}>
                  <tr style={{ color: 'var(--rm-ink-muted)' }}>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide">
                      Action Type
                    </th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide">
                      Original Heuristic
                    </th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide">
                      Observed Rate
                    </th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide">
                      Sample Size
                    </th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {learningStats.stats.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-sm"
                        style={{ color: 'var(--rm-ink-muted)' }}
                      >
                        No simulated outcomes yet. Click &ldquo;Simulate Outcomes&rdquo; to generate data.
                      </td>
                    </tr>
                  ) : (
                    learningStats.stats.map((stat) => {
                      const delta = stat.observedSuccessRate - stat.originalHeuristicAvg;
                      const isPositive = delta > 0.01;
                      const isNegative = delta < -0.01;
                      return (
                        <tr
                          key={stat.id}
                          className="border-t transition-colors"
                          style={{ borderColor: 'var(--rm-border)' }}
                        >
                          <td
                            className="px-6 py-4 font-medium capitalize"
                            style={{ color: 'var(--rm-ink)' }}
                          >
                            {stat.actionType.replace(/_/g, ' ')}
                          </td>
                          <td
                            className="px-6 py-4 font-mono text-sm"
                            style={{ color: 'var(--rm-ink-muted)' }}
                          >
                            {(stat.originalHeuristicAvg * 100).toFixed(1)}%
                          </td>
                          <td
                            className="px-6 py-4 font-mono text-sm font-semibold"
                            style={{ color: 'var(--rm-ink)' }}
                          >
                            {(stat.observedSuccessRate * 100).toFixed(1)}%
                          </td>
                          <td
                            className="px-6 py-4 font-mono text-sm"
                            style={{ color: 'var(--rm-ink-muted)' }}
                          >
                            {stat.sampleSize}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                              style={{
                                backgroundColor: isPositive
                                  ? '#ECFDF3'
                                  : isNegative
                                  ? '#FEF3F2'
                                  : 'var(--rm-bg)',
                                color: isPositive
                                  ? '#027A48'
                                  : isNegative
                                  ? '#B42318'
                                  : 'var(--rm-ink-muted)',
                              }}
                            >
                              {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Section: Audit Log ──────────────────────────────────────────────────────

interface AuditLogProps {
  auditLogs: AuditLogRow[];
  filter: string;
  onFilterChange: (v: string) => void;
}

function SectionAuditLog({ auditLogs, filter, onFilterChange }: AuditLogProps) {
  const filtered = filter.trim()
    ? auditLogs.filter((l) =>
        l.actor.toLowerCase().includes(filter.toLowerCase())
      )
    : auditLogs;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-base font-semibold" style={{ color: 'var(--rm-ink)' }}>
            Audit Log
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--rm-ink-muted)' }}>
            Reverse-chronological system activity feed.
          </p>
        </div>
        <input
          type="text"
          placeholder="Filter by actor…"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border outline-none shrink-0"
          style={{
            borderColor: 'var(--rm-border)',
            backgroundColor: 'var(--rm-surface)',
            color: 'var(--rm-ink)',
          }}
        />
      </div>
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--rm-surface)', borderColor: 'var(--rm-border)' }}
      >
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
          <ul>
            {filtered.length === 0 ? (
              <li
                className="p-6 text-center text-sm"
                style={{ color: 'var(--rm-ink-muted)' }}
              >
                {filter ? 'No logs match that actor.' : 'No audit logs found.'}
              </li>
            ) : (
              filtered.map((log) => (
                <li
                  key={log.id}
                  className="p-4 flex items-start gap-4 border-b last:border-b-0 transition-colors"
                  style={{ borderColor: 'var(--rm-border)' }}
                >
                  <div
                    className="font-mono text-xs shrink-0 mt-0.5 tabular-nums"
                    style={{ color: 'var(--rm-ink-muted)' }}
                  >
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </div>
                  <div className="text-sm min-w-0">
                    <span className="font-semibold" style={{ color: 'var(--rm-ink)' }}>
                      {log.actor}
                    </span>
                    <span className="mx-1" style={{ color: 'var(--rm-ink-muted)' }}>
                      {log.action}
                    </span>
                    <span
                      className="font-mono text-xs"
                      style={{ color: 'var(--rm-ink-muted)' }}
                    >
                      {log.entityType} ({log.entityId.slice(-6)})
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconOverview() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function IconRisk() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function IconApprovals() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconMessages() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  );
}

function IconLearning() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
    </svg>
  );
}

function IconAudit() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  );
}

// ─── Nav config ──────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <IconOverview /> },
  { id: 'risk-events', label: 'Risk Events', icon: <IconRisk /> },
  { id: 'approvals', label: 'Approvals', icon: <IconApprovals /> },
  { id: 'messages', label: 'Messages', icon: <IconMessages /> },
  { id: 'learning', label: 'Learning', icon: <IconLearning /> },
  { id: 'audit', label: 'Audit Log', icon: <IconAudit /> },
];

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [loading, setLoading] = useState(true);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [generatingMessages, setGeneratingMessages] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [auditFilter, setAuditFilter] = useState('');

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [riskEvents, setRiskEvents] = useState<RiskEventRow[]>([]);
  const [interventions, setInterventions] = useState<InterventionRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);

  // ── Data fetching (unchanged) ────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumRes, riskRes, intRes, auditRes, learningRes] = await Promise.all([
        fetch('/api/dashboard/summary'),
        fetch('/api/dashboard/risk-events'),
        fetch('/api/dashboard/interventions?status=pending|pending_human_approval'),
        fetch('/api/dashboard/audit-log'),
        fetch('/api/dashboard/learning-stats'),
      ]);

      const sumData = await sumRes.json();
      const riskData = await riskRes.json();
      const intData = await intRes.json();
      const auditData = await auditRes.json();
      const learningData = await learningRes.json();

      setSummary(sumData);
      setRiskEvents(riskData);
      setInterventions(intData);
      setAuditLogs(auditData);
      setLearningStats(learningData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  // ── Action handlers (unchanged) ─────────────────────────────────────────

  const runPipeline = async () => {
    setRunningPipeline(true);
    try {
      await fetch('/api/agents/run-pipeline', { method: 'POST' });
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setRunningPipeline(false);
    }
  };

  const generateMessages = async () => {
    setGeneratingMessages(true);
    try {
      await fetch('/api/agents/generate-messages', { method: 'POST' });
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingMessages(false);
    }
  };

  const simulateOutcomes = async () => {
    setSimulating(true);
    try {
      await fetch('/api/agents/simulate-outcomes', { method: 'POST' });
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await fetch(`/api/dashboard/interventions/${id}/approve`, { method: 'POST' });
      setInterventions((prev) => prev.filter((i) => i.id !== id));
      fetchData(); // Refresh summary and logs
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await fetch(`/api/dashboard/interventions/${id}/reject`, { method: 'POST' });
      setInterventions((prev) => prev.filter((i) => i.id !== id));
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // ── Derived values ───────────────────────────────────────────────────────

  const pendingApprovals = interventions.filter((i) => i.status === 'pending_human_approval');
  const pendingCount = pendingApprovals.length;

  const riskChartData = summary
    ? [
        { name: 'Transaction', amount: summary.riskBySourceType.transaction },
        { name: 'Checkout', amount: summary.riskBySourceType.checkout },
        { name: 'Invoice', amount: summary.riskBySourceType.invoice },
      ]
    : [];

  const interventionChartData = summary
    ? [
        { name: 'Reminder', count: summary.interventionsByAction.reminder },
        { name: 'Retry', count: summary.interventionsByAction.retry },
        { name: 'Disc 5%', count: summary.interventionsByAction.discount_5 },
        { name: 'Disc 10%', count: summary.interventionsByAction.discount_10 },
        { name: 'Waiver', count: summary.interventionsByAction.waiver },
        { name: 'Escal (Ec)', count: summary.interventionsByAction.escalation_economic },
        { name: 'Escal (Gd)', count: summary.interventionsByAction.escalation_guardrail },
      ]
    : [];

  const budgetPct = summary
    ? Math.min(100, (summary.budgetAllocated / summary.budgetTotal) * 100)
    : 0;

  // ── Loading splash ───────────────────────────────────────────────────────

  if (loading && !summary) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--rm-bg)', color: 'var(--rm-ink-muted)' }}
      >
        <p className="text-sm">Loading dashboard…</p>
      </div>
    );
  }

  // ── Shell ────────────────────────────────────────────────────────────────

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--rm-bg)', color: 'var(--rm-ink)' }}
    >
      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <header
        className="h-14 shrink-0 border-b flex items-center px-4 gap-3"
        style={{ backgroundColor: 'var(--rm-surface)', borderColor: 'var(--rm-border)' }}
      >
        {/* Wordmark */}
        <span
          className="text-sm font-bold tracking-tight shrink-0"
          style={{ color: 'var(--rm-ink)' }}
        >
          RevenueMind
        </span>

        <div className="h-4 w-px shrink-0" style={{ backgroundColor: 'var(--rm-border)' }} />

        {/* Stat strip — flex-1 so it naturally fills space between wordmark and buttons */}
        {summary && (
          <div className="flex-1 flex items-center justify-center gap-4 overflow-hidden min-w-0">
            {/* Always visible: the two primary money stats */}
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="text-xs" style={{ color: 'var(--rm-ink-muted)' }}>At Risk</span>
              <span
                className="font-mono text-sm font-semibold tabular-nums"
                style={{ color: 'var(--rm-accent-risk)' }}
              >
                {fmt(summary.revenueAtRisk)}
              </span>
            </div>

            <div className="h-3 w-px shrink-0" style={{ backgroundColor: 'var(--rm-border)' }} />

            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="text-xs" style={{ color: 'var(--rm-ink-muted)' }}>Recoverable</span>
              <span
                className="font-mono text-sm font-semibold tabular-nums"
                style={{ color: 'var(--rm-accent-recover)' }}
              >
                {fmt(summary.expectedRecoverable)}
              </span>
            </div>

            {/* Hidden below sm to keep the bar from cramping */}
            <div className="hidden sm:block h-3 w-px shrink-0" style={{ backgroundColor: 'var(--rm-border)' }} />

            <div className="hidden sm:flex items-baseline gap-1.5 shrink-0">
              <span className="text-xs" style={{ color: 'var(--rm-ink-muted)' }}>Rate</span>
              <span
                className="font-mono text-sm font-semibold tabular-nums"
                style={{ color: 'var(--rm-ink)' }}
              >
                {summary.recoveryRatePct.toFixed(1)}%
              </span>
            </div>

            <div className="hidden md:block h-3 w-px shrink-0" style={{ backgroundColor: 'var(--rm-border)' }} />

            <div className="hidden md:flex items-baseline gap-1.5 shrink-0">
              <span className="text-xs" style={{ color: 'var(--rm-ink-muted)' }}>Budget Left</span>
              <span
                className="font-mono text-sm font-semibold tabular-nums"
                style={{ color: 'var(--rm-ink)' }}
              >
                {fmt(summary.budgetRemaining)}
              </span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={generateMessages}
            disabled={generatingMessages || runningPipeline}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold border disabled:opacity-50 transition-opacity hover:opacity-80"
            style={{
              color: 'var(--rm-accent-escalate)',
              borderColor: 'var(--rm-accent-escalate)',
              backgroundColor: 'transparent',
            }}
          >
            <span className="hidden lg:inline">
              {generatingMessages ? 'Generating…' : 'Generate Messages'}
            </span>
            <span className="lg:hidden">Messages</span>
          </button>
          <button
            onClick={runPipeline}
            disabled={runningPipeline || generatingMessages}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--rm-accent-recover)' }}
          >
            <span className="hidden lg:inline">
              {runningPipeline ? 'Running…' : 'Run Recovery Pipeline'}
            </span>
            <span className="lg:hidden">Run Pipeline</span>
          </button>
        </div>
      </header>

      {/* ── Body: Sidebar + Main ────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — icon-only below lg, full labels at lg+ */}
        <nav
          className="w-12 lg:w-[220px] shrink-0 border-r flex flex-col py-2 overflow-y-auto transition-none"
          style={{
            backgroundColor: 'var(--rm-surface)',
            borderColor: 'var(--rm-border)',
          }}
        >
          <div className="flex flex-col">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  title={item.label}
                  className="flex items-center gap-3 mx-1.5 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-colors relative"
                  style={{
                    backgroundColor: isActive
                      ? 'var(--rm-accent-escalate)'
                      : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--rm-ink-muted)',
                  }}
                >
                  {item.icon}
                  <span className="hidden lg:block whitespace-nowrap">{item.label}</span>

                  {/* Badge — full count at lg+, dot indicator below.
                      Both use --rm-accent-escalate (purple): escalation-related
                      UI stays semantically distinct from risk-amount amber. */}
                  {item.id === 'approvals' && pendingCount > 0 && (
                    <>
                      <span
                        className="hidden lg:flex ml-auto items-center justify-center min-w-5 h-5 rounded-full text-xs font-bold px-1"
                        style={{ backgroundColor: 'var(--rm-accent-escalate)', color: '#fff' }}
                      >
                        {pendingCount}
                      </span>
                      <span
                        className="lg:hidden absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                        style={{ backgroundColor: 'var(--rm-accent-escalate)' }}
                      />
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Main content — this is the element that scrolls when a section's
            content exceeds the available viewport height. Tables inside each
            section also have their own overflow-y-auto for independent scroll. */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeSection === 'overview' && summary && (
            <SectionOverview
              summary={summary}
              riskEvents={riskEvents}
              budgetPct={budgetPct}
              riskChartData={riskChartData}
              interventionChartData={interventionChartData}
              onViewAll={() => setActiveSection('risk-events')}
            />
          )}
          {activeSection === 'risk-events' && (
            <SectionRiskEvents riskEvents={riskEvents} />
          )}
          {activeSection === 'approvals' && (
            <SectionApprovals
              pendingApprovals={pendingApprovals}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}
          {activeSection === 'messages' && (
            <SectionMessages
              interventions={interventions}
              generatingMessages={generatingMessages}
              runningPipeline={runningPipeline}
              onGenerate={generateMessages}
            />
          )}
          {activeSection === 'learning' && (
            <SectionLearning
              learningStats={learningStats}
              simulating={simulating}
              onSimulate={simulateOutcomes}
            />
          )}
          {activeSection === 'audit' && (
            <SectionAuditLog
              auditLogs={auditLogs}
              filter={auditFilter}
              onFilterChange={setAuditFilter}
            />
          )}
        </main>
      </div>
    </div>
  );
}
