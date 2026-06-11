// ============================================================
// JEET ERP — Team Workload Heat Index Page
// Route: /tasks/workload
// ============================================================

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import WorkloadHeatStrip from '@/components/tasks/WorkloadHeatStrip';
import { ArrowLeft, BarChart2 } from 'lucide-react';

export default function WorkloadPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen w-full relative z-10">
<main className="quote-container flex-1 py-8 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/tasks')}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/20 transition-all"
              title="Back to Tasks"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="quote-header-title flex items-center gap-2">
                <BarChart2 className="text-emerald-400" size={24} />
                Team Capacity Registry
              </h1>
              <p className="quote-header-subtitle">Realtime capacity logs evaluating task queue density across team roles.</p>
            </div>
          </div>
        </div>

        {/* Workload Heat Strip Component */}
        <WorkloadHeatStrip />
      </main>
    </div>
  );
}
