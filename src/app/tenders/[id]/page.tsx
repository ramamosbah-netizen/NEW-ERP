'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  Briefcase, 
  Calendar, 
  MapPin, 
  User, 
  DollarSign, 
  Edit, 
  ArrowLeft, 
  Clock, 
  AlertCircle, 
  Download, 
  Check, 
  FileText, 
  Layers,
  Settings,
  Lock,
  Unlock
} from 'lucide-react';
import '@/app/tenders/tenders.css';

type StatusLog = {
  status: string;
  updated_at: string;
  updated_by: string;
  note: string;
};

type Tender = {
  id: string;
  title: string;
  project_name: string;
  client_name: string;
  location: string;
  deadline_date: string;
  budget: number | null;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Completed';
  scope_of_work: string;
  
  tech_discipline: string | null;
  tech_equipment_list: string | null;
  tech_standards: string | null;
  tech_notes: string | null;
  
  client_special_requests: string | null;
  client_compliance: string | null;
  client_delivery_expectations: string | null;
  client_warranty: string | null;
  
  status_history: StatusLog[];
  created_at: string;
  updated_at: string;
};

type TenderDocument = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_at: string;
};

export default function TenderDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const tenderId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [tender, setTender] = useState<Tender | null>(null);
  const [documents, setDocuments] = useState<TenderDocument[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Status transition states
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<Tender['status']>('Draft');
  const [boq, setBoq] = useState<{ id: string; status: string } | null>(null);

  useEffect(() => {
    const fetchTenderDetails = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1. Verify User Session
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.replace('/signin');
          return;
        }

        // 2. Fetch Tender row
        const { data: tenderData, error: tenderError } = await supabase
          .from('tenders')
          .select('*')
          .eq('id', tenderId)
          .single();

        if (tenderError) {
          throw tenderError;
        }

        setTender(tenderData as Tender);
        setSelectedStatus(tenderData.status);

        // 3. Fetch linked documents
        const { data: docData, error: docError } = await supabase
          .from('tender_documents')
          .select('id, file_name, file_path, file_size, file_type, uploaded_at')
          .eq('tender_id', tenderId);

        if (docError) {
          console.warn('Could not load documents:', docError);
        } else {
          setDocuments(docData as TenderDocument[] || []);
        }

        // 4. Fetch linked BOQ
        const { data: boqData, error: boqError } = await supabase
          .from('boqs')
          .select('id, status')
          .eq('tender_id', tenderId)
          .maybeSingle();

        if (boqError) {
          console.warn('Could not load BOQ:', boqError);
        } else {
          setBoq(boqData);
        }

      } catch (err: any) {
        console.error('Error fetching tender details:', err);
        setErrorMsg(err.message || 'Failed to retrieve tender data.');
      } finally {
        setLoading(false);
      }
    };

    fetchTenderDetails();
  }, [tenderId, router]);

  // Handle status updates
  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tender) return;
    setIsUpdatingStatus(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User session expired. Please sign in.');
      }

      // Add a history item
      const newHistoryLog: StatusLog = {
        status: selectedStatus,
        updated_at: new Date().toISOString(),
        updated_by: user.email || 'ERP Staff',
        note: statusNote.trim() || `Status updated to ${selectedStatus}.`
      };

      const updatedHistory = [newHistoryLog, ...(tender.status_history || [])];

      // Save status transition
      const { error: updateError } = await supabase
        .from('tenders')
        .update({
          status: selectedStatus,
          status_history: updatedHistory,
          updated_at: new Date().toISOString()
        })
        .eq('id', tender.id);

      if (updateError) {
        throw updateError;
      }

      // Refresh page state local values
      setTender({
        ...tender,
        status: selectedStatus,
        status_history: updatedHistory,
        updated_at: new Date().toISOString()
      });
      
      setStatusNote('');
      alert(`Status updated successfully to ${selectedStatus}!`);
    } catch (err: any) {
      console.error('Failed updating status:', err);
      alert(`Error updating status: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Status Badge styles helper
  const getStatusClass = (status: Tender['status']) => {
    switch (status) {
      case 'Draft': return 'status-draft';
      case 'Submitted': return 'status-submitted';
      case 'Under Review': return 'status-review';
      case 'Approved': return 'status-approved';
      case 'Rejected': return 'status-rejected';
      case 'Completed': return 'status-completed';
      default: return 'status-draft';
    }
  };

  // Helper to structure scope of work (renders list bullets nicely if split by line)
  const renderScopeOfWork = (scopeText: string) => {
    if (!scopeText) return <p className="detail-text-block">No scope details provided.</p>;
    
    // Split scope text if it contains standard bullet lines
    const lines = scopeText.split('\n');
    const hasBullets = lines.some(l => l.trim().startsWith('-') || l.trim().startsWith('•') || l.trim().startsWith('*'));

    if (!hasBullets) {
      return <div className="detail-text-block">{scopeText}</div>;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {lines.map((line, index) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) {
            const cleanText = trimmed.substring(1).trim();
            return (
              <ul key={index} className="detail-bullets">
                <li>{cleanText}</li>
              </ul>
            );
          }
          return trimmed ? <p key={index} className="detail-text-block" style={{ margin: '0' }}>{line}</p> : null;
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner"></div>
        <p style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-secondary)' }}>Retrieving Tender Profile...</p>
      </div>
    );
  }

  if (errorMsg || !tender) {
    return (
      <div className="tenders-container">
        <div className="tenders-header">
          <Link href="/tenders" className="logout-btn" style={{ textDecoration: 'none', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
        <div className="db-warning-banner" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', marginTop: '2rem' }}>
          <AlertCircle size={24} style={{ color: 'var(--error)' }} />
          <div>
            <strong>Failed to load Tender details</strong>
            <p style={{ marginTop: '0.4rem' }}>{errorMsg || 'Tender record not found or access denied.'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tenders-container">
      {/* Header Panel */}
      <div className="tenders-header">
        <div>
          <Link href="/tenders" className="logout-btn" style={{ textDecoration: 'none', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            <ArrowLeft size={14} /> Back to Tenders
          </Link>
          <h1 className="tenders-title" style={{ fontSize: '1.8rem' }}>{tender.title}</h1>
        </div>

        <Link href={`/tenders/${tender.id}/edit`} className="action-btn btn-primary" style={{ textDecoration: 'none' }}>
          <Edit size={16} />
          <span>Edit Tender</span>
        </Link>
      </div>

      {/* Main Grid: Details on Left, Meta/Status on Right */}
      <div className="detail-grid">
        
        {/* Left Side: Tender Contents */}
        <div className="detail-main">
          
          {/* Section 1: Project Details */}
          <div className="detail-section-card">
            <h3 className="detail-section-title">
              <Layers size={18} style={{ color: 'var(--secondary)' }} />
              Project Information
            </h3>
            
            <div className="specs-meta-grid">
              <div className="specs-meta-item">
                <div className="specs-meta-label">Project Name</div>
                <div className="specs-meta-val">{tender.project_name}</div>
              </div>
              <div className="specs-meta-item">
                <div className="specs-meta-label">Client / Agency</div>
                <div className="specs-meta-val">{tender.client_name}</div>
              </div>
              <div className="specs-meta-item">
                <div className="specs-meta-label">Location</div>
                <div className="specs-meta-val">{tender.location}</div>
              </div>
              <div className="specs-meta-item">
                <div className="specs-meta-label">Budget allocation</div>
                <div className="specs-meta-val" style={{ color: 'var(--success)' }}>
                  {tender.budget ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tender.budget) : 'Unspecified'}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Scope of work */}
          <div className="detail-section-card">
            <h3 className="detail-section-title">
              <FileText size={18} style={{ color: 'var(--accent)' }} />
              Scope of Work
            </h3>
            <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '1.2rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              {renderScopeOfWork(tender.scope_of_work)}
            </div>
          </div>

          {/* Section 3: Technical Specifications */}
          <div className="detail-section-card">
            <h3 className="detail-section-title">
              <Settings size={18} style={{ color: 'var(--primary)' }} />
              Technical Specifications
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="specs-meta-grid">
                <div className="specs-meta-item">
                  <div className="specs-meta-label">Discipline / Branch</div>
                  <div className="specs-meta-val">{tender.tech_discipline || 'Electrical'}</div>
                </div>
                <div className="specs-meta-item">
                  <div className="specs-meta-label">Design Standards</div>
                  <div className="specs-meta-val">{tender.tech_standards || 'IEC / ISO default'}</div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Equipment & Components Required
                </h4>
                <div className="detail-text-block" style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  {tender.tech_equipment_list || 'No equipment guidelines defined.'}
                </div>
              </div>

              {tender.tech_notes && (
                <div>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Technical Notes
                  </h4>
                  <div className="detail-text-block" style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    {tender.tech_notes}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Client Requirements */}
          <div className="detail-section-card">
            <h3 className="detail-section-title">
              <User size={18} style={{ color: 'var(--secondary)' }} />
              Client Requisitions & Compliance
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div className="specs-meta-grid">
                <div className="specs-meta-item">
                  <div className="specs-meta-label">Federal Regulations & Compliance</div>
                  <div className="specs-meta-val">{tender.client_compliance || 'Standard corporate compliance'}</div>
                </div>
                <div className="specs-meta-item">
                  <div className="specs-meta-label">Warranty Requisites</div>
                  <div className="specs-meta-val">{tender.client_warranty || '12 Months SLA'}</div>
                </div>
              </div>

              {tender.client_delivery_expectations && (
                <div>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Delivery & Deployment Expectations
                  </h4>
                  <p className="detail-text-block" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {tender.client_delivery_expectations}
                  </p>
                </div>
              )}

              {tender.client_special_requests && (
                <div>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Special Bid Requests
                  </h4>
                  <p className="detail-text-block" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {tender.client_special_requests}
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Side: Side panels */}
        <div className="detail-sidebar">
          
          {/* Status & Deadline Card */}
          <div className="detail-section-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <h3 className="detail-section-title" style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              Bid Status & Deadline
            </h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="specs-meta-label" style={{ fontSize: '0.85rem' }}>Current Status</span>
              <span className={`status-badge ${getStatusClass(tender.status)}`} style={{ fontSize: '0.8rem' }}>
                {tender.status}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="specs-meta-label" style={{ fontSize: '0.85rem' }}>Deadline date</span>
              <span className="tender-deadline" style={{ fontSize: '0.9rem' }}>
                <Calendar size={14} /> {new Date(tender.deadline_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '1.2rem' }}>
              <form onSubmit={handleStatusChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Transition Status</label>
                <select 
                  className="filter-select"
                  style={{ width: '100%', padding: '0.6rem 2rem 0.6rem 0.8rem', fontSize: '0.85rem' }}
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as any)}
                  disabled={isUpdatingStatus}
                >
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Completed">Completed</option>
                </select>

                <textarea 
                  className="form-textarea" 
                  style={{ minHeight: '60px', fontSize: '0.85rem', padding: '0.6rem' }}
                  placeholder="Optional log comments..."
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  disabled={isUpdatingStatus}
                />

                <button 
                  type="submit" 
                  className="action-btn btn-primary"
                  style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}
                  disabled={isUpdatingStatus || selectedStatus === tender.status}
                >
                  Update Status
                </button>
              </form>
            </div>
          </div>

          {/* BOQ Management Card */}
          <div className="detail-section-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <h3 className="detail-section-title" style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              Bill of Quantities (BOQ)
            </h3>
            
            {tender.status !== 'Approved' && tender.status !== 'Completed' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem', padding: '1.2rem 0.5rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px', textAlign: 'center' }}>
                <Lock size={28} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  BOQ will be available after tender approval
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span className="specs-meta-label">BOQ Status</span>
                  {boq ? (
                    <span className="status-badge" style={{ fontSize: '0.75rem', background: 'rgba(6, 182, 212, 0.1)', borderColor: 'rgba(6, 182, 212, 0.3)', color: 'var(--secondary)' }}>
                      {boq.status}
                    </span>
                  ) : (
                    <span className="status-badge status-draft" style={{ fontSize: '0.75rem' }}>
                      Not Created
                    </span>
                  )}
                </div>
                
                <Link 
                  href={`/tenders/${tender.id}/boq`}
                  className={`action-btn ${boq ? 'btn-accent' : 'btn-primary'}`}
                  style={{ textDecoration: 'none', padding: '0.6rem', fontSize: '0.85rem', width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <Unlock size={14} />
                  <span>{boq ? 'Manage BOQ Costing' : 'Create BOQ Costing'}</span>
                </Link>
              </div>
            )}
          </div>

          {/* Documents Attachment Card */}
          <div className="detail-section-card">
            <h3 className="detail-section-title" style={{ fontSize: '1.1rem' }}>
              Tender Documents
            </h3>

            {documents.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                No specification files attached to this tender.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {documents.map((doc) => (
                  <div 
                    key={doc.id}
                    className="file-item"
                    style={{ background: 'rgba(0,0,0,0.15)', padding: '0.6rem 0.8rem' }}
                  >
                    <div className="file-info" style={{ gap: '0.6rem' }}>
                      <FileText size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      <div className="file-name" style={{ fontSize: '0.8rem' }} title={doc.file_name}>
                        {doc.file_name}
                      </div>
                    </div>
                    
                    <a 
                      href="#"
                      className="file-action-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        alert(`Starting mock download of document: ${doc.file_name}`);
                      }}
                    >
                      <Download size={14} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status History Timeline */}
          <div className="detail-section-card">
            <h3 className="detail-section-title" style={{ fontSize: '1.1rem' }}>
              Status History Log
            </h3>
            
            <div className="timeline">
              {tender.status_history && tender.status_history.length > 0 ? (
                tender.status_history.map((log, index) => (
                  <div key={index} className="timeline-item">
                    <div className={`timeline-dot ${index === 0 ? 'active' : ''}`}></div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="timeline-status" style={{ color: index === 0 ? 'var(--secondary)' : 'var(--text-primary)' }}>
                          {log.status}
                        </span>
                        <span className="timeline-date">
                          {new Date(log.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="timeline-user">Updated by: {log.updated_by}</div>
                      {log.note && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem', fontStyle: 'italic' }}>"{log.note}"</p>}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <Clock size={14} />
                  <span>No transitions logged yet.</span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
