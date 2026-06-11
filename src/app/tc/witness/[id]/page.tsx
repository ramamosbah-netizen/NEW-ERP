// ============================================================
// JEET ERP — T&C Witness Sign-Off Page
// Route: /tc/witness/[id]
// ============================================================

'use client';

import { useState, use, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertTriangle, PenTool } from 'lucide-react';
import { useTCExecution } from '@/hooks/useTCExecution';
import { supabase } from '@/lib/supabase';
import '../../tc.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TCWitnessSignOffPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const packageId = resolvedParams.id;

  const {
    pkg,
    loading,
    error,
    submitWitnessSignOff
  } = useTCExecution(packageId);

  // Witness form states
  const [witnessStage, setWitnessStage] = useState<'INTERNAL' | 'CONSULTANT' | 'CLIENT'>('CONSULTANT');
  const [witnessName, setWitnessName] = useState('');
  const [designation, setDesignation] = useState('');
  const [company, setCompany] = useState('');
  const [result, setResult] = useState<'APPROVED' | 'APPROVED_WITH_COMMENTS' | 'REJECTED'>('APPROVED');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Canvas drawing ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Initialize canvas size
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

  // Mouse & Touch Drawing Handlers
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
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const handleSignOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!witnessName.trim() || !designation.trim() || !company.trim()) {
      alert('Please fill out all witness verification fields.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setSubmitting(true);

      // 1. Convert signature to base64
      const signatureBase64 = canvas.toDataURL('image/png');
      
      // Let's check if the canvas is empty
      // If client doesn't draw anything, we shouldn't save an empty signature.
      // We will check by creating a temp canvas of identical sizes and matching data.
      const buffer = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
      const isBlank = buffer ? !buffer.data.some(channel => channel !== 0) : true;
      
      if (isBlank && result !== 'REJECTED') {
        alert('Please provide a signature for approval sign-offs.');
        setSubmitting(false);
        return;
      }

      // 2. Upload signature to private bucket
      let signaturePath = '';
      if (!isBlank) {
        const base64Data = signatureBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const filename = `witness_sigs/${pkg?.id}_${witnessStage}_${Date.now()}.png`;

        const { data, error } = await supabase.storage
          .from('private_documents')
          .upload(filename, imageBuffer, {
            contentType: 'image/png',
            upsert: true
          });

        if (error) throw error;
        signaturePath = data?.path || '';
      }

      // 3. Submit Witness Sign-off
      await submitWitnessSignOff({
        witness_stage: witnessStage,
        witness_name: witnessName,
        designation: designation,
        company: company,
        signature_path: signaturePath || undefined,
        result: result,
        comments: comments || undefined
      });

      alert('Witness validation recorded successfully.');
      router.push('/tc');
    } catch (err: any) {
      console.error(err);
      alert(`Sign-off failed: ${err.message || err}`);
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
    <div className="quote-container" style={{ maxWidth: '600px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/tc" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--secondary)', textDecoration: 'none', fontWeight: 600, marginBottom: '0.8rem' }}>
          <ArrowLeft size={14} /> Back to T&C Registry
        </Link>
        <span style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--secondary)', fontWeight: 600 }}>{pkg.package_number}</span>
        <h1 className="quote-header-title">Witness Verification Sign-Off</h1>
        <p className="quote-header-subtitle">Record official witness results and capture client/consultant signatures</p>
      </div>

      <div className="tc-card" style={{ padding: '1.5rem' }}>
        <form onSubmit={handleSignOff} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="quote-form-label">Verification Stage</label>
              <select 
                value={witnessStage} 
                onChange={(e) => setWitnessStage(e.target.value as any)}
                className="quote-input"
                style={{ width: '100%' }}
              >
                <option value="INTERNAL">Internal Quality Control (QC)</option>
                <option value="CONSULTANT">Consultant Witness</option>
                <option value="CLIENT">Client Witness</option>
              </select>
            </div>
            
            <div>
              <label className="quote-form-label">Review Status Result</label>
              <select 
                value={result} 
                onChange={(e) => setResult(e.target.value as any)}
                className="quote-input"
                style={{ 
                  width: '100%',
                  borderColor: result === 'APPROVED' ? 'var(--success)' : result === 'APPROVED_WITH_COMMENTS' ? 'var(--warning)' : 'var(--error)'
                }}
              >
                <option value="APPROVED">APPROVED (Pass)</option>
                <option value="APPROVED_WITH_COMMENTS">APPROVED WITH COMMENTS</option>
                <option value="REJECTED">REJECTED (Failed/Retest)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="quote-form-label">Witness Signatory Name</label>
            <input 
              type="text" 
              placeholder="e.g. Eng. Ahmad Salem"
              value={witnessName}
              onChange={(e) => setWitnessName(e.target.value)}
              className="quote-input"
              style={{ width: '100%' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="quote-form-label">Designation / Role</label>
              <input 
                type="text" 
                placeholder="e.g. Resident MEP Inspector"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="quote-input"
                style={{ width: '100%' }}
                required
              />
            </div>
            <div>
              <label className="quote-form-label">Company / Authority</label>
              <input 
                type="text" 
                placeholder="e.g. Arab Engineering Bureau"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="quote-input"
                style={{ width: '100%' }}
                required
              />
            </div>
          </div>

          <div>
            <label className="quote-form-label">Witness Comments / Remarks</label>
            <textarea 
              placeholder="Comments, exceptions, or list of outstanding items..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="quote-input"
              style={{ width: '100%', height: '80px', resize: 'none' }}
            />
          </div>

          {result !== 'REJECTED' && (
            <div>
              <label className="quote-form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <PenTool size={14} /> Witness Digital Signature Canvas
              </label>
              <div className="sig-canvas-container">
                <canvas 
                  ref={canvasRef}
                  width={530}
                  height={150}
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
              <div className="sig-canvas-buttons">
                <button 
                  type="button" 
                  onClick={clearCanvas} 
                  className="quote-btn quote-btn-secondary"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                >
                  Clear Signature
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <Link href="/tc" className="quote-btn quote-btn-secondary" style={{ textDecoration: 'none' }}>
              Cancel
            </Link>
            <button 
              type="submit" 
              className="quote-btn quote-btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Register Witness Sign-Off'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
// 
