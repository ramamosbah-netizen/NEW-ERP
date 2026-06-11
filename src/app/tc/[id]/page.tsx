// ============================================================
// JEET ERP — Testing & Commissioning Package Workspace Page
// Route: /tc/[id]
// ============================================================

'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  Play,
  Layers,
  Table,
  Check
} from 'lucide-react';
import { useTCExecution } from '@/hooks/useTCExecution';
import { supabase } from '@/lib/supabase';
import { TCDevice, TCTestScript } from '@/types/tc.types';
import '../tc.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TCPackageWorkspacePage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const packageId = resolvedParams.id;

  const {
    pkg,
    scripts,
    devices,
    loading,
    error,
    refetch,
    importDevices
  } = useTCExecution(packageId);

  // Script editing states
  const [newScriptTitle, setNewScriptTitle] = useState('');
  const [newScriptExpected, setNewScriptExpected] = useState('');
  const [newScriptType, setNewScriptType] = useState<'DEVICE_LEVEL' | 'SYSTEM_LEVEL' | 'INTEGRATION'>('DEVICE_LEVEL');
  const [actionLoading, setActionLoading] = useState(false);

  // Paste import states
  const [pasteText, setPasteText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<Partial<TCDevice>[]>([]);
  const [activeTab, setActiveTab] = useState<'scripts' | 'devices' | 'import'>('scripts');

  // Trigger parsing when paste text changes
  useEffect(() => {
    if (!pasteText) {
      setParsedPreview([]);
      return;
    }

    try {
      const { deviceImportService } = require('@/services/deviceImportService');
      const preview = deviceImportService.parsePasteData(pasteText);
      setParsedPreview(preview);
    } catch (err) {
      console.error('Failed to parse paste data preview:', err);
    }
  }, [pasteText]);

  const handleAddScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScriptTitle.trim() || !newScriptExpected.trim()) return;

    try {
      setActionLoading(true);
      const nextSort = scripts.length > 0 ? Math.max(...scripts.map(s => s.sort_order)) + 10 : 10;
      
      const { error } = await supabase
        .from('tc_test_scripts')
        .insert({
          package_id: packageId,
          script_type: newScriptType,
          title: newScriptTitle,
          expected: newScriptExpected,
          sort_order: nextSort
        });

      if (error) throw error;

      setNewScriptTitle('');
      setNewScriptExpected('');
      await refetch();
    } catch (err) {
      alert('Failed to add test script checklist item.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteScript = async (scriptId: string) => {
    if (!confirm('Are you sure you want to delete this test checklist item?')) return;
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('tc_test_scripts')
        .delete()
        .eq('id', scriptId);

      if (error) throw error;
      await refetch();
    } catch (err) {
      alert('Failed to delete script.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (parsedPreview.length === 0) return;
    try {
      setActionLoading(true);
      await importDevices(pasteText);
      setPasteText('');
      setParsedPreview([]);
      setActiveTab('devices');
      await refetch();
    } catch (err: any) {
      alert(err.message || 'Device import failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to remove this device?')) return;
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('tc_devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;
      await refetch();
    } catch (err) {
      alert('Failed to delete device.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="quote-container" style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="quote-container">
        <div className="quote-card text-center" style={{ padding: '3rem' }}>
          <AlertTriangle size={40} className="text-error" style={{ marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>T&C Package Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.5rem 0 1.5rem 0' }}>
            The commissioning package reference is invalid or has been removed.
          </p>
          <Link href="/tc" className="quote-btn quote-btn-primary" style={{ textDecoration: 'none' }}>
            Back to Registry
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="quote-container">
      {/* Back navigation & Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/tc" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--secondary)', textDecoration: 'none', fontWeight: 600, marginBottom: '0.8rem' }}>
          <ArrowLeft size={14} /> Back to T&C Registry
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--secondary)', fontWeight: 600 }}>{pkg.package_number}</span>
            <h1 className="quote-header-title">{pkg.title} Workspace</h1>
            <p className="quote-header-subtitle">Define testing criteria, import equipment, and verify commission checklists</p>
          </div>
          <Link href={`/tc/execute/${pkg.id}`} className="quote-btn quote-btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Play size={14} /> Start Tester execution
          </Link>
        </div>
      </div>

      {/* Package Specs Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="quote-card" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Completion Progress</span>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', margin: '0.2rem 0' }}>{pkg.completion_pct}%</h3>
          <div className="progress-bar-container" style={{ marginTop: '0.5rem' }}>
            <div className="progress-bar-fill" style={{ width: `${pkg.completion_pct}%` }}></div>
          </div>
        </div>

        <div className="quote-card" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Witness Gate Requirement</span>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: '0.2rem 0' }}>{pkg.witness_required.replace(/_/g, ' ')}</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Status: {pkg.status.replace(/_/g, ' ')}</span>
        </div>

        <div className="quote-card" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Checklist Items</span>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--secondary)', margin: '0.2rem 0' }}>{scripts.length} Items</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {scripts.filter(s => s.script_type === 'DEVICE_LEVEL').length} device-level checks
          </span>
        </div>

        <div className="quote-card" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Devices Registered</span>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', margin: '0.2rem 0' }}>{devices.length} Units</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Passed: {devices.filter(d => d.status === 'PASSED').length} | Failed: {devices.filter(d => d.status === 'FAILED').length}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <button 
          onClick={() => setActiveTab('scripts')}
          className={`quote-btn ${activeTab === 'scripts' ? 'quote-btn-primary' : 'quote-btn-secondary'}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
        >
          <Layers size={14} style={{ marginRight: '0.4rem', display: 'inline' }} /> Test Scripts ({scripts.length})
        </button>
        <button 
          onClick={() => setActiveTab('devices')}
          className={`quote-btn ${activeTab === 'devices' ? 'quote-btn-primary' : 'quote-btn-secondary'}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
        >
          <Table size={14} style={{ marginRight: '0.4rem', display: 'inline' }} /> Equipment Registry ({devices.length})
        </button>
        <button 
          onClick={() => setActiveTab('import')}
          className={`quote-btn ${activeTab === 'import' ? 'quote-btn-primary' : 'quote-btn-secondary'}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
        >
          <Upload size={14} style={{ marginRight: '0.4rem', display: 'inline' }} /> Excel Paste Import
        </button>
      </div>

      {/* TAB 1: TEST SCRIPTS CONFIG */}
      {activeTab === 'scripts' && (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Scripts List */}
          <div className="quote-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Package Test Script Checklist</h3>
            {scripts.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '2rem 0', textAlign: 'center' }}>
                No script checklist items added yet. Use the panel on the right to define your commission tests.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {scripts.map((script, idx) => (
                  <div key={script.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.8rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <div style={{ flex: 1, paddingRight: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--secondary)', background: 'rgba(34, 211, 238, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                          {script.script_type.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Item #{idx+1}</span>
                      </div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{script.title}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        <strong>Expected:</strong> {script.expected}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleDeleteScript(script.id)}
                      className="quote-btn text-error"
                      style={{ background: 'transparent', padding: '0.3rem', minWidth: 'auto' }}
                      disabled={actionLoading}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Script Form */}
          <div className="quote-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Add New Script Item</h3>
            <form onSubmit={handleAddScript} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="quote-form-label">Checklist Type</label>
                <select 
                  value={newScriptType} 
                  onChange={(e) => setNewScriptType(e.target.value as any)}
                  className="quote-input"
                  style={{ width: '100%' }}
                >
                  <option value="DEVICE_LEVEL">Device Level (Runs for each camera/reader)</option>
                  <option value="SYSTEM_LEVEL">System Level (Whole server / NVR checks)</option>
                  <option value="INTEGRATION">Integration (Override, NTP synchronizations)</option>
                </select>
              </div>

              <div>
                <label className="quote-form-label">Test Procedure Description</label>
                <input 
                  type="text" 
                  placeholder="e.g. Verify time synchronization with NTP server"
                  value={newScriptTitle}
                  onChange={(e) => setNewScriptTitle(e.target.value)}
                  className="quote-input"
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div>
                <label className="quote-form-label">Expected Successful Outcome</label>
                <textarea 
                  placeholder="e.g. VMS client system displays exact synchronised time within +/-1s."
                  value={newScriptExpected}
                  onChange={(e) => setNewScriptExpected(e.target.value)}
                  className="quote-input"
                  style={{ width: '100%', height: '80px', resize: 'none' }}
                  required
                />
              </div>

              <button 
                type="submit" 
                className="quote-btn quote-btn-primary"
                style={{ width: '100%', marginTop: '0.5rem' }}
                disabled={actionLoading}
              >
                <Plus size={14} style={{ marginRight: '0.3rem', display: 'inline' }} /> Add to Package Scripts
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: EQUIPMENT REGISTRY */}
      {activeTab === 'devices' && (
        <div className="quote-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Pasted Device Register ({devices.length})</h3>
            <button 
              onClick={() => setActiveTab('import')}
              className="quote-btn quote-btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
            >
              <Upload size={12} style={{ marginRight: '0.3rem', display: 'inline' }} /> Paste-Import New Devices
            </button>
          </div>

          {devices.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '3rem 0', textAlign: 'center' }}>
              No devices registered. Click the Paste-Import tab to quickly load devices from Excel/CSV grids.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="paste-grid-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px', textAlign: 'center' }}>No</th>
                    <th>Label/Tag</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Brand & Model</th>
                    <th>IP Address</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Status</th>
                    <th style={{ width: '50px', textAlign: 'center' }}>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d, idx) => (
                    <tr key={d.id}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 'bold' }}>{d.label}</td>
                      <td>{d.device_type}</td>
                      <td>{d.location}</td>
                      <td>{d.brand_model || '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{d.ip_address || '-'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ 
                          fontSize: '0.7rem', 
                          fontWeight: 'bold', 
                          color: d.status === 'PASSED' ? 'var(--success)' : d.status === 'FAILED' ? 'var(--error)' : 'var(--text-muted)'
                        }}>
                          {d.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => handleDeleteDevice(d.id)}
                          className="text-error"
                          style={{ background: 'transparent', cursor: 'pointer' }}
                          disabled={actionLoading}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EXCEL PASTE IMPORT */}
      {activeTab === 'import' && (
        <div className="quote-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Excel Grid Paste-Import Workspace</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
            Copy columns from Excel (must be exactly: <strong>Type, Label, Location, Brand/Model, Serial, IP Address</strong>) and paste below.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Input area */}
            <div>
              <label className="quote-form-label">Paste Clipboard Text (TSV Grid)</label>
              <textarea 
                placeholder="Paste here..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="paste-area"
              />
              {parsedPreview.length > 0 && (
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button 
                    onClick={() => { setPasteText(''); setParsedPreview([]); }}
                    className="quote-btn quote-btn-secondary"
                  >
                    Clear Paste
                  </button>
                  <button 
                    onClick={handleExecuteImport}
                    className="quote-btn quote-btn-primary"
                    disabled={actionLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Check size={14} /> Import {parsedPreview.length} Devices
                  </button>
                </div>
              )}
            </div>

            {/* Live Preview */}
            <div>
              <label className="quote-form-label">Parsed Import Preview ({parsedPreview.length} Rows)</label>
              {parsedPreview.length === 0 ? (
                <div style={{ height: '120px', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Awaiting paste content...
                </div>
              ) : (
                <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <table className="paste-grid-table" style={{ marginTop: 0 }}>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Label</th>
                        <th>Location</th>
                        <th>IP Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedPreview.slice(0, 10).map((d, idx) => (
                        <tr key={idx}>
                          <td>{d.device_type}</td>
                          <td style={{ fontWeight: 'bold' }}>{d.label}</td>
                          <td>{d.location}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{d.ip_address || '-'}</td>
                        </tr>
                      ))}
                      {parsedPreview.length > 10 && (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                            + {parsedPreview.length - 10} more rows...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
