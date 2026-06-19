// ============================================================
// JEET ERP — Slim Topbar with Breadcrumb + User Controls
// ============================================================

'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LogOut, Menu, ChevronRight, Sliders, Command, Sun, Moon, Search, User, Settings as SettingsIcon } from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import CompanySwitcher from '@/components/layout/CompanySwitcher';

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
    email?: string;
  } | null>(null);
  const [isCompact, setIsCompact] = useState(false);
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('system');
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Click outside to close profile dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('erp-density-compact');
    if (saved === 'true') {
      setIsCompact(true);
      document.body.classList.add('theme-compact');
    }
    const savedTheme = (localStorage.getItem('erp-theme') || 'system') as 'system' | 'light' | 'dark';
    setThemeMode(savedTheme);
    document.body.classList.remove('theme-light', 'theme-dark');
    if (savedTheme === 'light') document.body.classList.add('theme-light');
    if (savedTheme === 'dark') document.body.classList.add('theme-dark');
  }, []);

  const cycleTheme = () => {
    setThemeMode(prev => {
      const next = prev === 'system' ? 'light' : prev === 'light' ? 'dark' : 'system';
      document.body.classList.remove('theme-light', 'theme-dark');
      if (next === 'light') document.body.classList.add('theme-light');
      if (next === 'dark') document.body.classList.add('theme-dark');
      localStorage.setItem('erp-theme', next);
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
          .select('full_name, role, email')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setUserProfile({
                full_name: data.full_name,
                role: data.role,
                email: data.email || user.email || '',
              });
            } else {
              setUserProfile({
                full_name: user.user_metadata?.full_name || 'ERP User',
                role: user.user_metadata?.role || 'engineer',
                email: user.email || '',
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
    <header className="erp-topbar px-4 md:px-6 relative flex items-center justify-between" id="erp-topbar">
      <div className="topbar-left flex items-center gap-3">
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
        <div className="topbar-breadcrumb hidden sm:flex items-center gap-1.5">
          {segments.length === 0 ? (
            <span className="topbar-breadcrumb-segment current">Home</span>
          ) : (
            segments.map((seg, idx) => {
              const isLast = idx === segments.length - 1;
              const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(seg);
              const label = isUUID
                ? `#${seg.substring(0, 8)}`
                : ROUTE_LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');

              return (
                <React.Fragment key={idx}>
                  {idx > 0 && (
                    <ChevronRight size={10} className="topbar-breadcrumb-sep opacity-50" />
                  )}
                  <span
                    className={`topbar-breadcrumb-segment ${isLast ? 'current font-bold text-primary' : 'text-text-secondary'}`}
                  >
                    {label}
                  </span>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>

      {/* Global search and quick controls */}
      <div className="flex-1 max-w-xs md:max-w-sm mx-4 hidden md:block">
        <div
          onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
          className="w-full bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-md py-1.5 px-3 text-xs text-[var(--text-muted)] hover:border-[var(--text-muted)] cursor-pointer flex items-center gap-2 select-none transition-colors duration-100"
        >
          <Search size={13} className="opacity-60 flex-shrink-0" />
          <span className="flex-1">Search…</span>
          <kbd className="flex items-center gap-0.5 bg-[var(--bg-card)] border border-[var(--border-color)] px-1.5 py-0.5 rounded text-[9px] text-[var(--text-muted)] font-mono">
            <Command size={8} />K
          </kbd>
        </div>
      </div>

      <div className="topbar-right flex items-center gap-2 md:gap-3">
        {/* Active company switcher */}
        <CompanySwitcher />

        {/* Density Toggle */}
        <button
          onClick={toggleDensity}
          className="topbar-logout w-8 h-8 rounded-md flex items-center justify-center bg-[var(--bg-dark)] border border-[var(--border-color)] transition-colors cursor-pointer"
          title={isCompact ? 'Comfortable density' : 'Compact density'}
          style={{ color: isCompact ? 'var(--text-primary)' : 'var(--text-muted)' }}
        >
          <Sliders size={13} />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={cycleTheme}
          className="topbar-logout w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-dark)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          title={themeMode === 'system' ? 'System theme — click for Light' : themeMode === 'light' ? 'Light mode — click for Dark' : 'Dark mode — click for System'}
        >
          {themeMode === 'light' ? <Sun size={14} /> : themeMode === 'dark' ? <Moon size={14} /> : <Sun size={14} className="opacity-50" />}
        </button>

        {/* Notification Bell */}
        <NotificationBell />

        {/* User Profile Dropdown Card */}
        {userProfile && (
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg border border-border-color hover:bg-bg-card-hover/40 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary/25 to-primary/10 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary font-mono select-none">
                {userProfile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
              </div>
              <div className="hidden md:block leading-tight pr-1">
                <div className="text-[11px] font-bold text-text-primary truncate max-w-[90px]">{userProfile.full_name}</div>
                <div className="text-[8px] font-mono text-text-muted uppercase tracking-wider">{userProfile.role}</div>
              </div>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2.5 w-60 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl p-4 flex flex-col gap-3.5 z-[100] animate-fadeIn">
                <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--primary-glow)] border border-[var(--primary)]/20 flex items-center justify-center text-xs font-bold text-[var(--primary)] font-mono">
                    {userProfile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="text-xs font-bold text-text-primary leading-tight">{userProfile.full_name}</span>
                    <span className="text-[9px] text-text-muted truncate mt-0.5">{userProfile.email || 'user@jeetmep.ae'}</span>
                    <span className="text-[8px] font-mono text-[var(--primary)] bg-[var(--primary-glow)] border border-[var(--primary)]/20 rounded px-1.5 py-0.5 mt-1 self-start uppercase tracking-wider font-semibold">
                      {userProfile.role}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      router.push('/admin/settings');
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-[var(--bg-card-hover)] rounded-lg text-left transition-colors cursor-pointer"
                  >
                    <SettingsIcon size={13} className="text-text-muted" />
                    <span>Account Settings</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      window.dispatchEvent(new Event('open-command-palette'));
                    }}
                    className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-[var(--bg-card-hover)] rounded-lg text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <User size={13} className="text-text-muted" />
                      <span>Search Commands</span>
                    </div>
                    <kbd className="text-[9px] bg-[var(--bg-dark)] text-[var(--text-muted)] border border-[var(--border-color)] px-1 py-0.5 rounded shadow font-mono">
                      ⌘K
                    </kbd>
                  </button>
                </div>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-500 dark:text-red-400 hover:bg-red-500/10 border border-red-500/20 dark:border-red-500/10 rounded-lg text-left transition-colors cursor-pointer mt-1"
                >
                  <LogOut size={13} />
                  <span>Sign Out Account</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
