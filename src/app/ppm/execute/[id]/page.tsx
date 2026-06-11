// ============================================================
// JEET ERP — PPM Visit Mobile Execution Page
// Route: /ppm/execute/[id]
// Mobile-first: one-handed phone UX for dusty site gate usage
// ============================================================

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Play,
  CheckCircle,
  XCircle,
  MinusCircle,
  Camera,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Clock,
  User,
  FileText,
  AlertTriangle,
  Send,
  Loader2,
  ArrowLeft,
  Wrench,
  ClipboardCheck,
  PenTool,
  Info
} from 'lucide-react';
import { usePPMVisit } from '@/hooks/usePPMVisits';
import { PPM_VISIT_STATUS_LABELS, PPM_VISIT_STATUS_COLORS } from '@/constants/amc.constants';
import type { PPMVisitChecklistResult, ChecklistTemplateItem } from '@/types/ppm.types';

type ExecutionStep = 'OVERVIEW' | 'CHECKLIST' | 'SUMMARY' | 'COMPLETE';

const STEPS: ExecutionStep[] = ['OVERVIEW', 'CHECKLIST', 'SUMMARY', 'COMPLETE'];
const STEP_LABELS: Record<ExecutionStep, string> = {
  OVERVIEW: 'Site Overview',
  CHECKLIST: 'Checklist',
  SUMMARY: 'Summary & Sign-off',
  COMPLETE: 'Completed'
};
const STEP_ICONS: Record<ExecutionStep, any> = {
  OVERVIEW: Wrench,
  CHECKLIST: ClipboardCheck,
  SUMMARY: PenTool,
  COMPLETE: CheckCircle
};

// Checklist result for local state management
interface LocalChecklistResult {
  templateItemId: string;
  itemText: string;
  itemType: string;
  result: 'PASS' | 'FAIL' | 'NA' | null;
  value: string;
  notes: string;
  photoPaths: string[];
}

export default function PPMExecutionPage() {
  const params = useParams();
  const router = useRouter();
  const visitId = params?.id as string;

  const {
    visit,
    checklistTemplate,
    loading,
    error,
    startVisit,
    logChecklistResult,
    completeVisit
  } = usePPMVisit(visitId);

  // Step wizard state
  const [currentStep, setCurrentStep] = useState<ExecutionStep>('OVERVIEW');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Checklist items local state
  const [checklistResults, setChecklistResults] = useState<LocalChecklistResult[]>([]);
  const [currentChecklistIndex, setCurrentChecklistIndex] = useState(0);

  // Summary & sign-off
  const [summary, setSummary] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [clientSignName, setClientSignName] = useState('');
  const [clientSignDesignation, setClientSignDesignation] = useState('');

  // Initialize checklist items from template
  useEffect(() => {
    if (checklistTemplate?.items && checklistResults.length === 0) {
      const items: LocalChecklistResult[] = (checklistTemplate.items || [])
        .sort((a: ChecklistTemplateItem, b: ChecklistTemplateItem) => a.sort_order - b.sort_order)
        .map((item: ChecklistTemplateItem) => ({
          templateItemId: item.id,
          itemText: item.item_text,
          itemType: item.item_type,
          result: null,
          value: '',
          notes: '',
          photoPaths: []
        }));
      setChecklistResults(items);
    }
  }, [checklistTemplate]);

  // Auto-advance to correct step based on visit status
  useEffect(() => {
    if (visit) {
      if (visit.status === 'COMPLETED') {
        setCurrentStep('COMPLETE');
      } else if (visit.status === 'IN_PROGRESS') {
        setCurrentStep('CHECKLIST');
      }
    }
  }, [visit?.status]);

  // Derived
  const completedItems = checklistResults.filter(r => r.result !== null).length;
  const totalItems = checklistResults.length;
  const failedItems = checklistResults.filter(r => r.result === 'FAIL').length;
  const passedItems = checklistResults.filter(r => r.result === 'PASS').length;
  const currentItem = checklistResults[currentChecklistIndex];
  const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // --- Handlers ---

  const handleStartVisit = async () => {
    try {
      setSubmitting(true);
      setSubmitError('');
      await startVisit();
      setCurrentStep('CHECKLIST');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to start visit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChecklistResult = (result: 'PASS' | 'FAIL' | 'NA') => {
    setChecklistResults(prev => {
      const copy = [...prev];
      copy[currentChecklistIndex] = { ...copy[currentChecklistIndex], result };
      return copy;
    });
  };

  const handleChecklistValue = (value: string) => {
    setChecklistResults(prev => {
      const copy = [...prev];
      copy[currentChecklistIndex] = { ...copy[currentChecklistIndex], value };
      return copy;
    });
  };

  const handleChecklistNotes = (notes: string) => {
    setChecklistResults(prev => {
      const copy = [...prev];
      copy[currentChecklistIndex] = { ...copy[currentChecklistIndex], notes };
      return copy;
    });
  };

  const handleNextChecklistItem = () => {
    if (currentChecklistIndex < totalItems - 1) {
      setCurrentChecklistIndex(currentChecklistIndex + 1);
    } else {
      // All items done, go to summary
      setCurrentStep('SUMMARY');
    }
  };

  const handlePrevChecklistItem = () => {
    if (currentChecklistIndex > 0) {
      setCurrentChecklistIndex(currentChecklistIndex - 1);
    }
  };

  const handleSubmitAllChecklistResults = async () => {
    try {
      setSubmitting(true);
      setSubmitError('');

      // Save each checklist result to DB
      for (const item of checklistResults) {
        if (item.result) {
          await logChecklistResult({
            template_item_id: item.templateItemId,
            result: item.result,
            value: item.value || undefined,
            notes: item.notes || undefined,
            photo_paths: item.photoPaths
          });
        }
      }

      // Complete the visit
      await completeVisit({
        signaturePath: '', // Signature capture would use a canvas library
        clientSignName,
        clientSignDesignation,
        summary,
        recommendations
      });

      setCurrentStep('COMPLETE');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to complete visit');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Render ---

  if (loading && !visit) {
    return (
      <div className="quote-container" style={{ textAlign: 'center', padding: '6rem 1rem' }}>
        <div className="spinner" style={{ margin: '0 auto 1.5rem auto' }}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Loading visit data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quote-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <AlertTriangle size={48} style={{ color: 'var(--error)', margin: '0 auto 1rem auto' }} />
        <p style={{ color: 'var(--error)' }}>Error: {error.message}</p>
        <Link href="/ppm/calendar" className="quote-btn quote-btn-secondary" style={{ marginTop: '1rem', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Back to Calendar
        </Link>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="quote-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Visit not found.</p>
        <Link href="/ppm/calendar" className="quote-btn quote-btn-secondary" style={{ marginTop: '1rem', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Back to Calendar
        </Link>
      </div>
    );
  }

  const statusColors = PPM_VISIT_STATUS_COLORS[visit.status] || PPM_VISIT_STATUS_COLORS.SCHEDULED;

  return (
    <div className="quote-container" style={{ maxWidth: '640px', margin: '0 auto', padding: '1rem' }}>
      {/* Mobile Nav Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1rem',
        padding: '0.75rem 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <Link href="/ppm/calendar" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--secondary)' }}>
            {visit.visit_number}
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PPM Visit Execution</p>
        </div>
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: '4px',
          background: statusColors.bg,
          color: statusColors.text,
          border: `1px solid ${statusColors.border}`
        }}>
          {PPM_VISIT_STATUS_LABELS[visit.status]}
        </span>
      </div>

      {/* Step Progress Indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        padding: '0.75rem',
        background: 'rgba(0,0,0,0.25)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.04)'
      }}>
        {STEPS.map((step, idx) => {
          const StepIcon = STEP_ICONS[step];
          const isActive = step === currentStep;
          const isCompleted = STEPS.indexOf(currentStep) > idx;
          return (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {idx > 0 && (
                <div style={{
                  width: '20px',
                  height: '2px',
                  background: isCompleted ? 'var(--primary)' : 'rgba(255,255,255,0.08)'
                }} />
              )}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.2rem'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isActive
                    ? 'var(--primary)'
                    : isCompleted
                      ? 'rgba(0, 229, 160, 0.2)'
                      : 'rgba(255,255,255,0.04)',
                  color: isActive
                    ? '#000'
                    : isCompleted
                      ? 'var(--primary)'
                      : 'var(--text-muted)',
                  transition: 'all 0.3s ease',
                  border: isActive ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.06)'
                }}>
                  {isCompleted ? <CheckCircle size={14} /> : <StepIcon size={14} />}
                </div>
                <span style={{
                  fontSize: '0.58rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                  whiteSpace: 'nowrap'
                }}>
                  {STEP_LABELS[step]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error banner */}
      {submitError && (
        <div style={{
          padding: '0.75rem 1rem',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          color: 'var(--error)',
          fontSize: '0.82rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertTriangle size={16} />
          {submitError}
        </div>
      )}

      {/* =================== STEP 1: OVERVIEW =================== */}
      {currentStep === 'OVERVIEW' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Site Info Card */}
          <div className="quote-card" style={{ padding: '1.2rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={18} style={{ color: 'var(--primary)' }} /> Site Information
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Client</label>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{visit.client_name}</p>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Site</label>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{visit.site_name}</p>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Address</label>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{visit.site_address}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Scheduled Date</label>
                  <p style={{ fontSize: '0.9rem', color: '#fff', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Clock size={12} />
                    {visit.scheduled_date ? new Date(visit.scheduled_date).toLocaleDateString('en-GB') : '—'}
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Slot</label>
                  <p style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>{visit.scheduled_slot || '—'}</p>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Technician</label>
                <p style={{ fontSize: '0.9rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <User size={14} style={{ color: 'var(--secondary)' }} />
                  {visit.technician_name || 'Not assigned'}
                </p>
              </div>
            </div>
          </div>

          {/* Contract Info */}
          <div className="quote-card" style={{ padding: '1.2rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} style={{ color: 'var(--secondary)' }} /> Contract Details
            </h2>
            <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', color: 'var(--text-secondary)' }}>
              <span>Contract: <strong style={{ color: 'var(--secondary)', fontFamily: 'var(--font-mono)' }}>{visit.contract_number || visit.amc_contracts?.contract_number}</strong></span>
              {visit.amc_contracts?.systems && (
                <span>Systems: {visit.amc_contracts.systems.join(', ')}</span>
              )}
              {visit.amc_contracts?.sla_tier && (
                <span>SLA Tier: <strong>{visit.amc_contracts.sla_tier}</strong></span>
              )}
            </div>
          </div>

          {/* Checklist Preview */}
          {checklistTemplate && (
            <div className="quote-card" style={{ padding: '1.2rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClipboardCheck size={18} style={{ color: 'var(--warning)' }} /> Checklist Preview
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
                {checklistTemplate.name} — {checklistTemplate.items?.length || 0} items
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {(checklistTemplate.items || []).slice(0, 5).map((item: ChecklistTemplateItem, idx: number) => (
                  <div key={item.id} style={{
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center'
                  }}>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', minWidth: '24px' }}>{idx + 1}.</span>
                    {item.item_text}
                  </div>
                ))}
                {(checklistTemplate.items?.length || 0) > 5 && (
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', paddingTop: '0.3rem' }}>
                    + {(checklistTemplate.items?.length || 0) - 5} more items
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Start Visit Button - BIG touch target */}
          {visit.status === 'SCHEDULED' && (
            <button
              onClick={handleStartVisit}
              disabled={submitting}
              className="quote-btn quote-btn-primary"
              style={{
                width: '100%',
                padding: '1.2rem',
                fontSize: '1.1rem',
                fontWeight: 800,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                marginTop: '0.5rem',
                minHeight: '60px'
              }}
            >
              {submitting ? (
                <><Loader2 size={22} className="spin" /> Starting...</>
              ) : (
                <><Play size={22} /> START VISIT</>
              )}
            </button>
          )}

          {visit.status === 'IN_PROGRESS' && (
            <button
              onClick={() => setCurrentStep('CHECKLIST')}
              className="quote-btn quote-btn-primary"
              style={{
                width: '100%',
                padding: '1.2rem',
                fontSize: '1.1rem',
                fontWeight: 800,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                marginTop: '0.5rem',
                minHeight: '60px'
              }}
            >
              <ClipboardCheck size={22} /> CONTINUE CHECKLIST
            </button>
          )}
        </div>
      )}

      {/* =================== STEP 2: CHECKLIST =================== */}
      {currentStep === 'CHECKLIST' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Progress bar */}
          <div className="quote-card" style={{ padding: '0.8rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Item {currentChecklistIndex + 1} of {totalItems}
              </span>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: progressPct === 100 ? 'var(--primary)' : 'var(--warning)',
                fontFamily: 'var(--font-mono)'
              }}>
                {progressPct}% Complete
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progressPct}%`,
                height: '100%',
                background: progressPct === 100
                  ? 'var(--primary)'
                  : 'linear-gradient(90deg, var(--secondary), var(--primary))',
                borderRadius: '3px',
                transition: 'width 0.4s ease'
              }} />
            </div>
          </div>

          {/* Current Checklist Item Card */}
          {currentItem && (
            <div className="quote-card" style={{ padding: '1.5rem' }}>
              {/* Item header */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  minWidth: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(34, 211, 238, 0.1)',
                  color: 'var(--secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  fontSize: '0.9rem'
                }}>
                  {currentChecklistIndex + 1}
                </div>
                <div>
                  <p style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', lineHeight: 1.4 }}>
                    {currentItem.itemText}
                  </p>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-muted)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    marginTop: '0.5rem',
                    display: 'inline-block'
                  }}>
                    {currentItem.itemType.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* PASS/FAIL/NA Buttons - Large touch targets */}
              {(currentItem.itemType === 'PASS_FAIL' || currentItem.itemType === 'PHOTO_REQUIRED') && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '0.75rem',
                  marginBottom: '1rem'
                }}>
                  <button
                    onClick={() => handleChecklistResult('PASS')}
                    style={{
                      padding: '1.2rem 0.5rem',
                      borderRadius: '10px',
                      border: currentItem.result === 'PASS'
                        ? '2px solid #00E5A0'
                        : '1px solid rgba(255,255,255,0.08)',
                      background: currentItem.result === 'PASS'
                        ? 'rgba(0, 229, 160, 0.15)'
                        : 'rgba(0,0,0,0.2)',
                      color: currentItem.result === 'PASS' ? '#00E5A0' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <CheckCircle size={28} />
                    PASS
                  </button>

                  <button
                    onClick={() => handleChecklistResult('FAIL')}
                    style={{
                      padding: '1.2rem 0.5rem',
                      borderRadius: '10px',
                      border: currentItem.result === 'FAIL'
                        ? '2px solid #ef4444'
                        : '1px solid rgba(255,255,255,0.08)',
                      background: currentItem.result === 'FAIL'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(0,0,0,0.2)',
                      color: currentItem.result === 'FAIL' ? '#ef4444' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <XCircle size={28} />
                    FAIL
                  </button>

                  <button
                    onClick={() => handleChecklistResult('NA')}
                    style={{
                      padding: '1.2rem 0.5rem',
                      borderRadius: '10px',
                      border: currentItem.result === 'NA'
                        ? '2px solid #94a3b8'
                        : '1px solid rgba(255,255,255,0.08)',
                      background: currentItem.result === 'NA'
                        ? 'rgba(148, 163, 184, 0.15)'
                        : 'rgba(0,0,0,0.2)',
                      color: currentItem.result === 'NA' ? '#94a3b8' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <MinusCircle size={28} />
                    N/A
                  </button>
                </div>
              )}

              {/* VALUE input */}
              {currentItem.itemType === 'VALUE' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                    Measured Value
                  </label>
                  <input
                    type="text"
                    value={currentItem.value}
                    onChange={(e) => handleChecklistValue(e.target.value)}
                    className="quote-filter-input"
                    placeholder="Enter measured value (e.g., 12.5V)"
                    style={{
                      width: '100%',
                      fontSize: '1.1rem',
                      padding: '1rem',
                      borderRadius: '10px'
                    }}
                  />
                  {/* Still need pass/fail for values */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.75rem' }}>
                    {(['PASS', 'FAIL', 'NA'] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => handleChecklistResult(r)}
                        style={{
                          padding: '0.6rem',
                          borderRadius: '8px',
                          border: currentItem.result === r
                            ? `2px solid ${r === 'PASS' ? '#00E5A0' : r === 'FAIL' ? '#ef4444' : '#94a3b8'}`
                            : '1px solid rgba(255,255,255,0.08)',
                          background: currentItem.result === r
                            ? `rgba(${r === 'PASS' ? '0,229,160' : r === 'FAIL' ? '239,68,68' : '148,163,184'}, 0.15)`
                            : 'rgba(0,0,0,0.2)',
                          color: currentItem.result === r
                            ? (r === 'PASS' ? '#00E5A0' : r === 'FAIL' ? '#ef4444' : '#94a3b8')
                            : 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                  Notes (Optional)
                </label>
                <textarea
                  value={currentItem.notes}
                  onChange={(e) => handleChecklistNotes(e.target.value)}
                  className="quote-filter-input"
                  placeholder="Any observations or remarks..."
                  rows={2}
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    fontSize: '0.88rem',
                    padding: '0.75rem',
                    borderRadius: '8px'
                  }}
                />
              </div>
            </div>
          )}

          {/* Navigation Buttons - Large touch targets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <button
              onClick={handlePrevChecklistItem}
              disabled={currentChecklistIndex === 0}
              className="quote-btn quote-btn-secondary"
              style={{
                padding: '1rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                borderRadius: '10px',
                opacity: currentChecklistIndex === 0 ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                minHeight: '52px'
              }}
            >
              <ChevronLeft size={18} /> Previous
            </button>

            <button
              onClick={handleNextChecklistItem}
              disabled={!currentItem?.result}
              className="quote-btn quote-btn-primary"
              style={{
                padding: '1rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                borderRadius: '10px',
                opacity: !currentItem?.result ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                minHeight: '52px'
              }}
            >
              {currentChecklistIndex === totalItems - 1 ? 'Finish' : 'Next'} <ChevronRight size={18} />
            </button>
          </div>

          {/* Skip to summary link */}
          {completedItems > 0 && (
            <button
              onClick={() => setCurrentStep('SUMMARY')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.78rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '0.5rem',
                textAlign: 'center'
              }}
            >
              Skip to Summary ({completedItems}/{totalItems} items done)
            </button>
          )}
        </div>
      )}

      {/* =================== STEP 3: SUMMARY & SIGN-OFF =================== */}
      {currentStep === 'SUMMARY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Results Summary */}
          <div className="quote-card" style={{ padding: '1.2rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardCheck size={18} style={{ color: 'var(--secondary)' }} /> Checklist Results
            </h2>

            {/* Stats badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'rgba(0, 229, 160, 0.08)',
                border: '1px solid rgba(0, 229, 160, 0.15)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#00E5A0', fontFamily: 'var(--font-mono)' }}>{passedItems}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>PASSED</div>
              </div>
              <div style={{
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444', fontFamily: 'var(--font-mono)' }}>{failedItems}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>FAILED</div>
              </div>
              <div style={{
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'rgba(148, 163, 184, 0.08)',
                border: '1px solid rgba(148, 163, 184, 0.15)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{totalItems - passedItems - failedItems}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>N/A / SKIPPED</div>
              </div>
            </div>

            {/* Defect warning */}
            {failedItems > 0 && (
              <div style={{
                padding: '0.75rem 1rem',
                background: 'rgba(249, 115, 22, 0.08)',
                border: '1px solid rgba(249, 115, 22, 0.2)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                fontSize: '0.78rem',
                color: '#f97316'
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>
                  <strong>{failedItems} failed item(s)</strong> detected. A defect service ticket will be auto-created upon completion.
                </span>
              </div>
            )}

            {/* Item-by-item list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '1rem', maxHeight: '200px', overflowY: 'auto' }}>
              {checklistResults.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.6rem',
                  background: 'rgba(0,0,0,0.15)',
                  borderRadius: '6px',
                  fontSize: '0.78rem'
                }}>
                  {item.result === 'PASS' && <CheckCircle size={14} style={{ color: '#00E5A0', flexShrink: 0 }} />}
                  {item.result === 'FAIL' && <XCircle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />}
                  {item.result === 'NA' && <MinusCircle size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />}
                  {!item.result && <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />}
                  <span style={{
                    color: !item.result ? 'var(--text-muted)' : 'var(--text-secondary)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.itemText}
                  </span>
                </div>
              ))}
            </div>

            {/* Back to checklist link */}
            <button
              onClick={() => { setCurrentStep('CHECKLIST'); setCurrentChecklistIndex(0); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '0.5rem 0',
                marginTop: '0.5rem'
              }}
            >
              ← Edit checklist results
            </button>
          </div>

          {/* Summary & Recommendations */}
          <div className="quote-card" style={{ padding: '1.2rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} style={{ color: 'var(--primary)' }} /> Summary & Recommendations
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                  Visit Summary *
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="quote-filter-input"
                  placeholder="Describe work performed during this visit..."
                  rows={4}
                  style={{ width: '100%', resize: 'vertical', fontSize: '0.88rem', padding: '0.75rem', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                  Recommendations
                </label>
                <textarea
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  className="quote-filter-input"
                  placeholder="Any future recommendations for client or scheduling..."
                  rows={3}
                  style={{ width: '100%', resize: 'vertical', fontSize: '0.88rem', padding: '0.75rem', borderRadius: '8px' }}
                />
              </div>
            </div>
          </div>

          {/* Client Sign-off */}
          <div className="quote-card" style={{ padding: '1.2rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PenTool size={18} style={{ color: 'var(--warning)' }} /> Client Sign-off
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                  Client Representative Name
                </label>
                <input
                  type="text"
                  value={clientSignName}
                  onChange={(e) => setClientSignName(e.target.value)}
                  className="quote-filter-input"
                  placeholder="e.g., Mr. Ahmed Al Maktoum"
                  style={{ width: '100%', fontSize: '0.88rem', padding: '0.75rem', borderRadius: '8px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                  Designation
                </label>
                <input
                  type="text"
                  value={clientSignDesignation}
                  onChange={(e) => setClientSignDesignation(e.target.value)}
                  className="quote-filter-input"
                  placeholder="e.g., Facility Manager"
                  style={{ width: '100%', fontSize: '0.88rem', padding: '0.75rem', borderRadius: '8px' }}
                />
              </div>

              {/* Placeholder for signature pad */}
              <div style={{
                padding: '2rem',
                border: '2px dashed rgba(255,255,255,0.1)',
                borderRadius: '10px',
                textAlign: 'center',
                color: 'var(--text-muted)'
              }}>
                <PenTool size={32} style={{ margin: '0 auto 0.5rem auto', opacity: 0.3 }} />
                <p style={{ fontSize: '0.78rem' }}>Signature pad — canvas-based capture integrated in production</p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmitAllChecklistResults}
            disabled={submitting || !summary.trim()}
            className="quote-btn quote-btn-primary"
            style={{
              width: '100%',
              padding: '1.2rem',
              fontSize: '1.1rem',
              fontWeight: 800,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              opacity: submitting || !summary.trim() ? 0.5 : 1,
              minHeight: '60px'
            }}
          >
            {submitting ? (
              <><Loader2 size={22} className="spin" /> Submitting...</>
            ) : (
              <><Send size={20} /> COMPLETE VISIT & FILE REPORT</>
            )}
          </button>
        </div>
      )}

      {/* =================== STEP 4: COMPLETE =================== */}
      {currentStep === 'COMPLETE' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '3rem 1rem',
          textAlign: 'center'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(0, 229, 160, 0.15)',
            border: '3px solid var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse 2s infinite'
          }}>
            <CheckCircle size={40} style={{ color: 'var(--primary)' }} />
          </div>

          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
              Visit Completed
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '360px' }}>
              Visit <strong style={{ color: 'var(--secondary)' }}>{visit.visit_number}</strong> has been 
              completed and the report has been filed.
            </p>
            {failedItems > 0 && (
              <p style={{ color: 'var(--warning)', fontSize: '0.82rem', marginTop: '0.8rem' }}>
                ⚠ {failedItems} defect item(s) — auto-defect service ticket created.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link
              href="/ppm/calendar"
              className="quote-btn quote-btn-primary"
              style={{ textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: '10px' }}
            >
              Back to Calendar
            </Link>
            <Link
              href={`/amc/${visit.contract_id}`}
              className="quote-btn quote-btn-secondary"
              style={{ textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: '10px' }}
            >
              View Contract
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
