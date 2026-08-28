"use client";

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

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
}

interface AuditLogRow {
  id: string; timestamp: string; actor: string; action: string;
  entityType: string; entityId: string;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [runningPipeline, setRunningPipeline] = useState(false);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [riskEvents, setRiskEvents] = useState<RiskEventRow[]>([]);
  const [interventions, setInterventions] = useState<InterventionRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);

  const fetchData = async () => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    try {
      const [sumRes, riskRes, intRes, auditRes] = await Promise.all([
        fetch('/api/dashboard/summary'),
        fetch('/api/dashboard/risk-events'),
        fetch('/api/dashboard/interventions?status=pending|pending_human_approval'),
        fetch('/api/dashboard/audit-log')
      ]);

      const sumData = await sumRes.json();
      const riskData = await riskRes.json();
      const intData = await intRes.json();
      const auditData = await auditRes.json();

      setSummary(sumData);
      setRiskEvents(riskData);
      setInterventions(intData);
      setAuditLogs(auditData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleApprove = async (id: string) => {
    try {
      await fetch(`/api/dashboard/interventions/${id}/approve`, { method: 'POST' });
      setInterventions(prev => prev.filter(i => i.id !== id));
      fetchData(); // Refresh summary and logs
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await fetch(`/api/dashboard/interventions/${id}/reject`, { method: 'POST' });
      setInterventions(prev => prev.filter(i => i.id !== id));
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  if (loading && !summary) {
    return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;
  }

  // Prepare chart data
  const riskChartData = summary ? [
    { name: 'Transaction', amount: summary.riskBySourceType.transaction },
    { name: 'Checkout', amount: summary.riskBySourceType.checkout },
    { name: 'Invoice', amount: summary.riskBySourceType.invoice }
  ] : [];

  const interventionChartData = summary ? [
    { name: 'Reminder', count: summary.interventionsByAction.reminder },
    { name: 'Retry', count: summary.interventionsByAction.retry },
    { name: 'Discount 5%', count: summary.interventionsByAction.discount_5 },
    { name: 'Discount 10%', count: summary.interventionsByAction.discount_10 },
    { name: 'Waiver', count: summary.interventionsByAction.waiver },
    { name: 'Escalation (Econ)', count: summary.interventionsByAction.escalation_economic },
    { name: 'Escalation (Guard)', count: summary.interventionsByAction.escalation_guardrail }
  ] : [];

  const budgetPct = summary ? Math.min(100, (summary.budgetAllocated / summary.budgetTotal) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Revenue Recovery Command Center</h1>
            <p className="text-gray-500 mt-1">AI-powered recovery operations and monitoring</p>
          </div>
          <button
            onClick={runPipeline}
            disabled={runningPipeline}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50 transition-colors"
          >
            {runningPipeline ? 'Running Pipeline...' : 'Run Recovery Pipeline'}
          </button>
        </div>

        {summary && (
          <>
            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-sm text-gray-500 font-medium">Revenue at Risk</div>
                <div className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(summary.revenueAtRisk)}</div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-sm text-gray-500 font-medium">Expected Recoverable</div>
                <div className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.expectedRecoverable)}</div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-sm text-gray-500 font-medium">Recovery Rate</div>
                <div className="text-2xl font-bold text-blue-600 mt-1">{summary.recoveryRatePct.toFixed(1)}%</div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-sm text-gray-500 font-medium">Customers at Risk</div>
                <div className="text-2xl font-bold text-gray-800 mt-1">{summary.customersAtRisk}</div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-sm text-gray-500 font-medium">Needing Review</div>
                <div className="text-2xl font-bold text-orange-600 mt-1">{summary.pendingHumanApprovalCount}</div>
              </div>
            </div>

            {/* Budget Panel */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-end mb-2">
                <h2 className="text-lg font-semibold">Budget Allocation (Optimizer)</h2>
                <div className="text-sm">
                  <span className="text-gray-500">Remaining: </span>
                  <span className="font-bold text-green-600">{formatCurrency(summary.budgetRemaining)}</span>
                  <span className="text-gray-400 mx-2">/</span>
                  <span className="text-gray-500">Total: {formatCurrency(summary.budgetTotal)}</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div 
                  className="bg-blue-600 h-4 transition-all duration-500" 
                  style={{ width: `${budgetPct}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-400 mt-2 text-right">
                {formatCurrency(summary.budgetAllocated)} allocated so far
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80">
                <h2 className="text-lg font-semibold mb-4">Risk by Source Type</h2>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `₹${value / 1000}k`} />
                    <RechartsTooltip formatter={(value: any) => [formatCurrency(Number(value) || 0), 'Amount']} />
                    <Bar dataKey="amount" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80">
                <h2 className="text-lg font-semibold mb-4">Interventions by Action Type</h2>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={interventionChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{fontSize: 12}} interval={0} angle={-30} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* Guardrail Escalation Review Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-orange-50/50">
            <h2 className="text-lg font-semibold text-orange-800">Guardrail Escalation Review</h2>
            <p className="text-sm text-orange-600 mt-1">Interventions blocked by policy rules pending your approval.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Context</th>
                  <th className="px-6 py-3">Violated Rule</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {interventions.filter(i => i.status === 'pending_human_approval').length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400">No escalations pending review.</td>
                  </tr>
                ) : (
                  interventions.filter(i => i.status === 'pending_human_approval').map(inv => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{inv.customerName}</td>
                      <td className="px-6 py-4">
                        <div className="capitalize">{inv.sourceType}</div>
                        <div className="text-gray-500 font-mono text-xs">{formatCurrency(inv.amountAtRisk)} at risk</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded border border-red-200">
                          {inv.violatedRule || 'Unknown policy'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => handleReject(inv.id)} className="text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 font-medium rounded-lg text-xs px-3 py-1.5">Reject</button>
                        <button onClick={() => handleApprove(inv.id)} className="text-white bg-green-600 hover:bg-green-700 font-medium rounded-lg text-xs px-3 py-1.5">Approve</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Risk Events Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold">Top Risk Events</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Source</th>
                  <th className="px-6 py-3">Amount at Risk</th>
                  <th className="px-6 py-3">Predicted Reason</th>
                  <th className="px-6 py-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {riskEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">No risk events found.</td>
                  </tr>
                ) : (
                  riskEvents.map(event => (
                    <tr key={event.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">{event.customerName}</td>
                      <td className="px-6 py-4 capitalize">{event.sourceType}</td>
                      <td className="px-6 py-4 font-mono">{formatCurrency(event.amountAtRisk)}</td>
                      <td className="px-6 py-4 text-gray-600">{event.predictedReason || '-'}</td>
                      <td className="px-6 py-4">
                        {event.confidence ? (
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mr-2 max-w-[4rem]">
                              <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${event.confidence * 100}%` }}></div>
                            </div>
                            <span className="text-xs text-gray-500">{(event.confidence * 100).toFixed(0)}%</span>
                          </div>
                        ) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Trail */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold">System Audit Trail</h2>
          </div>
          <div className="p-0 max-h-96 overflow-y-auto">
            <ul className="divide-y divide-gray-100">
              {auditLogs.length === 0 ? (
                <li className="p-6 text-center text-gray-400">No audit logs found.</li>
              ) : (
                auditLogs.map(log => (
                  <li key={log.id} className="p-4 hover:bg-gray-50 flex items-start gap-4">
                    <div className="text-xs text-gray-400 whitespace-nowrap mt-1">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div>
                      <span className="font-bold text-gray-900">{log.actor}</span>
                      <span className="text-gray-600 mx-1">{log.action}</span>
                      <span className="text-gray-500 font-mono text-xs">{log.entityType} ({log.entityId.slice(-6)})</span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
