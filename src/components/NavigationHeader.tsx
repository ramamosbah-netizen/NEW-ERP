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
    <header className="flex flex-col md:flex-row items-center justify-between px-6 py-4 bg-slate-950/80 backdrop-blur-xl border-b border-slate-900 sticky top-0 z-40 gap-4">
      {/* Brand logo */}
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(0,229,160,0.15)]">
          <Layers size={18} />
        </div>
        <div>
          <span className="font-heading font-extrabold text-sm text-slate-100 tracking-wider uppercase block">
            Aura ERP
          </span>
          <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest block font-bold">
            Platform Layer
          </span>
        </div>
      </div>

      {/* Navigation tabs */}
      <nav className="flex items-center gap-1.5 bg-slate-900/40 border border-slate-900 rounded-lg p-1">
        {navLinks.map(link => {
          const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(0,229,160,0.25)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
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
          <div className="flex items-center gap-3 border-l border-slate-900 pl-4">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-semibold text-slate-200">{userProfile.full_name}</div>
              <div className="text-[9px] text-slate-500 font-mono uppercase font-bold tracking-wider">
                {userProfile.role}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/20 transition-all"
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
