// ============================================================
// JEET ERP — Walkthrough Rapid Snag Capture Page
// Route: /snags/capture
// ============================================================

'use client';
import { logger } from '@/lib/logger';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Camera, UserCheck, AlertTriangle } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { useWalkthrough } from '@/hooks/useWalkthrough';
import { SnagSeverity } from '@/types/snag.types';
import { supabase } from '@/lib/supabase';
import '../snags.css';

interface LocalSnagRow {
  id: number;
  system: string;
  location: string;
  description: string;
  severity: SnagSeverity;
  photoFiles: File[];
  photoUrls: string[];
}

export default function WalkthroughLoggerPage() {
  const router = useRouter();
  const { projects } = useProjects();
  const { logWalkthrough, submitting } = useWalkthrough();

  // Walk details states
  const [projectId, setProjectId] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [clientRep, setClientRep] = useState('');
  const [walkDate, setWalkDate] = useState(new Date().toISOString().split('T')[0]);
  const [comments, setComments] = useState('');

  // Snags list states
  const [snagRows, setSnagRows] = useState<LocalSnagRow[]>([
    { id: 1, system: 'CCTV', location: '', description: '', severity: 'MINOR', photoFiles: [], photoUrls: [] }
  ]);
  const [rowSeq, setRowSeq] = useState(1);

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
      }
    }
  }, [canvasRef]);

  // Touch & Mouse Drawing Coordinates
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

  const addSnagRow = () => {
    const nextSeq = rowSeq + 1;
    setRowSeq(nextSeq);
    setSnagRows(prev => [
      ...prev,
      { id: nextSeq, system: 'CCTV', location: '', description: '', severity: 'MINOR', photoFiles: [], photoUrls: [] }
    ]);
  };

  const removeSnagRow = (id: number) => {
    setSnagRows(prev => prev.filter(r => r.id !== id));
  };

  const handleRowChange = (id: number, field: keyof LocalSnagRow, value: any) => {
    setSnagRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleRowPhotos = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const urls = files.map(f => URL.createObjectURL(f));
      
      setSnagRows(prev => prev.map(r => {
        if (r.id === id) {
          return {
            ...r,
            photoFiles: [...r.photoFiles, ...files],
            photoUrls: [...r.photoUrls, ...urls]
          };
        }
        return r;
      }));
    }
  };

  const handleRemoveRowPhoto = (rowId: number, photoIdx: number) => {
    setSnagRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return {
          ...r,
          photoFiles: r.photoFiles.filter((_, i) => i !== photoIdx),
          photoUrls: r.photoUrls.filter((_, i) => i !== photoIdx)
        };
      }
      return r;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !inspectorName.trim() || !clientRep.trim()) {
      alert('Please select project and enter walkthrough attendees.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      // Parse canvas blank state
      const ctx = canvas.getContext('2d');
      const buffer = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      const isBlank = buffer ? !buffer.data.some(c => c !== 0) : true;

      if (isBlank) {
        alert('Please capture client signature before submitting walkthrough logs.');
        return;
      }

      const signatureBase64 = canvas.toDataURL('image/png');

      // Process snags rows photos
      const parsedSnags: {
        system: string;
        location: string;
        description: string;
        severity: SnagSeverity;
        photo_paths?: string[];
      }[] = [];

      for (const row of snagRows) {
        if (!row.description.trim() || !row.location.trim()) continue;

        // Upload photos for this row
        const uploadedPaths: string[] = [];
        for (const file of row.photoFiles) {
          const path = `snag_photos/${projectId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          const { data, error } = await supabase.storage.from('documents').upload(path, file);
          if (error) throw error;
          if (data) uploadedPaths.push(data.path);
        }

        parsedSnags.push({
          system: row.system,
          location: row.location,
          description: row.description,
          severity: row.severity,
          photo_paths: uploadedPaths
        });
      }

      await logWalkthrough({
        project_id: projectId,
        inspector_name: inspectorName,
        client_representative: clientRep,
        walkthrough_date: walkDate,
        comments: comments || undefined,
        signature_base64: signatureBase64,
        snags: parsedSnags
      });

      alert(`Walkthrough logged! Registered ${parsedSnags.length} punch items.`);
      router.push('/snags');
    } catch (err: any) {
      logger.error(err);
      alert(`Failed to save walkthrough logs: ${err.message || err}`);
    }
  };

  return (
    <div className="quote-container" style={{ maxWidth: '680px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/snags" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--secondary)', textDecoration: 'none', fontWeight: 600, marginBottom: '0.8rem' }}>
          <ArrowLeft size={14} /> Back to Snag Board
        </Link>
        <h1 className="quote-header-title">Walkthrough Rapid Capture</h1>
        <p className="quote-header-subtitle">Log punch list items instantly during joint site walkthroughs</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Walk details card */}
        <div className="quote-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginBottom: 0 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>1. Walk Inspection Details</h3>
          
          <div>
            <label className="quote-form-label">Select Project</label>
            <select 
              value={projectId} 
              onChange={(e) => setProjectId(e.target.value)}
              className="quote-input"
              style={{ width: '100%' }}
              required
            >
              <option value="">Select project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="quote-form-label">JEET Inspector Name</label>
              <input 
                type="text" 
                placeholder="e.g. Site PM"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                className="quote-input"
                style={{ width: '100%' }}
                required
              />
            </div>
            <div>
              <label className="quote-form-label">Client Representative Name</label>
              <input 
                type="text" 
                placeholder="e.g. Owner rep"
                value={clientRep}
                onChange={(e) => setClientRep(e.target.value)}
                className="quote-input"
                style={{ width: '100%' }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="quote-form-label">Date of Walkthrough</label>
              <input 
                type="date" 
                value={walkDate}
                onChange={(e) => setWalkDate(e.target.value)}
                className="quote-input"
                style={{ width: '100%' }}
                required
              />
            </div>
            <div>
              <label className="quote-form-label">General Remarks</label>
              <input 
                type="text" 
                placeholder="Any general remarks or comments..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="quote-input"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Snags rows workspace card */}
        <div className="quote-card" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>2. Defect Snags List</h3>
            <button 
              type="button" 
              onClick={addSnagRow}
              className="quote-btn quote-btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <Plus size={12} /> Add Defect Row
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {snagRows.map((row, idx) => (
              <div key={row.id} style={{ position: 'relative', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '8px', background: 'var(--surface-hover)' }}>
                {/* Row Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--secondary)' }}>Defect Item #{idx+1}</span>
                  {snagRows.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removeSnagRow(row.id)}
                      className="text-error"
                      style={{ background: 'transparent', cursor: 'pointer' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Row Inputs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                    <div>
                      <select 
                        value={row.system} 
                        onChange={(e) => handleRowChange(row.id, 'system', e.target.value)}
                        className="quote-input"
                        style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem' }}
                      >
                        {SYSTEM_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input 
                        type="text" 
                        placeholder="Location (e.g. Lobby GF)"
                        value={row.location}
                        onChange={(e) => handleRowChange(row.id, 'location', e.target.value)}
                        className="quote-input"
                        style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem' }}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '0.8rem' }}>
                    <div>
                      <input 
                        type="text" 
                        placeholder="Description of defect..."
                        value={row.description}
                        onChange={(e) => handleRowChange(row.id, 'description', e.target.value)}
                        className="quote-input"
                        style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem' }}
                        required
                      />
                    </div>
                    <div>
                      <select 
                        value={row.severity} 
                        onChange={(e) => handleRowChange(row.id, 'severity', e.target.value as SnagSeverity)}
                        className="quote-input"
                        style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem' }}
                      >
                        <option value="MINOR">Minor</option>
                        <option value="MAJOR">Major</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>
                  </div>

                  {/* Photo logs inline */}
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', border: '1px dashed var(--border-color)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <Camera size={16} />
                        <span style={{ fontSize: '0.5rem', marginTop: '0.1rem' }}>Photo</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          multiple 
                          onChange={(e) => handleRowPhotos(row.id, e)} 
                          style={{ display: 'none' }} 
                        />
                      </label>
                      
                      {row.photoUrls.map((url, pIdx) => (
                        <div key={pIdx} style={{ position: 'relative', width: '60px', height: '60px' }}>
                          <img src={url} alt="snag" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                          <button 
                            type="button" 
                            onClick={() => handleRemoveRowPhoto(row.id, pIdx)}
                            style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'red', color: 'white', borderRadius: '50%', width: '15px', height: '15px', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Client sign-off canvas card */}
        <div className="quote-card" style={{ marginBottom: 0 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>3. Client Representative Validation</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Please capture signature below to confirm logged snags and walk inspection completion.</p>

          <div className="sig-canvas-container" style={{ background: '#ffffff', height: '160px' }}>
            <canvas 
              ref={canvasRef}
              width={610}
              height={160}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="sig-canvas"
            />
          </div>
          <div className="sig-canvas-buttons" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
            <button 
              type="button" 
              onClick={clearCanvas} 
              className="quote-btn quote-btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
            >
              Clear Signature
            </button>
            
            <button 
              type="submit" 
              className="quote-btn quote-btn-primary"
              disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <UserCheck size={14} /> {submitting ? 'Submitting Walkthrough...' : 'Submit Walkthrough Logs'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

const SYSTEM_OPTIONS = [
  { value: 'CCTV', label: 'CCTV System' },
  { value: 'ACS', label: 'Access Control System (ACS)' },
  { value: 'GATE_BARRIER', label: 'Gate Barrier / ANPR' },
  { value: 'FIRE_ALARM', label: 'Fire Alarm Interface' },
  { value: 'STRUCTURED_CABLING', label: 'Structured Cabling' },
  { value: 'BMS', label: 'Building Management System (BMS)' },
  { value: 'MEP', label: 'General MEP / HVAC' }
];
