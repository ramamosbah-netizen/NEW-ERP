'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { UserPlus, Mail, Lock, User, Briefcase, AlertCircle, ChevronDown } from 'lucide-react';
import '@/app/auth.css';

type ERPRole = 'admin' | 'manager' | 'account' | 'engineer' | 'storekeeper';

export default function SignUp() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<ERPRole>('engineer');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Password strength calculation
  const [strength, setStrength] = useState(0); // 0 to 3
  const [strengthLabel, setStrengthLabel] = useState('Empty');

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/dashboard');
      }
    };
    checkUser();
  }, [router]);

  useEffect(() => {
    if (!password) {
      setStrength(0);
      setStrengthLabel('Empty');
      return;
    }

    let score = 0;
    if (password.length >= 6) score++; // Minimum standard length
    if (password.length >= 10) score++; // Excellent length
    if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++; // Complex chars

    setStrength(score);
    if (score === 1) setStrengthLabel('Weak');
    else if (score === 2) setStrengthLabel('Medium');
    else if (score === 3) setStrengthLabel('Strong');
  }, [password]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Form validation
    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      // Register with Supabase and pass metadata (roles, fullname)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: role,
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        // Supabase behavior check:
        // If email confirmation is enabled, session might be null.
        if (data.session) {
          setSuccessMsg('Registration successful! Redirecting...');
          setTimeout(() => {
            router.replace('/dashboard');
          }, 1200);
        } else {
          setSuccessMsg('Registration successful! Please check your email to verify your account.');
          // Clear inputs
          setFullName('');
          setEmail('');
          setPassword('');
        }
      }
    } catch (err) {
      logger.error(err);
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
            <UserPlus size={28} />
          </div>
          <h2 className="auth-title">Create Account</h2>
          <p className="auth-subtitle">Get started with your Aura ERP workspace</p>
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

        <form className="auth-form" onSubmit={handleSignUp}>
          {/* Full Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="fullName">Full Name</label>
            <div className="input-container">
              <User className="input-icon" size={18} />
              <input
                id="fullName"
                type="text"
                className="auth-input"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* Email */}
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

          {/* Role Dropdown */}
          <div className="form-group">
            <label className="form-label" htmlFor="role">ERP Organization Role</label>
            <div className="input-container">
              <Briefcase className="input-icon" size={18} />
              <select
                id="role"
                className="auth-input auth-select"
                value={role}
                onChange={(e) => setRole(e.target.value as ERPRole)}
                disabled={loading}
                required
              >
                <option value="admin">Administrator</option>
                <option value="manager">Manager</option>
                <option value="account">Accountant</option>
                <option value="engineer">Engineer</option>
                <option value="storekeeper">Storekeeper</option>
              </select>
              <ChevronDown className="select-arrow" size={18} />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
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
            {password && (
              <>
                <div className="strength-bar-container">
                  <div className={`strength-segment ${strength >= 1 ? (strength === 1 ? 'weak' : strength === 2 ? 'medium' : 'strong') : ''}`}></div>
                  <div className={`strength-segment ${strength >= 2 ? (strength === 2 ? 'medium' : 'strong') : ''}`}></div>
                  <div className={`strength-segment ${strength >= 3 ? 'strong' : ''}`}></div>
                </div>
                <div className="strength-text">Password strength: <strong>{strengthLabel}</strong></div>
              </>
            )}
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? (
              <span className="spinner"></span>
            ) : (
              <>
                <span>Sign Up</span>
                <UserPlus size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? 
          <Link href="/signin" className="auth-link">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
