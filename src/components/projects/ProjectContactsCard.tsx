// ============================================================
// JEET ERP — Project Master Contacts Management Component
// Form and listing for internal/external stakeholders with primary flag & WhatsApp checkbox
// ============================================================

import React, { useState } from 'react';
import { Plus, Trash2, Mail, Phone, UserCheck, ShieldAlert } from 'lucide-react';
import type { ProjectContact, ContactRole } from '@/types/project.types';

type Props = {
  contacts: ProjectContact[];
  onAdd: (contact: Omit<ProjectContact, 'id' | 'created_at' | 'project_id'>) => Promise<any>;
  onDelete: (contactId: string) => Promise<any>;
};

const ROLE_LABELS: Record<ContactRole, string> = {
  CLIENT_REP: 'Client Representative',
  CONSULTANT: 'Consultant Engineer',
  MAIN_CONTRACTOR: 'Main Contractor PM',
  FM: 'Facilities Manager',
  SECURITY_MANAGER: 'SIRA Security Manager',
  OTHER: 'Other Stakeholder'
};

export const ProjectContactsCard: React.FC<Props> = ({ contacts, onAdd, onDelete }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<ContactRole>('CLIENT_REP');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [whatsappOptin, setWhatsappOptin] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await onAdd({
        name,
        role,
        email: email || undefined,
        phone: phone || undefined,
        is_primary: isPrimary,
        whatsapp_optin: whatsappOptin,
        notes: notes || undefined
      });
      // Reset
      setName('');
      setRole('CLIENT_REP');
      setEmail('');
      setPhone('');
      setIsPrimary(false);
      setWhatsappOptin(false);
      setNotes('');
      setShowAddForm(false);
    } catch (err: any) {
      setError(err.message || 'Failed to add contact');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="quote-card" style={{ margin: 0 }}>
      <div className="quote-card-header">
        <h3 className="quote-card-title">
          <Mail size={18} /> Contacts & Stakeholders
        </h3>
        {!showAddForm && (
          <button 
            type="button" 
            className="quote-btn quote-btn-primary" 
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={14} /> Add Contact
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="quote-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="quote-form-group">
              <label>Full Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="quote-form-input" 
                placeholder="John Doe" 
                required 
              />
            </div>

            <div className="quote-form-group">
              <label>Role</label>
              <select 
                value={role} 
                onChange={(e) => setRole(e.target.value as ContactRole)} 
                className="quote-filter-input"
              >
                <option value="CLIENT_REP">Client Rep</option>
                <option value="CONSULTANT">Consultant</option>
                <option value="MAIN_CONTRACTOR">Main Contractor</option>
                <option value="FM">Facilities Manager (FM)</option>
                <option value="SECURITY_MANAGER">SIRA Security Mgr</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="quote-form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="quote-form-input" 
                placeholder="john@example.com" 
              />
            </div>

            <div className="quote-form-group">
              <label>Phone Number</label>
              <input 
                type="tel" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                className="quote-form-input" 
                placeholder="+971 50 123 4567" 
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
              <input 
                type="checkbox" 
                checked={isPrimary} 
                onChange={(e) => setIsPrimary(e.target.checked)} 
                style={{ width: '15px', height: '15px', accentColor: 'var(--primary)' }}
              />
              Mark as Primary Contact
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
              <input 
                type="checkbox" 
                checked={whatsappOptin} 
                onChange={(e) => setWhatsappOptin(e.target.checked)} 
                style={{ width: '15px', height: '15px', accentColor: 'var(--primary)' }}
              />
              Opt-in for WhatsApp Notifications
            </label>
          </div>

          <div className="quote-form-group">
            <label>Notes / Reminders</label>
            <input 
              type="text" 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              className="quote-form-input" 
              placeholder="E.g. Primary site engineering coordinator" 
            />
          </div>

          {error && <div style={{ color: '#ef4444', fontSize: '0.8rem' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button 
              type="button" 
              className="quote-btn quote-btn-secondary" 
              onClick={() => setShowAddForm(false)}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="quote-btn quote-btn-primary" 
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Stakeholder'}
            </button>
          </div>
        </form>
      )}

      {/* Contacts List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {contacts.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
            No contacts recorded. Add client representatives or consultants to this project.
          </p>
        ) : (
          contacts.map((contact) => (
            <div 
              key={contact.id} 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '0.8rem', 
                background: 'rgba(255,255,255,0.02)', 
                border: '1px solid rgba(255,255,255,0.05)', 
                borderRadius: '8px' 
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.9rem' }}>
                    {contact.name}
                  </span>
                  <span 
                    style={{ 
                      fontSize: '0.68rem', 
                      background: 'rgba(255,255,255,0.05)', 
                      padding: '1px 6px', 
                      borderRadius: '4px',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {ROLE_LABELS[contact.role] || contact.role}
                  </span>
                  {contact.is_primary && (
                    <span style={{ color: '#00E5A0', display: 'flex', alignItems: 'center', gap: '0.1rem', fontSize: '0.68rem', fontWeight: 600 }}>
                      <UserCheck size={12} /> Primary
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1.2rem', marginTop: '0.3rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {contact.phone && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Phone size={12} /> {contact.phone}
                    </span>
                  )}
                  {contact.email && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Mail size={12} /> {contact.email}
                    </span>
                  )}
                </div>

                {contact.notes && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontStyle: 'italic' }}>
                    Note: {contact.notes}
                  </p>
                )}
              </div>

              <button 
                type="button" 
                className="quote-btn quote-btn-danger" 
                style={{ padding: '0.4rem' }}
                onClick={() => {
                  if (window.confirm(`Are you sure you want to remove ${contact.name}?`)) {
                    onDelete(contact.id);
                  }
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
