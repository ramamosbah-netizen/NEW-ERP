// ============================================================
// JEET ERP — User Alert Channels Preference Page
// Route: /notifications/preferences
// ============================================================

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import PreferencesMatrix from '@/components/notifications/PreferencesMatrix';
import { ArrowLeft, Sliders } from 'lucide-react';

export default function PreferencesPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen w-full relative z-10">
<main className="quote-container flex-1 py-8 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/notifications')}
            className="p-2 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
            title="Back to Alerts Logs"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="quote-header-title flex items-center gap-2">
              <Sliders className="text-[var(--accent)]" size={24} />
              Alert preferences Control
            </h1>
            <p className="quote-header-subtitle">Configure preferred alert delivery formats and digest rates.</p>
          </div>
        </div>

        {/* Preferences Matrix Table */}
        <PreferencesMatrix />
      </main>
    </div>
  );
}
