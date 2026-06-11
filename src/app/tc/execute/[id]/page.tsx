// ============================================================
// JEET ERP — T&C Checklist Runner (Mobile Optimized)
// Route: /tc/execute/[id]
// ============================================================

'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  MinusCircle, 
  Camera, 
  AlertTriangle,
  Play,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import { useTCExecution } from '@/hooks/useTCExecution';
import { supabase } from '@/lib/supabase';
import { TCDevice, TCTestScript, TCTestResult } from '@/types/tc.types';
import '../../tc.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TCChecklistRunnerPage({ params }: PageProps) {
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
    logTestResult
  } = useTCExecution(packageId);

  // Runner state
  const [selectedDevice, setSelectedDevice] = useState<TCDevice | null>(null);
  const [currentScriptIdx, setCurrentScriptIdx] = useState(0);
  
  // Execution Form state
  const [testResult, setTestResult] = useState<'PASS' | 'FAIL' | 'NA'>('PASS');
  const [measuredValue, setMeasuredValue] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [recentSnagNumber, setRecentSnagNumber] = useState<string | null>(null);

  // Tools/Instruments states
  const [tools, setTools] = useState<any[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<string>('');
  const [toolWarning, setToolWarning] = useState<string | null>(null);

  useEffect(() => {
    async function loadTools() {
      try {
        const { data } = await supabase
          .from('tools')
          .select('id, tool_number, name, status, requires_calibration, next_calibration_due')
          .eq('category', 'TEST_INSTRUMENT')
          .eq('is_active', true);
        setTools(data || []);
      } catch (err) {
        console.error('Failed to load test tools:', err);
      }
    }
    loadTools();
  }, []);

  const handleToolSelect = (toolId: string) => {
    setSelectedToolId(toolId);
    setToolWarning(null);

    if (!toolId) return;

    const selected = tools.find(t => t.id === toolId);
    if (selected && selected.requires_calibration && selected.next_calibration_due) {
      const nextCal = new Date(selected.next_calibration_due);
      // Compare without times
      const today = new Date();
      today.setHours(0,0,0,0);
      nextCal.setHours(0,0,0,0);
      
      if (nextCal < today) {
        setToolWarning(
          `CRITICAL WARNING: Instrument "${selected.tool_number}" calibration expired on ${new Date(selected.next_calibration_due).toLocaleDateString('en-GB')}. Readings with this tool are invalid for audit evidence.`
        );
      }
    }
  };

  // Separate scripts into device-level and system-level
  const deviceScripts = scripts.filter(s => s.script_type === 'DEVICE_LEVEL');
  const systemScripts = scripts.filter(s => s.script_type !== 'DEVICE_LEVEL');

  // Automatically select first device if available
  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      setSelectedDevice(devices[0]);
    }
  }, [devices, selectedDevice]);

  // Current script to run
  const activeScripts = selectedDevice ? deviceScripts : systemScripts;
  const currentScript = activeScripts[currentScriptIdx];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setPhotoFiles(prev => [...prev, ...files]);
      
      const urls = files.map(file => URL.createObjectURL(file));
      setPhotoUrls(prev => [...prev, ...urls]);
    }
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx));
    setPhotoUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitResult = async () => {
    if (!currentScript) return;

    try {
      setSubmitting(true);
      setRecentSnagNumber(null);

      // Upload photos if any
      const uploadedPaths: string[] = [];
      for (const file of photoFiles) {
        const path = `TC_EVIDENCE/${packageId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const { data, error } = await supabase.storage.from('documents').upload(path, file);
        if (error) throw error;
        if (data) uploadedPaths.push(data.path);
      }

      // Submit test result
      const res = await logTestResult({
        script_id: currentScript.id,
        device_id: selectedDevice?.id,
        result: testResult,
        measured_value: measuredValue,
        photo_paths: uploadedPaths,
        measuring_instrument_id: selectedToolId || undefined
      });

      // If failed, check if it generated a snag and display warning
      if (testResult === 'FAIL' && res.snag_id) {
        // Query snag number
        const { data: snag } = await supabase
          .from('snags')
          .select('snag_number')
          .eq('id', res.snag_id)
          .single();
        if (snag) {
          setRecentSnagNumber(snag.snag_number);
        }
      }

      // Reset Form
      setMeasuredValue('');
      setPhotoFiles([]);
      setPhotoUrls([]);
      setTestResult('PASS');
      setSelectedToolId('');
      setToolWarning(null);

      // Go to next script or device
      if (currentScriptIdx < activeScripts.length - 1) {
        setCurrentScriptIdx(prev => prev + 1);
      } else {
        // If device level, we can advance to the next device
        if (selectedDevice && devices.length > 0) {
          const currentDevIdx = devices.findIndex(d => d.id === selectedDevice.id);
          if (currentDevIdx < devices.length - 1) {
            setSelectedDevice(devices[currentDevIdx + 1]);
            setCurrentScriptIdx(0);
            alert(`Device ${selectedDevice.label} complete! Moving to device: ${devices[currentDevIdx + 1].label}`);
          } else {
            alert('All devices completed! Returning to package workspace.');
            router.push(`/tc/${packageId}`);
          }
        } else {
          alert('System checklist complete! Returning to package workspace.');
          router.push(`/tc/${packageId}`);
        }
      }

      await refetch();
    } catch (err: any) {
      console.error(err);
      alert(`Error logging result: ${err.message || err}`);
    } finally {
      setSubmitting(false);
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
          <Link href="/tc" className="quote-btn quote-btn-primary" style={{ textDecoration: 'none', marginTop: '1rem' }}>
            Back to Registry
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="quote-container" style={{ maxWidth: '600px', padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Link href={`/tc/${packageId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--secondary)', textDecoration: 'none', fontWeight: 600 }}>
          <ArrowLeft size={14} /> Back to Workspace
        </Link>
        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>
          Progress: {pkg.completion_pct}%
        </span>
      </div>

      <div className="quote-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--secondary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{pkg.package_number}</span>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.1rem 0' }}>{pkg.title}</h2>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>System: {pkg.system}</span>
      </div>

      {/* Device Selector (If device level tests exist) */}
      {devices.length > 0 && (
        <div className="quote-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <label className="quote-form-label">Active Test Device</label>
          <select 
            value={selectedDevice?.id || ''} 
            onChange={(e) => {
              const dev = devices.find(d => d.id === e.target.value);
              setSelectedDevice(dev || null);
              setCurrentScriptIdx(0);
            }}
            className="quote-input"
            style={{ width: '100%', border: '1px solid var(--secondary)' }}
          >
            {devices.map(d => (
              <option key={d.id} value={d.id}>
                {d.label} — {d.location} ({d.status})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Auto Snag Alert Notification */}
      {recentSnagNumber && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '0.75rem', margin: '0 0 1rem 0', color: 'var(--error)', fontSize: '0.8rem', display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Auto-Snag Generated:</strong> Snag <strong>{recentSnagNumber}</strong> has been logged to the project punch list due to this test failure.
          </div>
        </div>
      )}

      {/* Runner Interface */}
      {currentScript ? (
        <div className="quote-card" style={{ padding: '1.5rem', border: '1px solid var(--border-color)' }}>
          {/* Script header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--secondary)', background: 'rgba(34, 211, 238, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
              Check {currentScriptIdx + 1} of {activeScripts.length}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Type: {currentScript.script_type.replace(/_/g, ' ')}
            </span>
          </div>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {currentScript.title}
          </h3>

          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Expected Outcome:</span>
            <span style={{ color: 'var(--text-secondary)' }}>{currentScript.expected}</span>
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            {/* PASS / FAIL selectors */}
            <div>
              <label className="quote-form-label">Test Result</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <button 
                  type="button"
                  onClick={() => setTestResult('PASS')}
                  className="quote-btn"
                  style={{ 
                    background: testResult === 'PASS' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                    borderColor: testResult === 'PASS' ? 'var(--success)' : 'var(--border-color)',
                    color: testResult === 'PASS' ? 'var(--success)' : 'var(--text-secondary)',
                    padding: '0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <CheckCircle size={16} /> PASS
                </button>
                <button 
                  type="button"
                  onClick={() => setTestResult('FAIL')}
                  className="quote-btn"
                  style={{ 
                    background: testResult === 'FAIL' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                    borderColor: testResult === 'FAIL' ? 'var(--error)' : 'var(--border-color)',
                    color: testResult === 'FAIL' ? 'var(--error)' : 'var(--text-secondary)',
                    padding: '0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <XCircle size={16} /> FAIL
                </button>
                <button 
                  type="button"
                  onClick={() => setTestResult('NA')}
                  className="quote-btn"
                  style={{ 
                    background: testResult === 'NA' ? 'rgba(100, 116, 139, 0.15)' : 'transparent',
                    borderColor: testResult === 'NA' ? 'var(--text-muted)' : 'var(--border-color)',
                    color: testResult === 'NA' ? 'var(--text-secondary)' : 'var(--text-secondary)',
                    padding: '0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem'
                  }}
                >
                  <MinusCircle size={16} /> N/A
                </button>
              </div>
            </div>

            {/* Measuring Instrument Selector */}
            <div>
              <label className="quote-form-label">Measuring Instrument / Test Equipment</label>
              <select
                className="quote-input"
                style={{ width: '100%', border: '1px solid var(--border-color)', height: '40px', background: 'var(--card-bg)' }}
                value={selectedToolId}
                onChange={(e) => handleToolSelect(e.target.value)}
              >
                <option value="">-- Choose Calibrated Instrument (Optional) --</option>
                {tools.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.tool_number} — {t.name} ({t.status})
                  </option>
                ))}
              </select>

              {toolWarning && (
                <div style={{ marginTop: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', color: 'var(--error)', padding: '0.6rem', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'start', gap: '0.4rem' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                  <span>{toolWarning}</span>
                </div>
              )}
            </div>

            {/* Measured Value */}
            <div>
              <label className="quote-form-label">Measured Value / Readings (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. 1.2 Bar, 22 deg C, OK"
                value={measuredValue}
                onChange={(e) => setMeasuredValue(e.target.value)}
                className="quote-input"
                style={{ width: '100%' }}
              />
            </div>

            {/* Photos Upload */}
            <div>
              <label className="quote-form-label">Attach Evidence Photos</label>
              <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <label 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '75px', 
                    height: '75px', 
                    border: '2px dashed var(--border-color)', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <Camera size={20} />
                  <span style={{ fontSize: '0.6rem', marginTop: '0.2rem' }}>Add</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    onChange={handleFileChange} 
                    style={{ display: 'none' }} 
                  />
                </label>
                
                {photoUrls.map((url, idx) => (
                  <div key={idx} style={{ position: 'relative', width: '75px', height: '75px' }}>
                    <img 
                      src={url} 
                      alt="preview" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} 
                    />
                    <button 
                      type="button" 
                      onClick={() => handleRemovePhoto(idx)}
                      style={{ 
                        position: 'absolute', 
                        top: '-5px', 
                        right: '-5px', 
                        background: 'red', 
                        color: 'white', 
                        borderRadius: '50%', 
                        width: '18px', 
                        height: '18px', 
                        fontSize: '10px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button 
              onClick={handleSubmitResult}
              className="quote-btn quote-btn-primary"
              disabled={submitting || !!toolWarning}
              style={{ width: '100%', padding: '0.8rem', fontSize: '0.9rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', opacity: (submitting || !!toolWarning) ? 0.5 : 1 }}
            >
              {submitting ? 'Logging Result...' : (
                <>
                  Next Checklist Item <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="quote-card text-center" style={{ padding: '3rem 2rem' }}>
          <CheckCircle size={40} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>No Scripts Configured</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.5rem 0 1.5rem 0' }}>
            No checklists matching the active test criteria have been found in the package workspace.
          </p>
          <Link href={`/tc/${packageId}`} className="quote-btn quote-btn-secondary" style={{ textDecoration: 'none' }}>
            Open Workspace
          </Link>
        </div>
      )}
    </div>
  );
}
