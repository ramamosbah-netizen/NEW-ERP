// ============================================================
// JEET ERP — Clause Templates Library Manager
// Routes: /quotations/templates
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  FileText,
  AlertCircle,
  Check
} from 'lucide-react';
import { useQuotationTemplates } from '@/hooks/useQuotations';
import '../quotations.css';

export default function TemplatesPage() {
  const { templates, loading, error, refetch } = useQuotationTemplates();
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  
  // Editor States
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('TERMS');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Check user role
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile) setCurrentProfile(profile);
          });
      }
    });
  }, []);

  const handleEditClick = (tpl: any) => {
    setSelectedTemplate(tpl);
    setName(tpl.template_name);
    setType(tpl.template_type);
    setContent(tpl.content);
    setIsEditing(true);
  };

  const handleCreateClick = () => {
    setSelectedTemplate(null);
    setName('');
    setType('TERMS');
    setContent('');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!name || !content) {
      alert('Template Name and Content are required.');
      return;
    }

    try {
      setSaving(true);
      if (selectedTemplate) {
        // Update
        const { error } = await supabase
          .from('quotation_templates')
          .update({
            template_name: name,
            template_type: type,
            content: content
          })
          .eq('id', selectedTemplate.id);
        
        if (error) throw error;
        alert('Template successfully updated!');
      } else {
        // Insert
        const { error } = await supabase
          .from('quotation_templates')
          .insert({
            template_name: name,
            template_type: type,
            content: content,
            is_default: false
          });

        if (error) throw error;
        alert('New template created successfully!');
      }

      setIsEditing(false);
      refetch();
    } catch (err: any) {
      alert('Failed to save template: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this template clause?')) {
      try {
        const { error } = await supabase
          .from('quotation_templates')
          .delete()
          .eq('id', id);

        if (error) throw error;
        alert('Template deleted.');
        refetch();
      } catch (err: any) {
        alert('Deletion failed: ' + err.message);
      }
    }
  };

  if (loading) {
    return (
      <div className="quote-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading clause templates...</p>
      </div>
    );
  }

  // Ensure user has permissions (Estimator, Commercial Manager, GM, Admin)
  const isAuthorized = currentProfile?.role === 'admin' || currentProfile?.role === 'manager' || currentProfile?.role === 'engineer';
  if (currentProfile && !isAuthorized) {
    return (
      <div className="quote-container">
        <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', textAlign: 'center', padding: '3rem' }}>
          <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Unauthorized</h2>
          <p style={{ color: 'var(--text-secondary)' }}>You do not have permission to view or manage clause templates.</p>
          <Link href="/quotations" className="quote-btn quote-btn-secondary" style={{ marginTop: '1.5rem' }}>
            Back to registry
          </Link>
        </div>
      </div>
    );
  }

  const typeLabels: Record<string, string> = {
    TERMS: 'T&C Clauses',
    EXCLUSIONS: 'Exclusions',
    INCLUSIONS: 'Inclusions',
    PAYMENT: 'Payment Terms',
    WARRANTY: 'Warranty Terms',
    SCOPE: 'Scope Details'
  };

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/quotations" className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.6rem' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="quote-header-title">Commercial Clauses Library</h1>
            <p className="quote-header-subtitle">Manage default Payment terms, Warranties, exclusions, and inclusions</p>
          </div>
        </div>
        {!isEditing && (
          <button className="quote-btn quote-btn-primary" onClick={handleCreateClick}>
            <Plus size={16} /> Create Template
          </button>
        )}
      </header>

      {/* Editor Pane (overlay or side panel) */}
      {isEditing && (
        <div className="quote-card" style={{ borderColor: '#00E5A0', background: 'rgba(0, 229, 160, 0.02)' }}>
          <h3 className="quote-card-title">
            <Edit size={16} /> {selectedTemplate ? 'Edit Clause Template' : 'New Clause Template'}
          </h3>
          
          <div className="quote-form-grid" style={{ marginTop: '1.2rem', marginBottom: '1.2rem' }}>
            <div className="quote-form-group">
              <label>Template Name</label>
              <input type="text" className="quote-form-input" placeholder="e.g. Standard ELV — Residential" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="quote-form-group">
              <label>Clause Type</label>
              <select className="quote-form-input" value={type} onChange={e => setType(e.target.value)}>
                <option value="TERMS">T&C Clauses</option>
                <option value="EXCLUSIONS">Exclusions</option>
                <option value="INCLUSIONS">Inclusions</option>
                <option value="PAYMENT">Payment Terms</option>
                <option value="WARRANTY">Warranty Terms</option>
                <option value="SCOPE">Scope Details</option>
              </select>
            </div>
          </div>

          <div className="quote-form-group" style={{ marginBottom: '1.5rem' }}>
            <label>Clause Content</label>
            <textarea className="quote-form-textarea" style={{ minHeight: '180px' }} value={content} onChange={e => setContent(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
            <button className="quote-btn quote-btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
            <button className="quote-btn quote-btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving...' : 'Save Clause Template'}
            </button>
          </div>
        </div>
      )}

      {/* Templates Grid List */}
      {!isEditing && (
        <div className="quote-card">
          {templates.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <FileText size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
              <p>No template clauses found. Seed database to default.</p>
            </div>
          ) : (
            <div className="quote-table-wrap">
              <table className="quote-table">
                <thead>
                  <tr>
                    <th>Template Name</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Clause Sneak Peek</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map(tpl => (
                    <tr key={tpl.id}>
                      <td style={{ fontWeight: 600 }}>{tpl.template_name}</td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {typeLabels[tpl.template_type] || tpl.template_type}
                        </span>
                      </td>
                      <td>
                        {tpl.is_default ? (
                          <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', fontWeight: 600 }}>
                            <Check size={12} /> Default
                          </span>
                        ) : 'No'}
                      </td>
                      <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                        {tpl.content}
                      </td>
                      <td style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                        <button className="quote-btn quote-btn-secondary" style={{ padding: '0.3rem 0.6rem' }} onClick={() => handleEditClick(tpl)}>
                          <Edit size={12} /> Edit
                        </button>
                        {!tpl.is_default && (
                          <button className="quote-btn quote-btn-danger" style={{ padding: '0.3rem 0.6rem' }} onClick={() => handleDelete(tpl.id)}>
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
