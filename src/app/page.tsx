import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-purple-200">
      {/* Hero Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-24 sm:py-32 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              <span className="block">RevenueMind</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                AI Revenue Recovery Agent
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Autonomous multi-agent system that detects, diagnoses, and recovers at-risk revenue before it's lost. 
              Reduce churn and increase cash flow with intelligent, context-aware interventions.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/dashboard"
                className="rounded-lg bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 transition-colors"
              >
                Go to Command Center →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Section */}
      <div className="py-24 sm:py-32 max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            The Autonomous Recovery Pipeline
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            RevenueMind uses a network of specialized agents to handle the entire recovery lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Detect & Understand */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">1. Detect & Understand</h3>
            <p className="text-gray-600">
              The <span className="font-semibold text-blue-600">Risk Agent</span> monitors transactions, checkouts, and invoices. 
              The <span className="font-semibold text-blue-600">Root Cause Agent</span> analyzes failures to determine why the risk occurred.
            </p>
          </div>

          {/* Decide */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">2. Decide</h3>
            <p className="text-gray-600">
              The <span className="font-semibold text-purple-600">Strategy Agent</span> determines the optimal intervention (reminders, discounts, waivers). 
              The <span className="font-semibold text-purple-600">Guardrail Agent</span> ensures actions stay within budget and policy limits.
            </p>
          </div>

          {/* Act & Monitor */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">3. Act & Monitor</h3>
            <p className="text-gray-600">
              The <span className="font-semibold text-orange-600">Messaging Agent</span> generates empathetic, localized messages. 
              The system simulates or waits for real-world outcomes.
            </p>
          </div>

          {/* Recover & Learn */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">4. Recover & Learn</h3>
            <p className="text-gray-600">
              The <span className="font-semibold text-green-600">Learning Agent</span> observes actual success rates and continuously refines the system's heuristics for future interventions.
            </p>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-gray-500">
          RevenueMind — AI Revenue Recovery Agent. Ready for production.
        </div>
      </footer>
    </div>
  );
}
