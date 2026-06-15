'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  Briefcase, 
  Calendar, 
  MapPin, 
  User, 
  Plus, 
  ArrowLeft, 
  AlertCircle,
  UploadCloud,
  Check,
  Trash2,
  Cpu,
  Sparkles,
  FileText,
  DollarSign
} from 'lucide-react';
import '@/app/tenders/tenders.css';

type ScopeBullet = {
  id: string;
  text: string;
};

type StatusLog = {
  status: string;
  updated_at: string;
  updated_by: string;
  note: string;
};

type TenderDocument = {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  file_path?: string;
};

export default function EditTender({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const tenderId = resolvedParams.id;

  // Navigation tabs: 'project', 'scope', 'technical', 'client', 'documents'
  const [activeTab, setActiveTab] = useState<'project' | 'scope' | 'technical' | 'client' | 'documents'>('project');
  
  // Loading & Notification States
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Original tender status and history
  const [originalStatus, setOriginalStatus] = useState<'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Completed'>('Draft');
  const [statusHistory, setStatusHistory] = useState<StatusLog[]>([]);

  // Form Field States
  // 1. Project Details
  const [title, setTitle] = useState('');
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [location, setLocation] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [budget, setBudget] = useState('');
  const [status, setStatus] = useState<'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Completed'>('Draft');

  // 2. Scope of work
  const [scopeText, setScopeText] = useState('');
  const [scopeBullets, setScopeBullets] = useState<ScopeBullet[]>([]);
  const [newBullet, setNewBullet] = useState('');

  // 3. Technical Specs
  const [techDiscipline, setTechDiscipline] = useState('Electrical');
  const [techEquipmentList, setTechEquipmentList] = useState('');
  const [techStandards, setTechStandards] = useState('');
  const [techNotes, setTechNotes] = useState('');

  // 4. Client Requirements
  const [clientSpecialRequests, setClientSpecialRequests] = useState('');
  const [clientCompliance, setClientCompliance] = useState('');
  const [clientDeliveryExpectations, setClientDeliveryExpectations] = useState('');
  const [clientWarranty, setClientWarranty] = useState('');

  // 5. Document Upload
  const [existingFiles, setExistingFiles] = useState<TenderDocument[]>([]);
  const [newUploadedFiles, setNewUploadedFiles] = useState<{ name: string; size: number; type: string; file: File }[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Form Validation Errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Fetch existing tender details
  useEffect(() => {
    const fetchTender = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.replace('/signin');
          return;
        }

        const { data, error } = await supabase
          .from('tenders')
          .select('*')
          .eq('id', tenderId)
          .single();

        if (error) {
          throw error;
        }

        if (data) {
          setTitle(data.title || '');
          setProjectName(data.project_name || '');
          setClientName(data.client_name || '');
          setLocation(data.location || '');
          setDeadlineDate(data.deadline_date || '');
          setBudget(data.budget ? data.budget.toString() : '');
          setStatus(data.status || 'Draft');
          setOriginalStatus(data.status || 'Draft');
          setStatusHistory(data.status_history || []);
          
          setTechDiscipline(data.tech_discipline || 'Electrical');
          setTechEquipmentList(data.tech_equipment_list || '');
          setTechStandards(data.tech_standards || '');
          setTechNotes(data.tech_notes || '');

          setClientSpecialRequests(data.client_special_requests || '');
          setClientCompliance(data.client_compliance || '');
          setClientDeliveryExpectations(data.client_delivery_expectations || '');
          setClientWarranty(data.client_warranty || '');

          // Process Scope of Work
          const scopeRaw = data.scope_of_work || '';
          if (scopeRaw.includes('Key Scope Items:')) {
            const parts = scopeRaw.split('Key Scope Items:');
            setScopeText(parts[0].trim());
            
            // Extract bullets
            const bulletLines = parts[1].split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
            const bulletsObj = bulletLines.map((line: string, idx: number) => {
              // Strip leading symbol if any
              const clean = line.replace(/^[-•*]\s*/, '');
              return { id: idx.toString(), text: clean };
            });
            setScopeBullets(bulletsObj);
          } else {
            setScopeText(scopeRaw);
            setScopeBullets([]);
          }
        }

        // Fetch documents
        const { data: docData, error: docError } = await supabase
          .from('tender_documents')
          .select('id, file_name, file_size, file_type, file_path')
          .eq('tender_id', tenderId);

        if (docError) {
          console.warn('Could not load documents:', docError);
        } else {
          setExistingFiles(docData as TenderDocument[] || []);
        }

      } catch (err: any) {
        console.error('Failed to load tender:', err);
        setErrorMsg(err.message || 'Error loading tender details.');
      } finally {
        setLoading(false);
      }
    };

    fetchTender();
  }, [tenderId, router]);

  // Validation functions
  const validateSection = (section: typeof activeTab) => {
    const newErrors: { [key: string]: string } = {};

    if (section === 'project') {
      if (!title.trim()) newErrors.title = 'Tender Title is required.';
      if (!projectName.trim()) newErrors.projectName = 'Project Name is required.';
      if (!clientName.trim()) newErrors.clientName = 'Client Name is required.';
      if (!location.trim()) newErrors.location = 'Project Location is required.';
      if (!deadlineDate) newErrors.deadlineDate = 'Deadline date is required.';
    }

    if (section === 'scope') {
      if (!scopeText.trim() && scopeBullets.every(b => !b.text.trim())) {
        newErrors.scopeText = 'Please provide a Scope of Work description or at least one bullet point.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTabChange = (targetTab: typeof activeTab) => {
    if (validateSection(activeTab) || activeTab === 'documents') {
      setActiveTab(targetTab);
    }
  };

  // Bullet builders
  const addBulletPoint = () => {
    if (newBullet.trim()) {
      setScopeBullets([...scopeBullets, { id: Date.now().toString(), text: newBullet.trim() }]);
      setNewBullet('');
    }
  };

  const removeBulletPoint = (id: string) => {
    setScopeBullets(scopeBullets.filter(b => b.id !== id));
  };

  // Drag and drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files).map(f => ({
        name: f.name,
        size: f.size,
        type: f.name.split('.').pop() || 'unknown',
        file: f
      }));
      setNewUploadedFiles([...newUploadedFiles, ...files]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const files = Array.from(e.target.files).map(f => ({
        name: f.name,
        size: f.size,
        type: f.name.split('.').pop() || 'unknown',
        file: f
      }));
      setNewUploadedFiles([...newUploadedFiles, ...files]);
    }
  };

  const deleteNewFile = (index: number) => {
    setNewUploadedFiles(newUploadedFiles.filter((_, i) => i !== index));
  };

  const deleteExistingFile = async (docId: string) => {
    if (confirm('Are you sure you want to delete this document from the database?')) {
      try {
        // Best-effort removal of the stored file (legacy rows may have no real file)
        const doc = existingFiles.find(d => d.id === docId);
        if (doc?.file_path) {
          await supabase.storage.from('tender-documents').remove([doc.file_path]).catch(() => {});
        }

        const { error } = await supabase
          .from('tender_documents')
          .delete()
          .eq('id', docId);

        if (error) throw error;
        setExistingFiles(existingFiles.filter(d => d.id !== docId));
      } catch (err: any) {
        alert(`Failed to delete document: ${err.message}`);
      }
    }
  };

  // Submit edits
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validate all sections
    const tabs: Array<typeof activeTab> = ['project', 'scope', 'technical', 'client'];
    let hasError = false;
    for (const tab of tabs) {
      if (!validateSection(tab)) {
        setActiveTab(tab);
        hasError = true;
        break;
      }
    }

    if (hasError) return;

    setIsSubmitting(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Not authenticated.');
      }

      // Compile scope
      const bulletPointsStr = scopeBullets.map(b => b.text).filter(t => t.trim()).join('\n');
      const compiledScope = scopeText.trim() 
        ? `${scopeText}\n\nKey Scope Items:\n${bulletPointsStr}`
        : `Key Scope Items:\n${bulletPointsStr}`;

      // Calculate status history log if status has changed or if it is updated in general
      let finalHistory = statusHistory;
      if (status !== originalStatus) {
        const newHistoryLog: StatusLog = {
          status: status,
          updated_at: new Date().toISOString(),
          updated_by: user.email || 'ERP Staff',
          note: `Status updated from ${originalStatus} to ${status} via revisions form.`
        };
        finalHistory = [newHistoryLog, ...statusHistory];
      } else {
        const newHistoryLog: StatusLog = {
          status: status,
          updated_at: new Date().toISOString(),
          updated_by: user.email || 'ERP Staff',
          note: `Tender details revised.`
        };
        finalHistory = [newHistoryLog, ...statusHistory];
      }

      const tenderData = {
        title,
        project_name: projectName,
        client_name: clientName,
        location,
        deadline_date: deadlineDate,
        budget: budget ? parseFloat(budget) : null,
        status: status,
        scope_of_work: compiledScope,
        tech_discipline: techDiscipline,
        tech_equipment_list: techEquipmentList,
        tech_standards: techStandards,
        tech_notes: techNotes,
        client_special_requests: clientSpecialRequests,
        client_compliance: clientCompliance,
        client_delivery_expectations: clientDeliveryExpectations,
        client_warranty: clientWarranty,
        status_history: finalHistory,
        updated_at: new Date().toISOString()
      };

      // Save to Supabase
      const { error: updateError } = await supabase
        .from('tenders')
        .update(tenderData)
        .eq('id', tenderId);

      if (updateError) {
        throw updateError;
      }

      // Upload new attachments to Supabase Storage and link metadata
      if (newUploadedFiles.length > 0) {
        const failedUploads: string[] = [];

        for (const f of newUploadedFiles) {
          const storagePath = `TENDER/${tenderId}/${Date.now()}_${f.name}`;
          const { error: uploadError } = await supabase.storage
            .from('tender-documents')
            .upload(storagePath, f.file, { cacheControl: '3600', upsert: true });

          if (uploadError) {
            console.error(`Storage upload failed for ${f.name}:`, uploadError);
            failedUploads.push(f.name);
            continue;
          }

          const { error: fileError } = await supabase
            .from('tender_documents')
            .insert({
              tender_id: tenderId,
              file_name: f.name,
              file_path: storagePath,
              file_size: f.size,
              file_type: f.type,
              uploaded_by: user.id
            });

          if (fileError) {
            console.error(`Metadata insert failed for ${f.name}:`, fileError);
            failedUploads.push(f.name);
          }
        }

        if (failedUploads.length > 0) {
          alert(`Changes saved, but ${failedUploads.length} file(s) failed to upload: ${failedUploads.join(', ')}.`);
        }
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        router.push(`/tenders/${tenderId}`);
      }, 1200);

    } catch (err: any) {
      console.error('Update failed:', err);
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner"></div>
        <p style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-secondary)' }}>Loading Tender Revision Workbench...</p>
      </div>
    );
  }

  return (
    <div className="tenders-container">
      {/* Header */}
      <div className="tenders-header">
        <div>
          <Link href={`/tenders/${tenderId}`} className="logout-btn" style={{ textDecoration: 'none', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            <ArrowLeft size={14} /> Back to Details
          </Link>
          <h1 className="tenders-title" style={{ fontSize: '1.8rem' }}>Edit Tender: {title}</h1>
        </div>

        {/* Submit Options */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <select 
            className="filter-select"
            style={{ padding: '0.6rem 2rem 0.6rem 1rem', fontSize: '0.85rem', minWidth: '150px' }}
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="Draft">Draft</option>
            <option value="Submitted">Submitted</option>
            <option value="Under Review">Under Review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Completed">Completed</option>
          </select>

          <button 
            type="button" 
            className="action-btn btn-primary" 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Updates'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="db-warning-banner" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }}>
          <AlertCircle size={20} style={{ color: 'var(--error)' }} />
          <div>
            <strong>Update Failed:</strong> {errorMsg}
          </div>
        </div>
      )}

      {submitSuccess && (
        <div className="db-warning-banner" style={{ border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.15)', color: '#a7f3d0' }}>
          <Check size={20} style={{ color: 'var(--success)' }} />
          <div>
            <strong>Success!</strong> Tender revisions saved. Redirecting to workspace...
          </div>
        </div>
      )}

      {/* Form step panel */}
      <div className="tenders-panel">
        <div className="form-tabs">
          <button 
            type="button" 
            className={`form-tab ${activeTab === 'project' ? 'active' : ''}`}
            onClick={() => handleTabChange('project')}
          >
            📌 Project Details {errors.title || errors.projectName || errors.clientName || errors.location || errors.deadlineDate ? '⚠️' : ''}
          </button>
          
          <button 
            type="button" 
            className={`form-tab ${activeTab === 'scope' ? 'active' : ''}`}
            onClick={() => handleTabChange('scope')}
          >
            📌 Scope of Work {errors.scopeText ? '⚠️' : ''}
          </button>
          
          <button 
            type="button" 
            className={`form-tab ${activeTab === 'technical' ? 'active' : ''}`}
            onClick={() => handleTabChange('technical')}
          >
            📌 Technical Specs
          </button>
          
          <button 
            type="button" 
            className={`form-tab ${activeTab === 'client' ? 'active' : ''}`}
            onClick={() => handleTabChange('client')}
          >
            📌 Client Reqs
          </button>
          
          <button 
            type="button" 
            className={`form-tab ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => handleTabChange('documents')}
          >
            📌 Documents ({existingFiles.length + newUploadedFiles.length})
          </button>
        </div>

        {/* Tab 1: Project Details */}
        {activeTab === 'project' && (
          <div className="form-grid">
            <div className="form-group form-grid-full">
              <label className="form-label" htmlFor="title">Tender Title <span className="required-star">*</span></label>
              <input 
                id="title"
                type="text" 
                className={`form-input ${errors.title ? 'input-invalid' : ''}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {errors.title && <span className="validation-error">{errors.title}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="projectName">Project Name <span className="required-star">*</span></label>
              <div style={{ position: 'relative' }}>
                <Briefcase size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="projectName"
                  type="text" 
                  className={`form-input ${errors.projectName ? 'input-invalid' : ''}`}
                  style={{ paddingLeft: '2.5rem' }}
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              {errors.projectName && <span className="validation-error">{errors.projectName}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="clientName">Client Name <span className="required-star">*</span></label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="clientName"
                  type="text" 
                  className={`form-input ${errors.clientName ? 'input-invalid' : ''}`}
                  style={{ paddingLeft: '2.5rem' }}
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>
              {errors.clientName && <span className="validation-error">{errors.clientName}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="location">Project Location <span className="required-star">*</span></label>
              <div style={{ position: 'relative' }}>
                <MapPin size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="location"
                  type="text" 
                  className={`form-input ${errors.location ? 'input-invalid' : ''}`}
                  style={{ paddingLeft: '2.5rem' }}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              {errors.location && <span className="validation-error">{errors.location}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="deadlineDate">Deadline Date <span className="required-star">*</span></label>
              <div style={{ position: 'relative' }}>
                <Calendar size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="deadlineDate"
                  type="date" 
                  className={`form-input ${errors.deadlineDate ? 'input-invalid' : ''}`}
                  style={{ paddingLeft: '2.5rem' }}
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                />
              </div>
              {errors.deadlineDate && <span className="validation-error">{errors.deadlineDate}</span>}
            </div>

            <div className="form-group form-grid-full">
              <label className="form-label" htmlFor="budget">Project Budget (Optional)</label>
              <div style={{ position: 'relative' }}>
                <DollarSign size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="budget"
                  type="number" 
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>
            </div>
            
            <div className="form-grid-full" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button 
                type="button" 
                className="action-btn btn-primary"
                onClick={() => handleTabChange('scope')}
              >
                Next Step: Scope &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Scope of Work */}
        {activeTab === 'scope' && (
          <div className="form-grid">
            <div className="form-group form-grid-full">
              <label className="form-label" htmlFor="scopeText">Scope of Work Overview</label>
              <textarea 
                id="scopeText"
                className={`form-textarea ${errors.scopeText ? 'input-invalid' : ''}`}
                value={scopeText}
                onChange={(e) => setScopeText(e.target.value)}
              />
              {errors.scopeText && <span className="validation-error">{errors.scopeText}</span>}
            </div>

            <div className="form-group form-grid-full">
              <label className="form-label">Key Deliverables (Bullet Points)</label>
              
              <div className="bullet-list-builder">
                {scopeBullets.map((bullet) => (
                  <div key={bullet.id} className="bullet-item">
                    <div className="bullet-dot"></div>
                    <input 
                      type="text" 
                      className="form-input bullet-input"
                      value={bullet.text}
                      onChange={(e) => {
                        const updated = scopeBullets.map(b => b.id === bullet.id ? { ...b, text: e.target.value } : b);
                        setScopeBullets(updated);
                      }}
                    />
                    <button 
                      type="button" 
                      className="remove-bullet-btn"
                      onClick={() => removeBulletPoint(bullet.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                <div className="bullet-item" style={{ marginTop: '0.5rem' }}>
                  <div className="bullet-dot" style={{ background: 'var(--text-muted)' }}></div>
                  <input 
                    type="text" 
                    className="form-input bullet-input"
                    placeholder="Add a new deliverable point..."
                    value={newBullet}
                    onChange={(e) => setNewBullet(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addBulletPoint();
                      }
                    }}
                  />
                  <button 
                    type="button" 
                    className="action-btn btn-secondary" 
                    style={{ padding: '0.6rem 1rem', borderRadius: '12px' }}
                    onClick={addBulletPoint}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="form-grid-full" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
              <button 
                type="button" 
                className="action-btn btn-secondary"
                onClick={() => setActiveTab('project')}
              >
                &larr; Back
              </button>
              <button 
                type="button" 
                className="action-btn btn-primary"
                onClick={() => handleTabChange('technical')}
              >
                Next Step: Technical Specs &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Technical Specs */}
        {activeTab === 'technical' && (
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="techDiscipline">Technical Discipline</label>
              <select 
                id="techDiscipline"
                className="filter-select"
                style={{ width: '100%' }}
                value={techDiscipline}
                onChange={(e) => setTechDiscipline(e.target.value)}
              >
                <option value="Electrical">Electrical Spec</option>
                <option value="IT / Telecom">IT / Telecom Spec</option>
                <option value="Mechanical">Mechanical Spec</option>
                <option value="Civil / Structural">Civil / Structural Spec</option>
                <option value="Multi-Discipline">Multi-Discipline Spec</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="techStandards">Project Standards</label>
              <input 
                id="techStandards"
                type="text" 
                className="form-input" 
                value={techStandards}
                onChange={(e) => setTechStandards(e.target.value)}
              />
            </div>

            <div className="form-group form-grid-full">
              <label className="form-label" htmlFor="techEquipmentList">Key Equipment & Components</label>
              <textarea 
                id="techEquipmentList"
                className="form-textarea" 
                style={{ minHeight: '80px' }}
                value={techEquipmentList}
                onChange={(e) => setTechEquipmentList(e.target.value)}
              />
            </div>

            <div className="form-group form-grid-full">
              <label className="form-label" htmlFor="techNotes">Technical Notes</label>
              <textarea 
                id="techNotes"
                className="form-textarea" 
                style={{ minHeight: '80px' }}
                value={techNotes}
                onChange={(e) => setTechNotes(e.target.value)}
              />
            </div>

            <div className="form-grid-full" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
              <button 
                type="button" 
                className="action-btn btn-secondary"
                onClick={() => setActiveTab('scope')}
              >
                &larr; Back
              </button>
              <button 
                type="button" 
                className="action-btn btn-primary"
                onClick={() => handleTabChange('client')}
              >
                Next Step: Client Reqs &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Client Reqs */}
        {activeTab === 'client' && (
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="clientCompliance">Compliance & Regulations</label>
              <input 
                id="clientCompliance"
                type="text" 
                className="form-input" 
                value={clientCompliance}
                onChange={(e) => setClientCompliance(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="clientWarranty">Warranty Requirements</label>
              <input 
                id="clientWarranty"
                type="text" 
                className="form-input" 
                value={clientWarranty}
                onChange={(e) => setClientWarranty(e.target.value)}
              />
            </div>

            <div className="form-group form-grid-full">
              <label className="form-label" htmlFor="clientDeliveryExpectations">Delivery Expectations</label>
              <textarea 
                id="clientDeliveryExpectations"
                className="form-textarea"
                style={{ minHeight: '80px' }}
                value={clientDeliveryExpectations}
                onChange={(e) => setClientDeliveryExpectations(e.target.value)}
              />
            </div>

            <div className="form-group form-grid-full">
              <label className="form-label" htmlFor="clientSpecialRequests">Special Requests / Notes</label>
              <textarea 
                id="clientSpecialRequests"
                className="form-textarea"
                style={{ minHeight: '80px' }}
                value={clientSpecialRequests}
                onChange={(e) => setClientSpecialRequests(e.target.value)}
              />
            </div>

            <div className="form-grid-full" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
              <button 
                type="button" 
                className="action-btn btn-secondary"
                onClick={() => setActiveTab('technical')}
              >
                &larr; Back
              </button>
              <button 
                type="button" 
                className="action-btn btn-primary"
                onClick={() => handleTabChange('documents')}
              >
                Next Step: File attachments &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Tab 5: Documents revision */}
        {activeTab === 'documents' && (
          <div className="document-section">
            
            {/* Existing Documents listing */}
            {existingFiles.length > 0 && (
              <div style={{ background: 'rgba(0,0,0,0.1)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>
                  Active Tender Documents
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {existingFiles.map((file) => (
                    <div key={file.id} className="file-item">
                      <div className="file-info">
                        <FileText size={16} style={{ color: 'var(--primary)' }} />
                        <div className="file-name">{file.file_name}</div>
                        <span className="file-size">({(file.file_size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button 
                        type="button" 
                        className="file-action-btn file-delete-btn"
                        onClick={() => deleteExistingFile(file.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dropzone for new uploads */}
            <div className="dropzone-wrapper" style={{ gridTemplateColumns: '1fr' }}>
              <div 
                className={`dropzone ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                <UploadCloud size={40} style={{ color: 'var(--secondary)' }} />
                <div className="dropzone-text">
                  Drag and drop additional documents here, or{' '}
                  <label style={{ display: 'inline' }}>
                    <span className="dropzone-highlight">browse files</span>
                    <input 
                      type="file" 
                      multiple 
                      style={{ display: 'none' }} 
                      onChange={handleFileInput}
                    />
                  </label>
                </div>
              </div>

              {newUploadedFiles.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.8rem', fontFamily: 'var(--font-heading)' }}>
                    New Files to Attach ({newUploadedFiles.length})
                  </h4>
                  <div className="uploaded-files-list">
                    {newUploadedFiles.map((file, i) => (
                      <div key={i} className="file-item">
                        <div className="file-info">
                          <Plus size={14} style={{ color: 'var(--success)' }} />
                          <div className="file-name" title={file.name}>{file.name}</div>
                          <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <button 
                          type="button" 
                          className="file-action-btn file-delete-btn"
                          onClick={() => deleteNewFile(i)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', borderTop: '1px solid var(--surface-hover)', paddingTop: '1.5rem' }}>
              <button 
                type="button" 
                className="action-btn btn-secondary"
                onClick={() => setActiveTab('client')}
              >
                &larr; Back
              </button>
              
              <button 
                type="button" 
                className="action-btn btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Finish & Save Updates'}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
