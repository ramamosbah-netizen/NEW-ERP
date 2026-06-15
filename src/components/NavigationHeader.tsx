// ============================================================
// JEET ERP — Shared Navigation Header
// ============================================================

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Layers, 
  Sun, 
  Calendar, 
  CheckSquare, 
  Bell, 
  LogOut, 
  LayoutDashboard,
  Settings,
  Sparkles,
  DollarSign
} from 'lucide-react';
import NotificationBell from './notifications/NotificationBell';

export const NavigationHeader: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<{ full_name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('profiles')
          .select('full_name, email, role')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setUserProfile(data);
            } else {
              setUserProfile({
                full_name: user.user_metadata?.full_name || 'ERP User',
                email: user.email || '',
                role: user.user_metadata?.role || 'engineer'
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

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { href: '/myday', label: 'My Day', Icon: Sun },
    { href: '/tasks', label: 'Tasks', Icon: CheckSquare },
    { href: '/meetings', label: 'Meetings', Icon: Calendar },
    { href: '/finance', label: 'Finance', Icon: DollarSign },
    { href: '/notifications', label: 'Alerts Logs', Icon: Bell }
  ];

  return (
    <header className="flex flex-col md:flex-row items-center justify-between px-6 py-4 bg-[var(--bg-card)] backdrop-blur-xl border-b border-[var(--border)] sticky top-0 z-40 gap-4">
      {/* Brand logo */}
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-[var(--accent-glow)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] shadow-[0_0_15px_var(--accent-glow)]">
          <Layers size={18} />
        </div>
        <div>
          <span className="font-heading font-extrabold text-sm text-[var(--text-primary)] tracking-wider uppercase block">
            Aura ERP
          </span>
          <span className="text-[9px] font-mono text-[var(--accent)] uppercase tracking-widest block font-bold">
            Platform Layer
          </span>
        </div>
      </div>

      {/* Navigation tabs */}
      <nav className="flex items-center gap-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg p-1">
        {navLinks.map(link => {
          const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[var(--accent)] text-white font-bold shadow-[0_0_12px_var(--accent-glow)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <link.Icon size={13} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Right User Controls & Realtime Bell */}
      <div className="flex items-center gap-4">
        {/* Realtime Notification Bell */}
        <NotificationBell />

        {/* User profile dropdown & signout */}
        {userProfile && (
          <div className="flex items-center gap-3 border-l border-[var(--border)] pl-4">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-semibold text-[var(--text-primary)]">{userProfile.full_name}</div>
              <div className="text-[9px] text-[var(--text-primary)]0 font-mono uppercase font-bold tracking-wider">
                {userProfile.role}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--status-danger-text)] hover:border-[var(--status-danger-border)] transition-all"
              title="Sign Out"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default NavigationHeader;
