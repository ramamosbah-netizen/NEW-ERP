// ============================================================
// JEET ERP — App Shell (Sidebar + Topbar + Content Area)
// Wraps authenticated pages with navigation layout
// ============================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import AppSidebar from './AppSidebar';
import AppTopbar from './AppTopbar';
import { CommandPalette } from '@/components/ui/CommandPalette';
import './layout.css';

// Routes that should NOT show the shell (auth pages)
const NO_SHELL_ROUTES = ['/signin', '/signup'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sync sidebar state from localStorage (same key as AppSidebar)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('erp-sidebar-collapsed');
      if (saved !== null) setSidebarCollapsed(JSON.parse(saved));
    } catch {
      // Ignore
    }

    // Listen for sidebar toggle changes
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'erp-sidebar-collapsed' && e.newValue !== null) {
        setSidebarCollapsed(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorage);

    // Also observe the sidebar element for class changes
    const observer = new MutationObserver(() => {
      const sidebar = document.getElementById('erp-sidebar');
      if (sidebar) {
        setSidebarCollapsed(sidebar.classList.contains('collapsed'));
      }
    });

    const sidebar = document.getElementById('erp-sidebar');
    if (sidebar) {
      observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
      observer.disconnect();
    };
  }, []);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleMobileToggle = useCallback(() => {
    setMobileOpen(prev => !prev);
  }, []);

  // Check if current route is an auth route — render without shell
  const isAuthRoute = NO_SHELL_ROUTES.some(
    route => pathname === route || pathname?.startsWith(route + '/')
  );

  if (isAuthRoute) {
    return <>{children}</>;
  }

  // Root route (/) is a redirect page — render without shell
  if (pathname === '/') {
    return <>{children}</>;
  }

  return (
    <div className="erp-shell">
      <AppSidebar />

      <div
        className={`erp-shell-main ${
          sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'
        }`}
      >
        <AppTopbar onMobileMenuToggle={handleMobileToggle} />
        <main className="erp-shell-content">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
