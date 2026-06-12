// ============================================================
// JEET ERP — Slim Topbar with Breadcrumb + User Controls
// ============================================================

'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LogOut, Menu, ChevronRight, Sliders, Command, Sun, Moon } from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';

// Human-readable route labels
const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  myday: 'My Day',
  tasks: 'Tasks',
  workload: 'Workload',
  meetings: 'Meetings',
  notifications: 'Notifications',
  preferences: 'Preferences',
  tenders: 'Tenders',
  quotations: 'Quotations',
  projects: 'Projects',
  vo: 'Variation Orders',
  snags: 'Snag List',
  tc: 'Testing & Commissioning',
  handover: 'Handover',
  procurement: 'Procurement',
  comparisons: 'Comparisons',
  po: 'Purchase Orders',
  grn: 'Goods Receipt',
  pricing: 'Pricing Catalog',
  'service-desk': 'Service Desk',
  ppm: 'PPM',
  calendar: 'Calendar',
  amc: 'AMC Contracts',
  technician: 'Technician Hub',
  fleet: 'Fleet',
  fines: 'Fines',
  assets: 'Fixed Assets',
  depreciation: 'Depreciation',
  hr: 'HR / Employees',
  approvals: 'Approvals',
  compliance: 'Compliance',
  payroll: 'Payroll',
  eosb: 'End of Service',
  settlement: 'Settlement',
  sif: 'SIF File',
  timesheets: 'Timesheets',
  finance: 'Finance',
  ar: 'Receivables',
  ap: 'Payables',
  cashflow: 'Cash Flow',
  vat: 'VAT',
  aging: 'Aging Report',
  statement: 'Statement',
  payment: 'Payment',
  register: 'Register',
  schedule: 'Schedule',
  match: 'Match',
  documents: 'Documents',
  expiry: 'Expiry Tracker',
  review: 'Review',
  reports: 'Reports',
  whatsapp: 'WhatsApp',
  admin: 'Admin',
  settings: 'Settings',
  audit: 'Audit Log',
  'scoring-weights': 'Scoring Weights',
  create: 'Create New',
  new: 'New',
  edit: 'Edit',
  approve: 'Approve',
  pdf: 'PDF Preview',
  print: 'Print',
  boq: 'Bill of Quantities',
  execute: 'Execute',
  witness: 'Witness',
  renewal: 'Renewal',
  scorecard: 'Scorecard',
  capture: 'Capture',
  templates: 'Templates',
  signin: 'Sign In',
  signup: 'Sign Up',
};

interface AppTopbarProps {
  onMobileMenuToggle?: () => void;
}

export default function AppTopbar({ onMobileMenuToggle }: AppTopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<{
    full_name: string;
    role: string;
  } | null>(null);
  const [isCompact, setIsCompact] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('erp-density-compact');
    if (saved === 'true') {
      setIsCompact(true);
      document.body.classList.add('theme-compact');
    }
    const savedTheme = localStorage.getItem('erp-theme');
    if (savedTheme === 'light') {
      setIsDark(false);
      document.body.classList.add('theme-light');
    }
  }, []);

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      if (next) {
        document.body.classList.remove('theme-light');
        localStorage.setItem('erp-theme', 'dark');
      } else {
        document.body.classList.add('theme-light');
        localStorage.setItem('erp-theme', 'light');
      }
      return next;
    });
  };

  const toggleDensity = () => {
    setIsCompact(prev => {
      const next = !prev;
      if (next) {
        document.body.classList.add('theme-compact');
        localStorage.setItem('erp-density-compact', 'true');
      } else {
        document.body.classList.remove('theme-compact');
        localStorage.setItem('erp-density-compact', 'false');
      }
      return next;
    });
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setUserProfile(data);
            } else {
              setUserProfile({
                full_name: user.user_metadata?.full_name || 'ERP User',
                role: user.user_metadata?.role || 'engineer',
              });
            }
          });
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/signin');
  };

  // Build breadcrumb from pathname
  const segments = (pathname || '/')
    .split('/')
    .filter(Boolean)
    .filter(seg => !seg.startsWith('%5B') && !seg.startsWith('['));

  return (
    <header className="erp-topbar" id="erp-topbar">
      <div className="topbar-left">
        {/* Mobile hamburger */}
        <button
          className="topbar-hamburger"
          onClick={onMobileMenuToggle}
          title="Toggle menu"
          id="topbar-hamburger"
        >
          <Menu size={20} />
        </button>

        {/* Breadcrumb */}
        <div className="topbar-breadcrumb">
          {segments.length === 0 ? (
            <span className="topbar-breadcrumb-segment current">Home</span>
          ) : (
            segments.map((seg, idx) => {
              const isLast = idx === segments.length - 1;
              // Check if segment is a UUID (dynamic param)
              const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(seg);
              const label = isUUID
                ? `#${seg.substring(0, 8)}`
                : ROUTE_LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');

              return (
                <React.Fragment key={idx}>
                  {idx > 0 && (
                    <ChevronRight size={10} className="topbar-breadcrumb-sep" />
                  )}
                  <span
                    className={`topbar-breadcrumb-segment ${isLast ? 'current' : ''}`}
                  >
                    {label}
                  </span>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>

      <div className="topbar-right">
        {/* Global Search Shortcut hint */}
        <div className="hidden md:flex items-center gap-1 bg-[var(--bg-dark)] border border-[var(--border-color)] px-2 py-0.5 rounded text-[10px] text-[var(--text-muted)] font-mono font-bold">
          <Command size={10} />
          <span>K</span>
        </div>

        {/* Density Toggle */}
        <button
          onClick={toggleDensity}
          className="topbar-logout"
          title={isCompact ? 'Comfortable Mode' : 'Compact Mode'}
          style={{ color: isCompact ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          <Sliders size={14} />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="topbar-logout"
          title={isDark ? 'Light Mode' : 'Dark Mode'}
          style={{ color: isDark ? 'var(--text-muted)' : 'var(--warning)' }}
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Notification Bell */}
        <NotificationBell />

        {/* User Profile & Logout */}
        {userProfile && (
          <div className="topbar-user">
            <div className="topbar-user-info">
              <div className="topbar-user-name">{userProfile.full_name}</div>
              <div className="topbar-user-role">{userProfile.role}</div>
            </div>
            <button
              className="topbar-logout"
              onClick={handleLogout}
              title="Sign Out"
              id="topbar-logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
