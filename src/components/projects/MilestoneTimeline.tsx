// ============================================================
// JEET ERP — Project Milestones Timeline Component
// Visual horizontal step progress representing project execution stages
// ============================================================

import React from 'react';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import type { ProjectMilestone } from '@/types/project.types';

type Props = {
  milestones: ProjectMilestone[];
};

export const MilestoneTimeline: React.FC<Props> = ({ milestones }) => {
  if (!milestones || milestones.length === 0) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
        No milestones configured for this project.
      </div>
    );
  }

  // Sort milestones by sort_order
  const sorted = [...milestones].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', margin: '1rem 0' }}>
      <div style={{ display: 'flex', overflowX: 'auto', padding: '1rem 0', gap: '2rem', minHeight: '120px' }}>
        {sorted.map((m, idx) => {
          const isDone = m.status === 'DONE';
          const isDelayed = m.status === 'DELAYED';
          
          let color = 'var(--text-muted)';
          let Icon = Circle;
          if (isDone) {
            color = '#00E5A0';
            Icon = CheckCircle2;
          } else if (isDelayed) {
            color = 'var(--error)';
            Icon = AlertCircle;
          }

          return (
            <div 
              key={m.id} 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                minWidth: '150px', 
                flex: 1, 
                position: 'relative',
                textAlign: 'center'
              }}
            >
              {/* Connector line */}
              {idx < sorted.length - 1 && (
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: '16px', 
                    left: 'calc(50% + 15px)', 
                    right: 'calc(-50% + 15px)', 
                    height: '2px', 
                    background: isDone ? '#00E5A0' : 'rgba(255, 255, 255, 0.08)',
                    zIndex: 1
                  }}
                />
              )}

              {/* Status node */}
              <div 
                style={{ 
                  zIndex: 2, 
                  backgroundColor: 'var(--bg-dark)', 
                  padding: '2px', 
                  borderRadius: '50%',
                  color: color,
                  marginBottom: '0.6rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isDone ? '0 0 10px rgba(0, 229, 160, 0.2)' : 'none'
                }}
              >
                <Icon size={30} strokeWidth={1.5} />
              </div>

              {/* Title & info */}
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isDone ? '#ffffff' : 'var(--text-secondary)' }}>
                {m.title}
              </div>
              
              {m.payment_linked && m.payment_pct && (
                <div 
                  style={{ 
                    fontSize: '0.72rem', 
                    color: 'var(--secondary)', 
                    fontWeight: 700, 
                    marginTop: '0.2rem',
                    background: 'rgba(34, 211, 238, 0.08)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid rgba(34, 211, 238, 0.15)'
                  }}
                >
                  Invoice: {m.payment_pct}%
                </div>
              )}

              {m.planned_date && (
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {new Date(m.planned_date).toLocaleDateString('en-GB')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
