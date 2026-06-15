// ============================================================
// JEET ERP — WhatsApp Integration Settings Panel
// Route: /settings/whatsapp
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Save, 
  Settings, 
  CheckCircle,
  HelpCircle,
  Eye,
  EyeOff,
  Database,
  ExternalLink,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';
import { whatsappService, type WhatsAppSettings, type WhatsAppTemplate } from '@/services/whatsappService';
import '@/app/dashboard/dashboard.css';

export default function WhatsAppSettingsPage() {
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form states
  const [enabled, setEnabled] = useState(false);
  const [phoneId, setPhoneId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [token, setToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('jeet_erp_verify_token');
  const [geminiKey, setGeminiKey] = useState('');

  // Visibility toggles
  const [showToken, setShowToken] = useState(false);
  const [showGemini, setShowGemini] = useState(false);

  // Load configuration
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [config, tmpls] = await Promise.all([
          whatsappService.fetchSettings(),
          whatsappService.fetchTemplates()
        ]);
        
        setSettings(config);
        setTemplates(tmpls);

        // Map values
        setEnabled(config.whatsapp_enabled);
        setPhoneId(config.phone_number_id || '');
        setWabaId(config.waba_id || '');
        setToken(config.access_token || '');
        setVerifyToken(config.verify_token || 'jeet_erp_verify_token');
        setGeminiKey(config.gemini_api_key || '');
      } catch (err: any) {
        console.error('Failed to load settings:', err);
        setErrorMsg('Failed to load WhatsApp settings from database.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaveLoading(true);
      setErrorMsg('');
      
      await whatsappService.saveSettings({
        whatsapp_enabled: enabled,
        phone_number_id: phoneId ? phoneId.trim() : null,
        waba_id: wabaId ? wabaId.trim() : null,
        access_token: token ? token.trim() : null,
        verify_token: verifyToken.trim(),
        gemini_api_key: geminiKey ? geminiKey.trim() : null
      });

      setSuccessMsg('WhatsApp integration settings saved successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to save settings.');
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="db-wrapper" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading configuration parameters...</p>
      </div>
    );
  }

  // Auto-resolve webhook URL based on window location
  const supabaseProjectRef = typeof window !== 'undefined' 
    ? window.location.hostname === 'localhost' 
      ? 'renqeeaabnqoikhvczww' // default mock fallback matching env file
      : window.location.hostname.split('.')[0]
    : 'renqeeaabnqoikhvczww';

  const webhookEndpointUrl = `https://${supabaseProjectRef}.supabase.co/functions/v1/whatsapp-webhook`;

  return (
    <div className="db-wrapper">
      {/* Header */}
      <header className="db-header">
        <div className="db-logo-section">
          <Link href="/whatsapp" className="logout-btn" style={{ textDecoration: 'none', background: 'var(--surface-hover)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem' }}>
            <ArrowLeft size={16} /> Back to Live Chats
          </Link>
          <div style={{ marginLeft: '1rem' }}>
            <h1 className="db-logo-text" style={{ background: 'linear-gradient(135deg, var(--accent), #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              WhatsApp Integration Engine
            </h1>
            <p className="stat-desc">Configure Meta WhatsApp Business APIs, template maps, webhooks, and Gemini AI credentials</p>
          </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'start' }}>
        {/* Settings Form */}
        <div className="db-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <Settings size={22} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>API Configuration Credentials</h3>
          </div>

          {successMsg && (
            <div className="db-warning-banner" style={{ borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.05)', color: '#10b981', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <CheckCircle size={18} />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="db-warning-banner" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <AlertTriangle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Enabled Switch */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Enable WhatsApp Channel</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>If disabled, alerts degrade gracefully to Skipped. AI bot stops.</span>
              </div>
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                <input 
                  type="checkbox" 
                  checked={enabled} 
                  onChange={(e) => setEnabled(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span className="slider-round" style={{
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: enabled ? 'var(--primary)' : 'var(--border)',
                  borderRadius: '34px', transition: '0.3s',
                  boxShadow: enabled ? '0 0 10px var(--primary-glow)' : 'none'
                }}>
                  <span style={{
                    position: 'absolute', content: '""', height: '18px', width: '18px', left: '3px', bottom: '3px',
                    backgroundColor: 'var(--bg-card)', borderRadius: '50%', transition: '0.3s',
                    transform: enabled ? 'translateX(22px)' : 'translateX(0)'
                  }} />
                </span>
              </label>
            </div>

            {/* Phone Number ID */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 500 }}>
                Phone Number ID (from Meta Developer portal)
              </label>
              <input 
                type="text" 
                className="auth-input"
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.9rem' }}
                placeholder="e.g. 109384729104820"
                value={phoneId}
                onChange={(e) => setPhoneId(e.target.value)}
              />
            </div>

            {/* WABA ID */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 500 }}>
                WhatsApp Business Account (WABA) ID
              </label>
              <input 
                type="text" 
                className="auth-input"
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.9rem' }}
                placeholder="e.g. 39485729104928"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
              />
            </div>

            {/* Access Token */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 500 }}>
                Meta Permanent System User Access Token
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showToken ? "text" : "password"} 
                  className="auth-input"
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 2.5rem 0.6rem 0.8rem', color: '#fff', fontSize: '0.9rem' }}
                  placeholder="EAAGy..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Verify Token */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 500 }}>
                Webhook Challenge Verification Token
              </label>
              <input 
                type="text" 
                className="auth-input"
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                required
              />
            </div>

            {/* Gemini API Key */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 500 }}>
                Gemini AI Developer API Key (for Inbound Intent Classification)
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showGemini ? "text" : "password"} 
                  className="auth-input"
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 2.5rem 0.6rem 0.8rem', color: '#fff', fontSize: '0.9rem' }}
                  placeholder="AIzaSy..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={() => setShowGemini(!showGemini)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  {showGemini ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button 
              type="submit" 
              className="quote-btn quote-btn-primary" 
              disabled={saveLoading}
              style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', padding: '0.75rem', borderRadius: '8px', fontSize: '0.95rem', width: '100%', marginTop: '0.5rem' }}
            >
              <Save size={16} />
              {saveLoading ? 'Saving config...' : 'Save WhatsApp Configuration'}
            </button>

          </form>
        </div>

        {/* Webhook Guide & Templates Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Webhook Guide Card */}
          <div className="db-card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <Database size={20} style={{ color: 'var(--secondary)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Meta Webhook Integration</h3>
            </div>
            
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Configure your Meta Developer dashboard webhook settings to send messages directly to your JEET ERP backend database for real-time ticket logs.
            </p>

            <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid var(--surface-hover)', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem', fontWeight: 600 }}>Callback URL</div>
              <code style={{ fontSize: '0.78rem', color: 'var(--secondary)', wordBreak: 'break-all', fontFamily: 'monospace' }}>{webhookEndpointUrl}</code>
              
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '1rem', marginBottom: '0.3rem', fontWeight: 600 }}>Verify Token</div>
              <code style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{verifyToken}</code>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <HelpCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Meta Setup:</strong> 
                <ol style={{ paddingLeft: '1.1rem', margin: '0.2rem 0 0 0' }}>
                  <li>Go to Webhooks in Meta Developer dashboard under WhatsApp.</li>
                  <li>Click Edit, paste URL and Verify Token, then Verify and Save.</li>
                  <li>Subscribe to <strong>messages</strong> fields in Webhook Fields list.</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Active Event Templates Mapping */}
          <div className="db-card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <MessageSquare size={20} style={{ color: '#d946ef' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Meta Outbound Templates Map</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '380px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {templates.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No templates seeded in registry.</p>
              ) : (
                templates.map((tmpl) => (
                  <div key={tmpl.id} style={{ background: 'var(--surface-hover)', border: '1px solid var(--surface-hover)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{tmpl.event_type}</span>
                      <span style={{ fontSize: '0.65rem', background: 'rgba(0, 229, 160, 0.1)', color: 'var(--primary)', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(0, 229, 160, 0.2)' }}>
                        Meta Template: {tmpl.template_name}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic', lineHeight: '1.4' }}>
                      "{tmpl.body_template}"
                    </p>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      Variables: {tmpl.variables.map(v => `{{${v}}}`).join(', ') || 'None'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
