'use client';

import { useState, useEffect, useRef } from 'react';
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
  DollarSign,
  Play
} from 'lucide-react';
import '@/app/tenders/tenders.css';

type ScopeBullet = {
  id: string;
  text: string;
};

export default function CreateTender() {
  const router = useRouter();
  
  // Navigation tabs: 'project', 'scope', 'technical', 'client', 'documents'
  const [activeTab, setActiveTab] = useState<'project' | 'scope' | 'technical' | 'client' | 'documents'>('project');
  
  // Status is Draft by default
  const [status, setStatus] = useState<'Draft' | 'Submitted'>('Draft');
  
  // Loading & notification states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAutosaveToast, setShowAutosaveToast] = useState(false);

  // Form Field States
  // 1. Project Details
  const [title, setTitle] = useState('');
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [location, setLocation] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [budget, setBudget] = useState('');

  // 2. Scope of work
  const [scopeText, setScopeText] = useState('');
  const [scopeBullets, setScopeBullets] = useState<ScopeBullet[]>([
    { id: '1', text: 'Define execution phases and timelines.' },
    { id: '2', text: 'Provide all labor, materials, tools, and technical supervision.' }
  ]);
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
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: number; type: string; file: File }[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Extraction Simulation Console states
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionLogs, setExtractionLogs] = useState<string[]>([]);
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Form Validation Errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // 1. Load Draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('erp_tender_draft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        setTitle(draft.title || '');
        setProjectName(draft.projectName || '');
        setClientName(draft.clientName || '');
        setLocation(draft.location || '');
        setDeadlineDate(draft.deadlineDate || '');
        setBudget(draft.budget || '');
        setScopeText(draft.scopeText || '');
        if (draft.scopeBullets && draft.scopeBullets.length > 0) {
          setScopeBullets(draft.scopeBullets);
        }
        setTechDiscipline(draft.techDiscipline || 'Electrical');
        setTechEquipmentList(draft.techEquipmentList || '');
        setTechStandards(draft.techStandards || '');
        setTechNotes(draft.techNotes || '');
        setClientSpecialRequests(draft.clientSpecialRequests || '');
        setClientCompliance(draft.clientCompliance || '');
        setClientDeliveryExpectations(draft.clientDeliveryExpectations || '');
        setClientWarranty(draft.clientWarranty || '');
      } catch (e) {
        console.error('Error loading tender draft:', e);
      }
    }
  }, []);

  // 2. Local Storage Auto-save on change
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const draftData = {
      title,
      projectName,
      clientName,
      location,
      deadlineDate,
      budget,
      scopeText,
      scopeBullets,
      techDiscipline,
      techEquipmentList,
      techStandards,
      techNotes,
      clientSpecialRequests,
      clientCompliance,
      clientDeliveryExpectations,
      clientWarranty
    };

    const delayDebounce = setTimeout(() => {
      localStorage.setItem('erp_tender_draft', JSON.stringify(draftData));
      setShowAutosaveToast(true);
      setTimeout(() => setShowAutosaveToast(false), 2000);
    }, 1000); // 1s debounce

    return () => clearTimeout(delayDebounce);
  }, [
    title, projectName, clientName, location, deadlineDate, budget,
    scopeText, scopeBullets, techDiscipline, techEquipmentList,
    techStandards, techNotes, clientSpecialRequests, clientCompliance,
    clientDeliveryExpectations, clientWarranty
  ]);

  // Scroll terminal logs to bottom
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [extractionLogs]);

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
    // Validate current tab before moving forward
    if (validateSection(activeTab) || activeTab === 'documents') {
      setActiveTab(targetTab);
    }
  };

  // Bullet list builders
  const addBulletPoint = () => {
    if (newBullet.trim()) {
      setScopeBullets([...scopeBullets, { id: Date.now().toString(), text: newBullet.trim() }]);
      setNewBullet('');
    }
  };

  const removeBulletPoint = (id: string) => {
    setScopeBullets(scopeBullets.filter(b => b.id !== id));
  };

  // Mock File Uploads
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
      setUploadedFiles([...uploadedFiles, ...files]);
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
      setUploadedFiles([...uploadedFiles, ...files]);
    }
  };

  const deleteFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  // AI Document Extraction Simulator
  const startDocumentExtraction = () => {
    setIsExtracting(true);
    setExtractionLogs([]);
    setExtractedData(null);

    const logs = [
      '[INFO] Initializing OCR text scanning & parser engine...',
      '[SCANNING] Checking structure of uploaded drawings & specifications...',
      '[ANALYZING] PDF header tags found. Extracting client details...',
      '[EXTRACTED] Client: Dubai Electricity & Water Authority (DEWA)',
      '[EXTRACTED] Project Title: DEWA 132kV Substation Expansion Project',
      '[ANALYZING] Parsing engineering specifications & notes...',
      '[EXTRACTED] Discipline: Electrical / Infrastructure',
      '[EXTRACTED] Equipment requirement: 132kV Gas Insulated Switchgear, 50MVA Transformers, SCADA Panels',
      '[EXTRACTED] Standard specs: IEC 62271-203, IEC 60076, ISO 9001:2015',
      '[ANALYZING] Searching for Scope items...',
      '[EXTRACTED] Scope bullets compiled (4 key items found).',
      '[ANALYZING] Extracting client delivery and warranty requisites...',
      '[EXTRACTED] Delivery expected: 12 Months from mobilize date.',
      '[EXTRACTED] Warranty criteria: 24 Months defect liability period.',
      '[SUCCESS] All parameters parsed successfully. Click "Apply Details" to pre-fill.'
    ];

    let logIndex = 0;
    const interval = setInterval(() => {
      if (logIndex < logs.length) {
        setExtractionLogs(prev => [...prev, logs[logIndex]]);
        logIndex++;
      } else {
        clearInterval(interval);
        setIsExtracting(false);
        setExtractedData({
          title: 'DEWA 132kV Substation Expansion',
          projectName: '132kV Substation Expansion Project',
          clientName: 'DEWA',
          location: 'Jebel Ali, Sector 3, Dubai',
          deadlineDate: '2026-10-15',
          budget: '4500000',
          scopeText: 'Provide comprehensive turnkey engineering, procurement, and construction (EPC) for the extension of the existing 132kV Jebel Ali Substation.',
          scopeBullets: [
            { id: 'ext-1', text: 'Installation and testing of 132kV Gas Insulated Switchgear (GIS).' },
            { id: 'ext-2', text: 'Supply, assembly, and Commissioning of 2x 50MVA Power Transformers.' },
            { id: 'ext-3', text: 'Integration of local SCADA panel telemetry into the central DEWA Control room.' },
            { id: 'ext-4', text: 'Laying of 400sqmm XLPE high-voltage transmission cables.' }
          ],
          techDiscipline: 'Electrical',
          techEquipmentList: '132kV Gas Insulated Switchgear, 50MVA Power Transformers, SCADA Telemetry panels, 400sqmm HV Cable rolls',
          techStandards: 'IEC 62271-203, IEC 60076, ISO 9001:2015',
          techNotes: 'Equipment must withstand ambient temperature conditions up to 50°C and high humidity.',
          clientSpecialRequests: 'Requires SCADA systems compatible with ABB Network Manager.',
          clientCompliance: 'Full compliance with DEWA specifications and UAE federal environmental regulations.',
          clientDeliveryExpectations: 'Delivery and commissioning completed within 12 months from mobilization date.',
          clientWarranty: '24 Months defect liability warranty supported by local bank guarantees.'
        });
      }
    }, 250);
  };

  const applyExtractedDetails = () => {
    if (!extractedData) return;
    setTitle(extractedData.title);
    setProjectName(extractedData.projectName);
    setClientName(extractedData.clientName);
    setLocation(extractedData.location);
    setDeadlineDate(extractedData.deadlineDate);
    setBudget(extractedData.budget);
    setScopeText(extractedData.scopeText);
    setScopeBullets(extractedData.scopeBullets);
    setTechDiscipline(extractedData.techDiscipline);
    setTechEquipmentList(extractedData.techEquipmentList);
    setTechStandards(extractedData.techStandards);
    setTechNotes(extractedData.techNotes);
    setClientSpecialRequests(extractedData.clientSpecialRequests);
    setClientCompliance(extractedData.clientCompliance);
    setClientDeliveryExpectations(extractedData.clientDeliveryExpectations);
    setClientWarranty(extractedData.clientWarranty);
    
    // Switch to first page to see the extracted results
    setActiveTab('project');
    setExtractedData(null);
    setExtractionLogs([]);
  };

  // Form Submit Handler
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
      // 1. Fetch current logged-in user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Not authenticated. Please sign in again.');
      }

      // Compile scope of work
      const bulletPointsStr = scopeBullets.map(b => b.text).filter(t => t.trim()).join('\n');
      const compiledScope = scopeText.trim() 
        ? `${scopeText}\n\nKey Scope Items:\n${bulletPointsStr}`
        : `Key Scope Items:\n${bulletPointsStr}`;

      const tenderData = {
        created_by: user.id,
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
        status_history: [
          {
            status: status,
            updated_at: new Date().toISOString(),
            updated_by: user.email || 'ERP User',
            note: 'Tender created and initial status set.'
          }
        ]
      };

      // Save to Supabase
      const { data: insertedTender, error: insertError } = await supabase
        .from('tenders')
        .insert(tenderData)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Upload attachments to Supabase Storage and link metadata
      if (uploadedFiles.length > 0 && insertedTender) {
        const failedUploads: string[] = [];

        for (const f of uploadedFiles) {
          const storagePath = `TENDER/${insertedTender.id}/${Date.now()}_${f.name}`;
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
              tender_id: insertedTender.id,
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
          alert(`Tender saved, but ${failedUploads.length} file(s) failed to upload: ${failedUploads.join(', ')}. You can re-attach them from the Edit page.`);
        }
      }

      // Clear draft localStorage on successful submit
      localStorage.removeItem('erp_tender_draft');

      setSubmitSuccess(true);
      setTimeout(() => {
        router.push('/tenders');
      }, 1500);

    } catch (err: any) {
      console.error('Submission failed:', err);
      setErrorMsg(err.message || 'An unexpected error occurred during saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="tenders-container">
      {/* Header */}
      <div className="tenders-header">
        <div>
          <Link href="/tenders" className="logout-btn" style={{ textDecoration: 'none', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <h1 className="tenders-title">Create New ERP Tender</h1>
        </div>

        {/* Submit Options */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <select 
            className="filter-select"
            style={{ padding: '0.6rem 2rem 0.6rem 1rem', fontSize: '0.85rem', minWidth: '130px' }}
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="Draft">Draft Mode</option>
            <option value="Submitted">Submit Directly</option>
          </select>

          <button 
            type="button" 
            className="action-btn btn-primary" 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Tender'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="db-warning-banner" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }}>
          <AlertCircle size={20} style={{ color: 'var(--error)' }} />
          <div>
            <strong>Saving Failed:</strong> {errorMsg}
          </div>
        </div>
      )}

      {submitSuccess && (
        <div className="db-warning-banner" style={{ border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.15)', color: '#a7f3d0' }}>
          <Check size={20} style={{ color: 'var(--success)' }} />
          <div>
            <strong>Success!</strong> Tender saved to database. Redirecting to workspace...
          </div>
        </div>
      )}

      {/* Main panel holding form steps */}
      <div className="tenders-panel" style={{ position: 'relative' }}>
        {/* Form tabs headers */}
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
            📌 Technical Details
          </button>
          
          <button 
            type="button" 
            className={`form-tab ${activeTab === 'client' ? 'active' : ''}`}
            onClick={() => handleTabChange('client')}
          >
            📌 Client Requirements
          </button>
          
          <button 
            type="button" 
            className={`form-tab ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => handleTabChange('documents')}
          >
            📌 Upload Documents
          </button>
        </div>

        {/* Tab 1: Project Details */}
        {activeTab === 'project' && (
          <div className="form-grid">
            <div className="form-group form-grid-full">
              <label className="form-label" htmlFor="title">
                Tender Title <span className="required-star">*</span>
              </label>
              <input 
                id="title"
                type="text" 
                className={`form-input ${errors.title ? 'input-invalid' : ''}`}
                placeholder="e.g. 132kV Substation Expansion EPC Contract"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {errors.title && <span className="validation-error">{errors.title}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="projectName">
                Project Name <span className="required-star">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Briefcase size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="projectName"
                  type="text" 
                  className={`form-input ${errors.projectName ? 'input-invalid' : ''}`}
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="e.g. Substation Expansion Project"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              {errors.projectName && <span className="validation-error">{errors.projectName}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="clientName">
                Client Name <span className="required-star">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="clientName"
                  type="text" 
                  className={`form-input ${errors.clientName ? 'input-invalid' : ''}`}
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="e.g. DEWA, Emaar, RTA"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>
              {errors.clientName && <span className="validation-error">{errors.clientName}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="location">
                Project Location <span className="required-star">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <MapPin size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="location"
                  type="text" 
                  className={`form-input ${errors.location ? 'input-invalid' : ''}`}
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="e.g. Jebel Ali, Sector 3, Dubai"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              {errors.location && <span className="validation-error">{errors.location}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="deadlineDate">
                Deadline Date <span className="required-star">*</span>
              </label>
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
              <label className="form-label" htmlFor="budget">
                Project Budget (Optional)
              </label>
              <div style={{ position: 'relative' }}>
                <DollarSign size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="budget"
                  type="number" 
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="e.g. 5000000 (Values in USD)"
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
              <label className="form-label" htmlFor="scopeText">
                Scope of Work Overview
              </label>
              <textarea 
                id="scopeText"
                className={`form-textarea ${errors.scopeText ? 'input-invalid' : ''}`}
                placeholder="Describe the overall scope, deliverables, and boundaries of the project..."
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

        {/* Tab 3: Technical Details */}
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
                placeholder="e.g. IEC 61850, ISO 9001, IEEE"
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
                placeholder="List major machinery, software assets, sensors or modules required (e.g. 50MVA Transformers, Cisco Catalyst Switch...)"
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
                placeholder="Input environmental conditions, special constraints or structural tolerances..."
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

        {/* Tab 4: Client Requirements */}
        {activeTab === 'client' && (
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="clientCompliance">Compliance & Regulations</label>
              <input 
                id="clientCompliance"
                type="text" 
                className="form-input" 
                placeholder="e.g. OHSAS 18001, Dubai Municipality Regulations"
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
                placeholder="e.g. 24 Months defect liability warranty"
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
                placeholder="Describe deadlines for delivery milestones, shipping terms or SLA expectations..."
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
                placeholder="Any special requests, client background notes or bidder conditions..."
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
                Next Step: Document Upload &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Tab 5: Document Upload & AI Extraction */}
        {activeTab === 'documents' && (
          <div className="document-section">
            <div className="dropzone-wrapper">
              
              {/* Dropzone side */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div 
                  className={`dropzone ${dragActive ? 'drag-active' : ''}`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  <UploadCloud size={48} style={{ color: 'var(--secondary)' }} />
                  <div className="dropzone-text">
                    Drag and drop your Tender Specifications file here, or{' '}
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
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Supports: PDF, AutoCAD Drawings (DWG), Revit (RVT), Word, Diagrams, JPEG/PNG
                  </p>
                </div>

                {uploadedFiles.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '0.8rem', fontFamily: 'var(--font-heading)' }}>
                      Selected Files ({uploadedFiles.length})
                    </h4>
                    <div className="uploaded-files-list">
                      {uploadedFiles.map((file, i) => (
                        <div key={i} className="file-item">
                          <div className="file-info">
                            <FileText size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                            <div className="file-name" title={file.name}>{file.name}</div>
                            <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <button 
                            type="button" 
                            className="file-action-btn file-delete-btn"
                            onClick={() => deleteFile(i)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Extraction terminal console side */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div className="extraction-console">
                  <div className="extraction-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Cpu size={14} />
                      <span>Tender AI Document Extractor</span>
                    </div>
                    <span className="status-badge status-review" style={{ fontSize: '0.65rem', padding: '0.1rem 0.5rem' }}>
                      Offline Parser
                    </span>
                  </div>

                  <div className="console-terminal">
                    {extractionLogs.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                        <Sparkles size={24} style={{ marginBottom: '0.5rem', color: 'var(--secondary)' }} />
                        <span>Ready to scan documents. Upload a spec sheet and click "Extract Details" to pre-fill.</span>
                      </div>
                    ) : (
                      <>
                        {extractionLogs.map((log, i) => (
                          <div key={i}>{log}</div>
                        ))}
                        {isExtracting && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', color: 'var(--secondary)' }}>
                            <span className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(6, 182, 212, 0.1)', borderTopColor: 'var(--secondary)' }}></span>
                            Scanning document parameters...
                          </div>
                        )}
                        <div ref={consoleEndRef} />
                      </>
                    )}
                  </div>
                  
                  {extractedData && (
                    <div className="terminal-success-badge animate-fade-in">
                      <div className="terminal-success-title">✓ Extraction Complete!</div>
                      <p className="terminal-success-desc">
                        Identified: <strong>{extractedData.title}</strong> for client <strong>{extractedData.clientName}</strong>. 
                        Click Apply below to automatically fill out this multi-step form!
                      </p>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    type="button" 
                    className="action-btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={startDocumentExtraction}
                    disabled={isExtracting || uploadedFiles.length === 0}
                  >
                    <Play size={16} /> Run Extractor
                  </button>

                  <button 
                    type="button" 
                    className="action-btn btn-accent"
                    style={{ flex: 1 }}
                    onClick={applyExtractedDetails}
                    disabled={!extractedData}
                  >
                    <Sparkles size={16} /> Apply Details
                  </button>
                </div>
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '1.5rem' }}>
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
                {isSubmitting ? 'Saving...' : 'Finish & Save Tender'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Auto-save Toast Notification */}
      {showAutosaveToast && (
        <div className="autosave-toast">
          <Check size={14} />
          <span>Draft autosaved in workspace</span>
        </div>
      )}
    </div>
  );
}
