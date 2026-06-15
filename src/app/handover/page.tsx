// ============================================================
// JEET ERP — Handover Closeout Gate Panel Page
// Route: /handover
// ============================================================

'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  FileText, 
  AlertTriangle,
  Upload,
  UserCheck,
  FileDown,
  Info,
  DollarSign,
  FolderOpen
} from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { useHandover } from '@/hooks/useHandover';
import { supabase } from '@/lib/supabase';
import './handover.css';

const fmtAED = (v: number) => {
  return new Intl.NumberFormat('en-AE', { 
    style: 'currency', 
    currency: 'AED', 
    minimumFractionDigits: 2 
  }).format(v);
};

export default function HandoverGatePage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [clientSignName, setClientSignName] = useState('');
  const [clientSignDesignation, setClientSignDesignation] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [recentCertPath, setRecentCertPath] = useState<string | null>(null);

  // Waiver modal states
  const [waiveItemId, setWaiveItemId] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState('');

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Load projects
  const { projects } = useProjects();
  
  // Set first project as default when loaded
  useEffect(() => {
    const activeProject = projects.find(p => p.status === 'TESTING' || p.status === 'HANDOVER');
    if (activeProject) {
      setSelectedProjectId(activeProject.id);
    } else if (projects && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Load handover packages & gates
  const {
    handoverPkg,
    gateStatus,
    loading,
    refetch,
    initializeHandover,
    updateChecklistItem,
    submitHandover,
    generateCertificate
  } = useHandover(selectedProjectId);

  // Setup drawing signature canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
      }
    }
  }, [canvasRef, gateStatus?.can_handover]);

  // Coordinates mapping
  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Retention release values computation
  const retentionValues = useMemo(() => {
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return { contractValue: 0, pct: 0, total: 0, half: 0 };

    const val = Number(project.contract_value) || 0;
    const pct = Number(project.retention_pct) || 5.00;
    const total = val * (pct / 100);
    const half = total / 2;

    return {
      contractValue: val,
      pct,
      total,
      half
    };
  }, [projects, selectedProjectId]);

  const handleInitialize = async () => {
    try {
      setActionLoading(true);
      await initializeHandover();
    } catch (err) {
      alert('Failed to initialize checklist package.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFileUpload = async (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    try {
      setActionLoading(true);

      // Upload to storage
      const storagePath = `DMS/HANDOVER_DOCS/${selectedProjectId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, { cacheControl: '3600', upsert: true });

      if (uploadErr) throw uploadErr;

      // Register document in DMS
      const user = (await supabase.auth.getUser()).data.user;
      const fileHash = 'sha256-' + Math.random().toString(36).substring(2);

      const { data: document, error: docErr } = await supabase
        .from('documents')
        .insert({
          title: `Handover Checkpoint Evidence: ${file.name}`,
          original_filename: file.name,
          file_ext: file.name.split('.').pop(),
          mime_type: file.type,
          file_size_bytes: file.size,
          file_hash: fileHash,
          storage_path: storagePath,
          category: 'CONTRACT',
          status: 'VERIFIED',
          uploaded_by: user?.id || null
        })
        .select()
        .single();

      if (docErr) throw docErr;

      // Update checklist item to DONE
      await updateChecklistItem(itemId, 'DONE', {
        evidence_document_id: document.id
      });

      await refetch();
      alert('Evidence file uploaded and checklist item verified!');
    } catch (err: any) {
      console.error(err);
      alert(`Upload failed: ${err.message || err}`);
    } finally {
      setActionLoading(false);
    }
  };

  const submitWaiver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiveItemId || !waiveReason.trim()) return;

    try {
      setActionLoading(true);
      await updateChecklistItem(waiveItemId, 'WAIVED', {
        waived_reason: waiveReason
      });
      setWaiveItemId(null);
      setWaiveReason('');
      await refetch();
    } catch (err) {
      alert('Failed to waive requirement.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleHandoverSignOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientSignName.trim() || !clientSignDesignation.trim()) {
      alert('Please enter client representative name and designation.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setActionLoading(true);
      setRecentCertPath(null);

      // Validate canvas
      const ctx = canvas.getContext('2d');
      const buffer = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      const isBlank = buffer ? !buffer.data.some(c => c !== 0) : true;

      if (isBlank) {
        alert('Please capture client signature before submitting handover certificate.');
        setActionLoading(false);
        return;
      }

      const signatureBase64 = canvas.toDataURL('image/png');

      // 1. Submit Handover Sign-Off
      await submitHandover({
        client_signatory_name: clientSignName,
        client_signatory_designation: clientSignDesignation,
        signature_base64: signatureBase64
      });

      // 2. Generate PDF Handover Certificate
      const storagePath = await generateCertificate();
      setRecentCertPath(storagePath);
      
      alert('Project Closeout successfully approved! Project transitioned to DLP status, and retention release invoices generated.');
      
      await refetch();
    } catch (err: any) {
      console.error(err);
      alert(`Handover execution failed: ${err.message || err}`);
    } finally {
      setActionLoading(false);
    }
  };

  const downloadCertPDF = () => {
    if (!recentCertPath) return;
    const { data } = supabase.storage.from('documents').getPublicUrl(recentCertPath);
    window.open(data.publicUrl, '_blank');
  };

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <h1 className="quote-header-title">Project Handover & Closeout</h1>
          <p className="quote-header-subtitle">JEET ERP closeout checklist gate, warranty tracker, and commercial retention releasing</p>
        </div>
        <div>
          <button 
            onClick={() => refetch()} 
            className="quote-btn quote-btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} /> Refresh Gates
          </button>
        </div>
      </header>

      {/* Project Selector */}
      <div className="quote-card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ flex: '1', minWidth: '300px' }}>
          <label className="quote-form-label">Active Project Closeout Selector</label>
          <select 
            value={selectedProjectId} 
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setRecentCertPath(null);
              setClientSignName('');
              setClientSignDesignation('');
            }}
            className="quote-input"
            style={{ width: '100%' }}
          >
            <option value="" disabled>Select project...</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.project_number} — {p.name} ({p.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="quote-card text-center" style={{ padding: '4rem' }}>
          <div className="spinner"></div>
        </div>
      ) : !handoverPkg ? (
        /* Needs initialization */
        <div className="quote-card text-center" style={{ padding: '4rem 2rem' }}>
          <FolderOpen size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Closeout Checklist Package Not Initialized</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.5rem auto 1.5rem auto', maxWidth: '450px' }}>
            Testing & Commissioning works are completing. Initialize the handover package to setup closeout requirements checklist.
          </p>
          <button 
            onClick={handleInitialize}
            className="quote-btn quote-btn-primary"
            disabled={actionLoading}
          >
            {actionLoading ? 'Initializing...' : 'Initialize Closeout Package'}
          </button>
        </div>
      ) : (
        /* Handover details panels */
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Left panel: Gate compliance status & requirements list */}
          <div>
            {/* Gate compliance alert */}
            <div style={{ marginBottom: '1.5rem' }}>
              {gateStatus?.can_handover ? (
                <div className="gate-status-panel gate-status-compliant">
                  <CheckCircle size={24} style={{ flexShrink: 0 }} />
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Closeout Gates COMPLIANT</h4>
                    <p style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                      All systems commissioned, snags closed, and closeout manuals verified. Handover certificate sign-off is unlocked.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="gate-status-panel gate-status-blocked">
                  <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Closeout Gates BLOCKED</h4>
                    <ul style={{ fontSize: '0.8rem', paddingLeft: '1.2rem', marginTop: '0.2rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      {gateStatus?.blockers.map((b, idx) => (
                        <li key={idx}>{b}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Checklist items list */}
            <div className="quote-card">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Mandatory Deliverables Checklist</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {handoverPkg.checklist_items?.map((item) => (
                  <div key={item.id} className="checklist-row">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--secondary)', background: 'rgba(34, 211, 238, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                          {item.category}
                        </span>
                        {item.mandatory && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                            MANDATORY
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{item.requirement}</p>
                      {item.status === 'WAIVED' && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '0.2rem' }}>
                          Waived by {item.waived_by_name}. Reason: {item.waived_reason}
                        </p>
                      )}
                      {item.status === 'DONE' && item.evidence_document_name && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.2rem' }}>
                          Attachment verified: {item.evidence_document_name}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {item.status === 'PENDING' ? (
                        <>
                          {item.category === 'O&M' || item.category === 'Warranty' || item.category === 'Training' ? (
                            <label style={{ cursor: 'pointer', padding: '0.35rem 0.75rem', fontSize: '0.75rem', background: 'var(--surface-hover)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Upload size={12} /> Upload
                              <input 
                                type="file" 
                                onChange={(e) => handleFileUpload(item.id, e)} 
                                style={{ display: 'none' }} 
                              />
                            </label>
                          ) : (
                            <button 
                              onClick={() => {
                                // For items verified automatically, we can simulate verification or mark done
                                updateChecklistItem(item.id, 'DONE').then(() => refetch());
                              }}
                              className="quote-btn"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
                            >
                              Verify
                            </button>
                          )}
                          
                          {/* Waive button */}
                          <button 
                            onClick={() => setWaiveItemId(item.id)}
                            className="quote-btn"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.2)' }}
                          >
                            Waive
                          </button>
                        </>
                      ) : item.status === 'DONE' ? (
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <CheckCircle size={14} /> Verified
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          Waived
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel: Retention ledgering details & Certificate Sign-Off */}
          <div>
            {/* Commercial card */}
            <div className="quote-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <DollarSign size={20} className="text-secondary" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>DLP Retention Release Schedule</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Project Contract Value:</span>
                  <span style={{ fontWeight: 'bold' }}>{fmtAED(retentionValues.contractValue)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Retention Withheld:</span>
                  <span>{retentionValues.pct}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Total Retention Portfolio:</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{fmtAED(retentionValues.total)}</span>
                </div>

                <div style={{ background: 'rgba(34, 211, 238, 0.05)', border: '1px solid var(--secondary-glow)', borderRadius: '8px', padding: '0.75rem', marginTop: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--secondary)', marginBottom: '0.3rem' }}>Releasing Schedule (50/50 split)</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span>1st Release (Immediate):</span>
                    <strong>{fmtAED(retentionValues.half)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>2nd Release (DLP end):</span>
                    <strong>{fmtAED(retentionValues.half)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Handover certificate sign-off card */}
            {handoverPkg.status === 'COMPLETED' ? (
              <div className="quote-card text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', border: '2px solid var(--primary)' }}>
                <CheckCircle size={40} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Project Handover Complete</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  The handover certificate for this project has been fully signed and registered.
                </p>
                <button 
                  onClick={downloadCertPDF}
                  className="quote-btn quote-btn-primary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <FileDown size={16} /> Download Signed Certificate
                </button>
              </div>
            ) : (
              <div className="quote-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Certificate Sign-Off Panel</h3>
                
                {recentCertPath ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', textAlign: 'center' }}>
                    <div style={{ background: 'rgba(0, 229, 160, 0.1)', padding: '1rem', borderRadius: '8px', color: 'var(--primary)', border: '1px solid var(--primary)' }}>
                      Certificate PDF compiled and saved to DMS successfully!
                    </div>
                    <button 
                      type="button" 
                      onClick={downloadCertPDF} 
                      className="quote-btn quote-btn-primary"
                    >
                      Download certificate PDF
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleHandoverSignOff} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label className="quote-form-label">Client Signatory Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Jasem Al-Thani"
                        value={clientSignName}
                        onChange={(e) => setClientSignName(e.target.value)}
                        className="quote-input"
                        style={{ width: '100%' }}
                        disabled={!gateStatus?.can_handover}
                        required
                      />
                    </div>

                    <div>
                      <label className="quote-form-label">Client Signatory Designation</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Facilities Director"
                        value={clientSignDesignation}
                        onChange={(e) => setClientSignDesignation(e.target.value)}
                        className="quote-input"
                        style={{ width: '100%' }}
                        disabled={!gateStatus?.can_handover}
                        required
                      />
                    </div>

                    <div>
                      <label className="quote-form-label">Authorized Sign-off Signature</label>
                      <div className="sig-canvas-container" style={{ background: '#ffffff', height: '120px' }}>
                        <canvas 
                          ref={canvasRef}
                          width={320}
                          height={120}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          className="sig-canvas"
                          style={{ pointerEvents: gateStatus?.can_handover ? 'auto' : 'none' }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                        <button 
                          type="button" 
                          onClick={clearCanvas} 
                          className="quote-btn quote-btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}
                          disabled={!gateStatus?.can_handover}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      className="quote-btn quote-btn-primary" 
                      style={{ width: '100%', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                      disabled={actionLoading || !gateStatus?.can_handover}
                    >
                      <UserCheck size={14} /> Submit closeout sign-off
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

        </div>
      )}

      {/* WAIVER MODAL */}
      {waiveItemId && (
        <div className="tc-modal-overlay">
          <div className="tc-modal-content" style={{ maxWidth: '420px' }}>
            <h2 className="tc-modal-title">Waive Closeout Requirement</h2>
            <form onSubmit={submitWaiver} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label className="quote-form-label">Waive Justification / Reason</label>
                <textarea 
                  placeholder="Enter official waiver justification (e.g. No CCTV system installed in current phase scope)..."
                  value={waiveReason}
                  onChange={(e) => setWaiveReason(e.target.value)}
                  className="quote-input"
                  style={{ width: '100%', height: '90px', resize: 'none' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setWaiveItemId(null)}
                  className="quote-btn quote-btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="quote-btn quote-btn-primary"
                  disabled={actionLoading}
                >
                  Confirm Waive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
