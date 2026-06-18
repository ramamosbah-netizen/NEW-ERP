'use client';

// ============================================================
// Aura ERP — /admin → Control Center
// The former standalone "Administration Center" launcher has been folded into
// the unified Governance & Control Center (/admin/hub) so there is a single
// admin command surface. This route now redirects there; every deep link and
// the existing navigation continue to work.
// ============================================================

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminIndexPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/hub'); }, [router]);
  return (
    <div className="flex items-center justify-center py-32">
      <div className="h-7 w-7 border-2 border-[var(--border)] border-t-[var(--text-primary)] animate-spin rounded-full" />
    </div>
  );
}
