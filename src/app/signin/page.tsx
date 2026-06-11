'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import '@/app/auth.css';

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check if user is already signed in and redirect to dashboard
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/dashboard');
      }
    };
    checkUser();
  }, [router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Simple client side validation
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
      } else if (data.session) {
        setSuccessMsg('Login successful! Redirecting...');
        setTimeout(() => {
          router.replace('/dashboard');
        }, 1200);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-wrapper">
            <LogIn size={28} />
          </div>
          <h2 className="auth-title">Welcome Back</h2>
          <p className="auth-subtitle">Sign in to your Aura ERP account</p>
        </div>

        {errorMsg && (
          <div className="auth-alert auth-alert-error">
            <AlertCircle className="alert-icon" size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="auth-alert auth-alert-success">
            <AlertCircle className="alert-icon" size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSignIn}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <div className="input-container">
              <Mail className="input-icon" size={18} />
              <input
                id="email"
                type="email"
                className="auth-input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div className="form-label">
              <label htmlFor="password">Password</label>
            </div>
            <div className="input-container">
              <Lock className="input-icon" size={18} />
              <input
                id="password"
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? (
              <span className="spinner"></span>
            ) : (
              <>
                <span>Sign In</span>
                <LogIn size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account? 
          <Link href="/signup" className="auth-link">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
