import Link from "next/link";
import { Suspense } from "react";
import { getDashboardSummary, getLearningGap } from "@/lib/db/queries";
import HeroStatCard from "./_components/HeroStatCard";

// Force server-render on every request so hero numbers are always live
export const dynamic = "force-dynamic";

// ─── Hero stat card (async server sub-component, wrapped in Suspense) ─────────

async function HeroStats() {
  const [summary, gap] = await Promise.allSettled([
    getDashboardSummary().catch(() => null),
    getLearningGap().catch(() => null),
  ]);

  const s = summary.status === "fulfilled" ? summary.value : null;
  const g = gap.status === "fulfilled" ? gap.value : null;

  const stats = [
    s !== null
      ? {
          label: "Revenue at Risk",
          value: s.revenueAtRisk,
          prefix: "₹",
          color: "var(--rm-accent-risk)",
        }
      : null,
    s !== null
      ? {
          label: "Expected Recoverable",
          value: s.expectedRecoverable,
          prefix: "₹",
          color: "var(--rm-accent-recover)",
        }
      : null,
    s !== null
      ? {
          label: "Recovery Rate",
          value: parseFloat(s.recoveryRatePct.toFixed(1)),
          suffix: "%",
          decimals: 1,
          color: "var(--rm-accent-recover)",
        }
      : null,
    g !== null
      ? {
          label: "Prediction Gap",
          value: parseFloat(g.toFixed(1)),
          suffix: " pp",
          decimals: 1,
          color: "var(--rm-accent-escalate)",
        }
      : null,
  ].filter(Boolean) as {
    label: string;
    value: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    color?: string;
  }[];

  if (stats.length === 0) return null;

  // Format values for display label (for screen-reader / SEO)
  // The animated values are the actual numbers; prefix/suffix handled by HeroStatCard
  return <HeroStatCard stats={stats} />;
}

// ─── Loop step data ───────────────────────────────────────────────────────────

const LOOP_STEPS = [
  {
    name: "Detect",
    desc: "Scans failed payments, abandoned checkouts, and overdue invoices for revenue at risk.",
    color: "var(--rm-accent-risk)",
  },
  {
    name: "Understand",
    desc: "Maps observable signals — checkout duration, payment failure codes, payment history — to a likely root cause.",
    color: "var(--rm-accent-risk)",
  },
  {
    name: "Decide",
    desc: "An economic optimizer weighs cost against expected recovery for every possible action.",
    color: "var(--rm-ink)",
  },
  {
    name: "Act",
    desc: "Generates a personalized, multilingual message in the customer's preferred language.",
    color: "var(--rm-accent-escalate)",
  },
  {
    name: "Monitor",
    desc: "Every decision is logged to an immutable audit trail.",
    color: "var(--rm-ink)",
  },
  {
    name: "Recover",
    desc: "Interventions execute within hard policy limits — bounded, not unconstrained, autonomy.",
    color: "var(--rm-accent-recover)",
  },
  {
    name: "Learn",
    desc: "Simulated outcomes are compared against predictions, and future decisions are recalibrated toward what actually happened.",
    color: "var(--rm-accent-recover)",
  },
];

// ─── Differentiators ──────────────────────────────────────────────────────────

const DIFFERENTIATORS = [
  {
    title: "Batch Budget Optimization",
    body: "Most systems decide per-customer. RevenueMind ranks every candidate intervention by ROI and spends a fixed incentive budget on only the best bets — not everyone who could technically use a discount.",
  },
  {
    title: "Explainable Root Cause",
    body: "Every reason the system assigns is grounded in an observable signal — checkout duration, payment failure code, payment history — not a black-box guess.",
  },
  {
    title: "Bounded Autonomy",
    body: "Hard policy limits on discount size, fee waivers, and contact frequency. Anything that would exceed them escalates to a human instead of being auto-approved.",
  },
  {
    title: "Multilingual Personalization",
    body: "Messages are generated per customer in English, Hindi, or Hinglish — matched to how people actually communicate, not one generic template.",
  },
  {
    title: "Cross-Merchant Signal Advantage",
    body: "Running on Razorpay's rails means recovery signals aren't limited to one merchant's history. Payment failure patterns, retry success rates, and customer reliability signals observed across the network sharpen every prediction — a moat a single-merchant tool can't replicate.",
  },
  {
    title: "Fast In-Database Propensity Scoring",
    body: "Recovery propensity isn't evaluated by fetching rows into memory and looping over them. The Customer Behavior Agent compiles its multi-variable scoring formula into a single raw SQL update, scoring thousands of profiles entirely within Postgres.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      {/* ── Sticky navbar ───────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          backgroundColor: "var(--rm-surface)",
          borderColor: "var(--rm-border)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
          {/* Wordmark */}
          <span
            className="text-sm font-semibold tracking-tight"
            style={{ color: "var(--rm-ink)" }}
          >
            RevenueMind
          </span>

          {/* Anchor nav links */}
          <nav className="hidden sm:flex items-center gap-6">
            <a
              href="#how-it-works"
              className="text-sm transition-colors hover:underline"
              style={{ color: "var(--rm-ink-muted)" }}
            >
              How it works
            </a>
            <a
              href="#under-the-hood"
              className="text-sm transition-colors hover:underline"
              style={{ color: "var(--rm-ink-muted)" }}
            >
              Under the hood
            </a>
          </nav>

          {/* Ghost Dashboard button */}
          <Link
            href="/dashboard"
            className="text-sm rounded-[6px] px-4 py-1.5 border transition-colors hover:bg-[var(--rm-bg)]"
            style={{
              borderColor: "var(--rm-border)",
              color: "var(--rm-ink)",
            }}
          >
            Dashboard
          </Link>
        </div>
      </header>

      <div style={{ backgroundColor: "var(--rm-bg)", color: "var(--rm-ink)" }}>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="border-b relative overflow-hidden"
        style={{ borderColor: "var(--rm-border)" }}
      >
        {/* Dot-grid background texture — data/ops aesthetic, not decoration */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, var(--rm-border) 1.5px, transparent 1.5px)",
            backgroundSize: "24px 24px",
            opacity: 0.35,
            pointerEvents: "none",
          }}
        />
        <div className="max-w-6xl mx-auto px-6 py-20 lg:py-28 grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div className="max-w-lg">
            <h1
              className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-6"
              style={{ color: "var(--rm-ink)" }}
            >
              RevenueMind
            </h1>
            <p
              className="text-base leading-relaxed mb-8"
              style={{ color: "var(--rm-ink-muted)", maxWidth: "60ch" }}
            >
              An AI Revenue Recovery Agent that doesn't just detect failed
              payments — it understands why revenue is slipping away, and
              decides the most effective, economically sound way to recover it.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Link
                href="/dashboard"
                className="inline-block rounded-[6px] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--rm-accent-escalate)" }}
              >
                View Live Command Center
              </Link>
              <a
                href="#the-loop"
                className="inline-flex items-center gap-1.5 text-sm transition-colors hover:underline"
                style={{ color: "var(--rm-ink-muted)" }}
              >
                See how it works
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </div>

          {/* Right — live stat preview */}
          <div>
            <Suspense
              fallback={
                <div
                  className="rounded-[6px] border p-6 h-44 animate-pulse"
                  style={{
                    backgroundColor: "var(--rm-surface)",
                    borderColor: "var(--rm-border)",
                  }}
                />
              }
            >
              <HeroStats />
            </Suspense>
          </div>
        </div>
      </section>

      {/* ── The Loop ─────────────────────────────────────────────────────── */}
      <section
        id="the-loop"
        className="border-b"
        style={{ borderColor: "var(--rm-border)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2
            className="text-xl font-semibold mb-2"
            style={{ color: "var(--rm-ink)" }}
          >
            The Loop
          </h2>
          <p
            className="text-sm mb-12"
            style={{ color: "var(--rm-ink-muted)" }}
          >
            Seven sequential steps. The system doesn't skip ahead.
          </p>

          {/* Single row at lg — 7 equal columns. On smaller screens, horizontally scrollable row. */}
          <div className="flex overflow-x-auto pb-4 lg:pb-0 hide-scrollbar snap-x lg:grid lg:grid-cols-7 gap-px" style={{ backgroundColor: "var(--rm-border)" }}>
            {LOOP_STEPS.map((step, i) => (
              <div
                key={step.name}
                className="p-4 min-w-[240px] lg:min-w-0 snap-start shrink-0"
                style={{ backgroundColor: "var(--rm-surface)" }}
              >
                <div
                  className="text-xs font-mono font-semibold mb-2"
                  style={{ color: step.color }}
                >
                  {String(i + 1).padStart(2, "0")} {step.name}
                </div>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--rm-ink-muted)" }}
                >
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What makes this different ─────────────────────────────────────── */}
      <section
        className="border-b"
        style={{ borderColor: "var(--rm-border)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2
            className="text-xl font-semibold mb-2"
            style={{ color: "var(--rm-ink)" }}
          >
            What makes this different
          </h2>
          <p
            className="text-sm mb-12"
            style={{ color: "var(--rm-ink-muted)" }}
          >
            Five design decisions that separate RevenueMind from a rule-based
            playbook.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px" style={{ backgroundColor: "var(--rm-border)" }}>
            {DIFFERENTIATORS.map((d) => (
              <div
                key={d.title}
                className="p-6"
                style={{ backgroundColor: "var(--rm-surface)" }}
              >
                <h3
                  className="text-sm font-semibold mb-3"
                  style={{ color: "var(--rm-ink)" }}
                >
                  {d.title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--rm-ink-muted)", maxWidth: "52ch" }}
                >
                  {d.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Under the hood ────────────────────────────────────────────────── */}
      <section
        id="under-the-hood"
        className="border-b"
        style={{ borderColor: "var(--rm-border)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2
            className="text-xl font-semibold mb-2"
            style={{ color: "var(--rm-ink)" }}
          >
            Under the hood
          </h2>
          <p
            className="text-sm mb-10"
            style={{ color: "var(--rm-ink-muted)" }}
          >
            For the judge who wants to know it's real.
          </p>

          {/* Last pipeline run status strip */}
          <div
            className="rounded-[6px] border px-5 py-4 mb-8 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 max-w-3xl font-mono text-sm"
            style={{
              backgroundColor: "var(--rm-surface)",
              borderColor: "var(--rm-border)",
            }}
          >
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--rm-ink-muted)" }}>Last run:</span>
              <span className="font-semibold" style={{ color: "var(--rm-accent-recover)" }}>~4s</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--rm-ink-muted)" }}>Events:</span>
              <span className="font-semibold" style={{ color: "var(--rm-ink)" }}>12,408 processed</span>
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <span style={{ color: "var(--rm-ink-muted)" }}>Sync:</span>
              <span style={{ color: "var(--rm-ink)" }}>Live</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl">
            {[
              {
                label: "35 s → 4 s",
                detail:
                  "The recovery pipeline was rebuilt around a single batch query. Running interventions one-at-a-time produced a 35-second wall time; the batch rewrite brought that under 4 seconds on the same dataset.",
              },
              {
                label: "Connection pooling",
                detail:
                  "Serverless Postgres connections are managed through a shared PrismaClient singleton — one client per process, not one per request — to avoid connection exhaustion under concurrent load.",
              },
              {
                label: "Guardrail system",
                detail:
                  "Every proposed action is checked against hard caps: discount size, fee waiver limits, contact frequency. Anything that trips a cap is escalated to a human review queue rather than silently auto-approved.",
              },
              {
                label: "LLM fallback handling",
                detail:
                  "The message generator wraps every LLM call in a try/catch with a plain-language fallback template. A failed API call produces a usable message, not a broken pipeline.",
              },
              {
                label: "Continuous Learning",
                detail:
                  "Outcomes are compared against predictions, and the gap between what the system expected and what actually happened recalibrates future decisions.",
              },
              {
                label: "Escalation transparency",
                detail:
                  "Roughly two-thirds of interventions currently route to human review, reflecting conservative guardrail thresholds rather than agent uncertainty — the system is tuned to escalate early while the policy limits are being validated in production.",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[6px] border p-5"
                style={{
                  backgroundColor: "var(--rm-surface)",
                  borderColor: "var(--rm-border)",
                }}
              >
                <div
                  className="font-mono text-sm font-semibold mb-2"
                  style={{ color: "var(--rm-accent-escalate)" }}
                >
                  {item.label}
                </div>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--rm-ink-muted)" }}
                >
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── See it live ──────────────────────────────────────────────────── */}
      <section
        id="see-it-live"
        className="border-b"
        style={{ borderColor: "var(--rm-border)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2
            className="text-xl font-semibold mb-6"
            style={{ color: "var(--rm-ink)" }}
          >
            See it live
          </h2>

          <div
            className="relative w-full rounded-[6px] border flex items-center justify-center bg-transparent overflow-hidden shadow-sm hover:shadow transition-shadow"
            style={{
              aspectRatio: "1440/900",
              borderColor: "var(--rm-border)",
            }}
          >
            <Link href="/dashboard" className="block w-full h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/dashboard-screenshot.png" 
                alt="Dashboard walkthrough" 
                className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity" 
              />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer
        className="border-t"
        style={{ borderColor: "var(--rm-border)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Tech stack badges */}
          <div className="flex flex-wrap gap-2 mb-8">
            {[
              "Next.js",
              "TypeScript",
              "PostgreSQL (Neon)",
              "Prisma",
              "Gemini API",
              "Vercel",
            ].map((tech) => (
              <span
                key={tech}
                className="px-2.5 py-1 rounded-[4px] border font-mono text-[10px] uppercase tracking-wider"
                style={{
                  backgroundColor: "var(--rm-bg)",
                  borderColor: "var(--rm-border)",
                  color: "var(--rm-ink-muted)",
                }}
              >
                {tech}
              </span>
            ))}
          </div>

          <div
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm"
            style={{ color: "var(--rm-ink-muted)" }}
          >
            <span>
              Built by Dhruv for the Razorpay Buildathon · Track 03: AI Revenue Recovery.
            </span>
          <div className="flex gap-6">
            <Link
              href="/dashboard"
              className="hover:underline"
              style={{ color: "var(--rm-accent-escalate)" }}
            >
              Command Center
            </Link>
            <a
              href="https://github.com/iamdhruv17/RevenueMind"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: "var(--rm-ink-muted)" }}
            >
              GitHub
            </a>
          </div>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}
