// ============================================================
// JEET ERP — Document Management System (DMS) Hub Registry
// Route: /documents
// Collapsible sidebar tree, list table, file filters, and upload modal
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  FolderClosed, 
  Search, 
  RefreshCw, 
  Upload, 
  CheckSquare, 
  AlertOctagon, 
  ShieldAlert, 
  FileText 
} from 'lucide-react';
import { useDocuments } from '@/hooks/useDocuments';
import { CategoryTree } from '@/components/documents/CategoryTree';
import { DocumentTable } from '@/components/documents/DocumentTable';
import { DocumentDetailDrawer } from '@/components/documents/DocumentDetailDrawer';
import { DocumentUploadZone } from '@/components/documents/DocumentUploadZone';
import type { DocumentEntityType, DocumentStatus } from '@/types/document.types';

export default function DocumentsHubPage() {
  const [activeCategory, setActiveCategory] = useState('');
  const [activeSubcategory, setActiveSubcategory] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Global filters
  const [filters, setFilters] = useState<any>({
    entity_type: '',
    status: '',
    search: '',
    is_confidential: undefined
  });

  // Target Entity selection during upload
  const [uploadEntityType, setUploadEntityType] = useState<DocumentEntityType>('COMPANY');
  const [uploadEntityId, setUploadEntityId] = useState('');
  const [projectsList, setProjectsList] = useState<any[]>([]);

  // Hook details
  const activeFilters = {
    ...filters,
    category: activeCategory || undefined,
    subcategory: activeSubcategory || undefined
  };

  const { documents, loading, error, refetch } = useDocuments(activeFilters);

  // Counters for KPIs
  const [kpis, setKpis] = useState({
    totalDocs: 0,
    reviewQueue: 0,
    expiringSoon: 0,
    processedToday: 0
  });

  // Load KPI metrics and projects for upload selector
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        // Fetch projects
        const { data: proj } = await supabase.from('projects').select('id, name').eq('is_active', true);
        setProjectsList(proj || []);

        // Total documents
        const { count: totCount } = await supabase.from('documents').select('*', { count: 'exact', head: true }).eq('is_active', true);
        
        // Needs Review
        const { count: revCount } = await supabase.from('documents').select('*', { count: 'exact', head: true }).eq('status', 'NEEDS_REVIEW').eq('is_active', true);

        // Expiring 30 days
        const thirtyDays = new Date();
        thirtyDays.setDate(thirtyDays.getDate() + 30);
        const { count: expCount } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .lte('expiry_date', thirtyDays.toISOString().split('T')[0])
          .gte('expiry_date', new Date().toISOString().split('T')[0]);

        setKpis({
          totalDocs: totCount || 0,
          reviewQueue: revCount || 0,
          expiringSoon: expCount || 0,
          processedToday: 0 // Simulated
        });
      } catch (err) {
        console.error('Error fetching DMS stats:', err);
      }
    };

    loadMetadata();
  }, [documents]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev: any) => ({ 
      ...prev, 
      [name]: value === '' ? '' : value === 'true' ? true : value === 'false' ? false : value 
    }));
  };

  const handleSelectCategory = (cat: string, sub: string) => {
    setActiveCategory(cat);
    setActiveSubcategory(sub);
  };

  const handleSelectDoc = (doc: any) => {
    setSelectedDocId(doc.id);
    setIsDrawerOpen(true);
  };

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <h1 className="quote-header-title">Document Management Hub</h1>
          <p className="quote-header-subtitle">AI-Powered DMS Registry with auto classification & compliance alerts</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <Link href="/documents/review" className="quote-btn quote-btn-secondary" style={{ textDecoration: 'none', background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>
            <CheckSquare size={16} /> Review Queue ({kpis.reviewQueue})
          </Link>
          <Link href="/documents/expiry" className="quote-btn quote-btn-secondary" style={{ textDecoration: 'none', background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>
            <AlertOctagon size={16} /> Expiry Dashboard ({kpis.expiringSoon})
          </Link>
          <button className="quote-btn quote-btn-primary" onClick={() => setShowUploadModal(true)}>
            <Upload size={16} /> File Ingest
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="quote-card" style={{ margin: 0, padding: '1.2rem', borderLeft: '4px solid var(--secondary)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Archive</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', marginTop: '0.3rem' }}>{kpis.totalDocs} files</div>
        </div>
        <div className="quote-card" style={{ margin: 0, padding: '1.2rem', borderLeft: '4px solid var(--warning)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Awaiting Review</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.3rem' }}>{kpis.reviewQueue} files</div>
        </div>
        <div className="quote-card" style={{ margin: 0, padding: '1.2rem', borderLeft: '4px solid var(--error)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Expiring 30 Days</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fca5a5', marginTop: '0.3rem' }}>{kpis.expiringSoon} files</div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="quote-card">
        <div className="quote-filters-bar" style={{ marginBottom: 0 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              name="search"
              className="quote-filter-input"
              placeholder="Search documents, text content, references..."
              style={{ paddingLeft: '2.2rem', width: '100%' }}
              value={filters.search}
              onChange={handleFilterChange}
            />
          </div>

          <select
            name="entity_type"
            className="quote-filter-input"
            value={filters.entity_type}
            onChange={handleFilterChange}
          >
            <option value="">All Entities</option>
            <option value="PROJECT">Project Files</option>
            <option value="CLIENT">Client Partner</option>
            <option value="SUPPLIER">Material Supplier</option>
            <option value="AMC">AMC Contracts</option>
            <option value="COMPANY">Company Internal</option>
          </select>

          <select
            name="status"
            className="quote-filter-input"
            value={filters.status}
            onChange={handleFilterChange}
          >
            <option value="">All Statuses</option>
            <option value="PROCESSING">AI Extracting</option>
            <option value="AUTO_FILED">Auto Filed</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
            <option value="VERIFIED">Verified</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            name="is_confidential"
            className="quote-filter-input"
            value={filters.is_confidential === undefined ? '' : String(filters.is_confidential)}
            onChange={handleFilterChange}
          >
            <option value="">All Visibility</option>
            <option value="false">Public access</option>
            <option value="true">Gated Confidential</option>
          </select>

          <button className="quote-btn quote-btn-secondary" onClick={refetch}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Main split dashboard layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Category taxonomy rail */}
        <CategoryTree 
          selectedCategory={activeCategory}
          selectedSubcategory={activeSubcategory}
          onSelect={handleSelectCategory}
        />

        {/* Files list table */}
        <div className="quote-card" style={{ margin: 0 }}>
          <h3 className="quote-card-title">
            <FolderClosed size={16} /> 
            {activeSubcategory 
              ? `${activeCategory} › ${activeSubcategory.replace('_', ' ')}` 
              : activeCategory 
              ? `${activeCategory} Files` 
              : 'DMS Registry Registry'}
          </h3>

          <div style={{ marginTop: '1rem' }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
                <p>Loading files index...</p>
              </div>
            ) : error ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
                <p>Failed to query index: {error.message}</p>
              </div>
            ) : (
              <DocumentTable 
                documents={documents}
                onSelect={handleSelectDoc}
                onDelete={(id) => supabase.from('documents').update({ is_active: false }).eq('id', id).then(() => refetch())}
              />
            )}
          </div>
        </div>
      </div>

      {/* Document Detail Drawer */}
      <DocumentDetailDrawer 
        documentId={selectedDocId}
        isOpen={isDrawerOpen}
        onClose={() => { setSelectedDocId(null); setIsDrawerOpen(false); }}
        onUpdate={refetch}
      />

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="quote-modal-overlay">
          <div className="quote-modal" style={{ maxWidth: '650px', width: '95%' }}>
            <div className="quote-modal-header">
              <h3 className="quote-card-title"><Upload size={16} /> File Ingest Ingestion</h3>
              <button className="quote-btn quote-btn-secondary" style={{ padding: '0.3rem' }} onClick={() => { setShowUploadModal(false); refetch(); }}>
                &times;
              </button>
            </div>

            <div className="quote-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div className="quote-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="quote-form-group">
                  <label>Link File to Entity type</label>
                  <select 
                    value={uploadEntityType} 
                    onChange={(e) => setUploadEntityType(e.target.value as DocumentEntityType)} 
                    className="quote-filter-input"
                  >
                    <option value="COMPANY">Company (General folder)</option>
                    <option value="PROJECT">Project Contract</option>
                    <option value="CLIENT">Client Partner</option>
                    <option value="SUPPLIER">Material Supplier</option>
                    <option value="AMC">AMC Contract</option>
                  </select>
                </div>

                {uploadEntityType === 'PROJECT' && (
                  <div className="quote-form-group">
                    <label>Select Project</label>
                    <select 
                      value={uploadEntityId} 
                      onChange={(e) => setUploadEntityId(e.target.value)} 
                      className="quote-filter-input"
                    >
                      <option value="">-- Choose project --</option>
                      {projectsList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Upload Zone */}
              <DocumentUploadZone 
                entityType={uploadEntityType}
                entityId={uploadEntityType === 'PROJECT' ? uploadEntityId : undefined}
                onUploadComplete={refetch}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
