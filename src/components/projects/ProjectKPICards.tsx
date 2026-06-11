// ============================================================
// JEET ERP — Project Master KPI Dashboard Cards
// Renders animated stats summarizing project health and financials
// ============================================================

import React from 'react';
import { Briefcase, TrendingUp, AlertOctagon, ShieldAlert } from 'lucide-react';
import type { Project } from '@/types/project.types';

type Props = {
  projects: Project[];
};

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export const ProjectKPICards: React.FC<Props> = ({ projects }) => {
  const activeCount = projects.filter(
    (p) => ['MOBILIZATION', 'IN_PROGRESS', 'TESTING', 'HANDOVER'].includes(p.status)
  ).length;

  const totalValue = projects
    .filter((p) => !['SUBMITTED', 'LOST', 'CANCELLED'].includes(p.status))
    .reduce((sum, p) => sum + (Number(p.contract_value) || 0), 0);

  const dlpCount = projects.filter((p) => p.status === 'DLP').length;
  const onHoldCount = projects.filter((p) => p.status === 'ON_HOLD').length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem', marginBottom: '1.8rem' }}>
      {/* 1. Active Projects */}
      <div className="quote-card" style={{ margin: 0, borderLeft: '4px solid var(--secondary)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active Projects
          </span>
          <Briefcase size={18} style={{ color: 'var(--secondary)' }} />
        </div>
        <div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#ffffff' }}>
            {activeCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Execution & Commissioning phase
          </div>
        </div>
      </div>

      {/* 2. Total Contract Portfolio */}
      <div className="quote-card" style={{ margin: 0, borderLeft: '4px solid #00E5A0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Portfolio Value
          </span>
          <TrendingUp size={18} style={{ color: '#00E5A0' }} />
        </div>
        <div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#00E5A0' }}>
            {fmtAED(totalValue)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Cumulative value of active work
          </div>
        </div>
      </div>

      {/* 3. Under Warranty (DLP) */}
      <div className="quote-card" style={{ margin: 0, borderLeft: '4px solid var(--primary)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Under DLP
          </span>
          <ShieldAlert size={18} style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#ffffff' }}>
            {dlpCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Defects Liability Period (Warranty)
          </div>
        </div>
      </div>

      {/* 4. On Hold Projects */}
      <div className="quote-card" style={{ margin: 0, borderLeft: '4px solid var(--error)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Paused Projects
          </span>
          <AlertOctagon size={18} style={{ color: 'var(--error)' }} />
        </div>
        <div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#ffffff' }}>
            {onHoldCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Pending client instruction or site clearances
          </div>
        </div>
      </div>
    </div>
  );
};
