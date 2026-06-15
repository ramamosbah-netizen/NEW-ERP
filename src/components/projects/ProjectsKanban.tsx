// ============================================================
// JEET ERP — Projects Kanban Board Component
// Renders active projects grouped by status columns for agile workflow view
// ============================================================

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Calendar, User, Building } from 'lucide-react';
import type { Project, ProjectStatus } from '@/types/project.types';
import { ProjectStatusChip } from './ProjectStatusChip';

type Props = {
  projects: Project[];
};

const KANBAN_COLUMNS: { status: ProjectStatus; title: string; color: string }[] = [
  { status: 'MOBILIZATION', title: 'Mobilization', color: 'rgba(168, 85, 247, 0.4)' },
  { status: 'IN_PROGRESS', title: 'In Progress', color: 'rgba(59, 130, 246, 0.4)' },
  { status: 'TESTING', title: 'T&C / Testing', color: 'rgba(245, 158, 11, 0.4)' },
  { status: 'HANDOVER', title: 'Handover', color: 'rgba(16, 185, 129, 0.4)' },
  { status: 'DLP', title: 'DLP (Warranty)', color: 'rgba(34, 211, 238, 0.4)' },
  { status: 'ON_HOLD', title: 'On Hold', color: 'rgba(239, 68, 68, 0.4)' }
];

export const ProjectsKanban: React.FC<Props> = ({ projects }) => {
  return (
    <div style={{ display: 'flex', gap: '1.2rem', overflowX: 'auto', paddingBottom: '1.5rem', minHeight: '500px' }}>
      {KANBAN_COLUMNS.map((col) => {
        const colProjects = projects.filter((p) => p.status === col.status);

        return (
          <div 
            key={col.status} 
            style={{ 
              minWidth: '280px', 
              width: '280px', 
              display: 'flex', 
              flexDirection: 'column', 
              background: 'rgba(6, 8, 20, 0.4)', 
              borderRadius: '12px', 
              border: '1px solid var(--surface-hover)',
              padding: '0.9rem'
            }}
          >
            {/* Column Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: `2px solid ${col.color}`, paddingBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
                {col.title}
              </span>
              <span 
                style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--text-secondary)', 
                  background: 'var(--surface-hover)', 
                  padding: '2px 8px', 
                  borderRadius: '10px' 
                }}
              >
                {colProjects.length}
              </span>
            </div>

            {/* Cards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', flex: 1 }}>
              {colProjects.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', border: '1px dashed var(--surface-hover)', borderRadius: '8px' }}>
                  No projects
                </div>
              ) : (
                colProjects.map((proj) => (
                  <Link 
                    key={proj.id} 
                    href={`/projects/${proj.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div 
                      className="quote-card" 
                      style={{ 
                        margin: 0, 
                        padding: '0.9rem', 
                        background: 'rgba(13, 17, 39, 0.8)', 
                        borderColor: 'var(--surface-hover)',
                        cursor: 'pointer',
                        transition: 'var(--transition-fast)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = col.color;
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--surface-hover)';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      {/* Project No & Title */}
                      <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--secondary)', fontWeight: 700 }}>
                        {proj.project_number}
                      </div>
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff', marginTop: '0.3rem', marginBottom: '0.6rem', lineHeight: '1.25' }}>
                        {proj.name}
                      </h4>

                      {/* Details info */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--surface-hover)', paddingTop: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Building size={12} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {proj.client_name}
                          </span>
                        </div>
                        {proj.start_date && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Calendar size={12} />
                            <span>Start: {new Date(proj.start_date).toLocaleDateString('en-GB')}</span>
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.6rem', borderTop: '1px solid var(--surface-hover)', paddingTop: '0.4rem' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.1rem', fontWeight: 600 }}>
                          Details <ChevronRight size={12} />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
