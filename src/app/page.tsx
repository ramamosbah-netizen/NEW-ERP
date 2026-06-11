'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import '@/app/auth.css';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          router.replace('/dashboard');
        } else {
          router.replace('/signin');
        }
      } catch (err) {
        console.error('Session check failed:', err);
        router.replace('/signin');
      }
    };

    checkSession();
  }, [router]);

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div className="auth-logo-wrapper" style={{ margin: '0 0 1.5rem 0' }}>
          <div className="spinner"></div>
        </div>
        <h2 className="auth-title">Aura ERP</h2>
        <p className="auth-subtitle">Verifying security session...</p>
      </div>
    </div>
  );
}
