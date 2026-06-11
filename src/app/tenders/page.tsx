'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  Briefcase, 
  Search, 
  Filter, 
  Plus, 
  Calendar, 
  Clock, 
  ArrowLeft, 
  AlertCircle,
  FileText
} from 'lucide-react';
import '@/app/tenders/tenders.css';

type Tender = {
  id: string;
  title: string;
  project_name: string;
  client_name: string;
  location: string;
  deadline_date: string;
  budget: number | null;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Completed';
  updated_at: string;
};

export default function TendersDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const fetchTenders = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1. Get current authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace('/signin');
          return;
        }

        // 2. Fetch user-scoped tenders
        const { data, error } = await supabase
          .from('tenders')
          .select('id, title, project_name, client_name, location, deadline_date, budget, status, updated_at')
          .order('updated_at', { ascending: false });

        if (error) {
          throw error;
        }

        setTenders(data as Tender[] || []);
      } catch (err: any) {
        console.error('Error fetching tenders:', err);
        setErrorMsg('Failed to load tenders. Ensure the database schemas have been applied.');
      } finally {
        setLoading(false);
      }
    };

    fetchTenders();
  }, [router]);

  // Handle filtering and search
  const filteredTenders = tenders.filter((t) => {
    const matchesSearch = 
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.location.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

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

  const formatBudget = (budget: number | null) => {
    if (budget === null || budget === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(budget);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner"></div>
        <p style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-secondary)' }}>Loading ERP Tenders Workspace...</p>
      </div>
    );
  }

  return (
    <div className="tenders-container">
      {/* Header Row */}
      <div className="tenders-header">
        <div>
          <Link href="/dashboard" className="logout-btn" style={{ textDecoration: 'none', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <h1 className="tenders-title">Tenders & Bid Management</h1>
        </div>
        
        <Link href="/tenders/new" className="action-btn btn-primary" style={{ textDecoration: 'none' }}>
          <Plus size={18} />
          <span>New Tender</span>
        </Link>
      </div>

      {errorMsg && (
        <div className="db-warning-banner" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }}>
          <AlertCircle size={24} style={{ color: 'var(--error)' }} />
          <div>
            <strong>Database Connection Error</strong>
            <p style={{ marginTop: '0.4rem' }}>{errorMsg}</p>
            <p style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
              Ensure you ran the SQL script in <code>supabase/schema-tenders.sql</code> in the SQL editor of your Supabase project dashboard.
            </p>
          </div>
        </div>
      )}

      {/* Main panel for controls & list */}
      <div className="tenders-panel">
        <div className="controls-row">
          <div className="search-input-wrapper">
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search tenders by title, client, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <select 
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
              <option value="Under Review">Under Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        {filteredTenders.length === 0 ? (
          <div className="empty-state">
            <Briefcase size={64} className="empty-state-icon" />
            <h3 className="empty-state-title">No Tenders Found</h3>
            <p style={{ maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
              {searchTerm || statusFilter !== 'all' 
                ? "No tenders match your active search terms or status filters." 
                : "Get started by creating your first corporate procurement proposal."}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Link href="/tenders/new" className="action-btn btn-secondary" style={{ textDecoration: 'none' }}>
                <Plus size={16} /> Create Tender
              </Link>
            )}
          </div>
        ) : (
          <div className="tenders-grid">
            {filteredTenders.map((tender) => (
              <div 
                key={tender.id} 
                className="tender-card"
                onClick={() => router.push(`/tenders/${tender.id}`)}
              >
                <div>
                  <div className="tender-card-header">
                    <span className={`status-badge ${getStatusClass(tender.status)}`}>
                      {tender.status}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Budget: <strong style={{ color: 'var(--text-primary)' }}>{formatBudget(tender.budget)}</strong>
                    </span>
                  </div>

                  <h3 className="tender-card-title">{tender.title}</h3>
                  <div className="tender-client">{tender.client_name} • {tender.project_name}</div>
                </div>

                <div>
                  <div className="tender-card-details">
                    <div className="tender-detail-row">
                      <span className="tender-deadline">
                        <Calendar size={14} /> Deadline: {formatDate(tender.deadline_date)}
                      </span>
                    </div>
                  </div>

                  <div className="tender-card-footer">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={12} /> Last updated: {new Date(tender.updated_at).toLocaleDateString()}
                    </span>
                    <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>View Details &rarr;</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
