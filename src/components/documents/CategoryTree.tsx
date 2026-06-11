// ============================================================
// JEET ERP — Document Categories Tree Navigation Component
// Collapsible accordion sidebar to filter documents by category/subcategory
// ============================================================

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen, File } from 'lucide-react';

type Props = {
  selectedCategory: string;
  selectedSubcategory: string;
  onSelect: (category: string, subcategory: string) => void;
};

type CategoryNode = {
  name: string;
  subcategories: string[];
};

const CATEGORY_TAXONOMY: CategoryNode[] = [
  {
    name: 'COMMERCIAL',
    subcategories: [
      'QUOTATION', 'CLIENT_LPO', 'SUPPLIER_QUOTE', 'SUPPLIER_INVOICE', 
      'CLIENT_INVOICE', 'PAYMENT_CERTIFICATE', 'VARIATION_ORDER', 
      'PAYMENT_RECEIPT', 'BANK_GUARANTEE'
    ]
  },
  {
    name: 'CONTRACTUAL',
    subcategories: [
      'CONTRACT', 'SUBCONTRACT', 'NDA', 'WARRANTY_CERTIFICATE', 
      'HANDOVER_CERTIFICATE', 'INSURANCE_POLICY'
    ]
  },
  {
    name: 'TECHNICAL',
    subcategories: [
      'SHOP_DRAWING', 'AS_BUILT', 'SCHEMATIC', 'DATASHEET', 
      'MATERIAL_SUBMITTAL', 'METHOD_STATEMENT', 'RISK_ASSESSMENT', 
      'TC_REPORT', 'PROGRAMME'
    ]
  },
  {
    name: 'COMPLIANCE',
    subcategories: [
      'SIRA_CERTIFICATE', 'SIRA_EGUARD', 'DCD_NOC', 'DM_APPROVAL', 
      'DEWA_NOC', 'TRADE_LICENSE', 'ESTABLISHMENT_CARD', 'THIRD_PARTY_CERT'
    ]
  },
  {
    name: 'CORRESPONDENCE',
    subcategories: [
      'CLIENT_LETTER', 'CONSULTANT_LETTER', 'EMAIL', 'RFI', 
      'MEETING_MINUTES', 'SITE_INSTRUCTION'
    ]
  },
  {
    name: 'SITE',
    subcategories: [
      'SITE_PHOTO', 'DELIVERY_NOTE', 'SITE_REPORT', 'SNAG_LIST', 'INSPECTION_REPORT'
    ]
  },
  {
    name: 'OTHER',
    subcategories: ['UNCLASSIFIED']
  }
];

export const CategoryTree: React.FC<Props> = ({
  selectedCategory,
  selectedSubcategory,
  onSelect
}) => {
  // Keep track of which categories are expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    COMMERCIAL: true,
    CONTRACTUAL: false,
    TECHNICAL: false,
    COMPLIANCE: false,
    CORRESPONDENCE: false,
    SITE: false,
    OTHER: false
  });

  const toggleExpand = (cat: string) => {
    setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0,0,0,0.18)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)', height: 'fit-content' }}>
      <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
        Taxonomy Library
      </h3>

      {/* All Documents option */}
      <div 
        onClick={() => onSelect('', '')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.82rem',
          fontWeight: (!selectedCategory && !selectedSubcategory) ? 700 : 500,
          color: (!selectedCategory && !selectedSubcategory) ? 'var(--primary)' : 'var(--text-primary)',
          cursor: 'pointer',
          padding: '0.4rem 0.5rem',
          borderRadius: '4px',
          background: (!selectedCategory && !selectedSubcategory) ? 'rgba(0, 229, 160, 0.08)' : 'transparent',
          transition: 'var(--transition-fast)'
        }}
      >
        <FolderOpen size={14} />
        All Folders
      </div>

      {/* Categories Accordion */}
      {CATEGORY_TAXONOMY.map((node) => {
        const isCurrentCat = selectedCategory === node.name;
        const isExpanded = expanded[node.name];

        return (
          <div key={node.name} style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Category row */}
            <div 
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                padding: '0.4rem 0.5rem',
                borderRadius: '4px',
                background: (isCurrentCat && !selectedSubcategory) ? 'rgba(0, 229, 160, 0.08)' : 'transparent',
                color: (isCurrentCat && !selectedSubcategory) ? 'var(--primary)' : 'var(--text-primary)',
                transition: 'var(--transition-fast)'
              }}
              onClick={() => {
                onSelect(node.name, '');
                toggleExpand(node.name);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: isCurrentCat ? 700 : 500 }}>
                {isExpanded ? <FolderOpen size={14} style={{ color: 'var(--secondary)' }} /> : <Folder size={14} />}
                <span>{node.name}</span>
              </div>
              {isExpanded ? <ChevronDown size={14} style={{ opacity: 0.5 }} /> : <ChevronRight size={14} style={{ opacity: 0.5 }} />}
            </div>

            {/* Subcategories list */}
            {isExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '1.5rem', borderLeft: '1px solid rgba(255, 255, 255, 0.04)', margin: '0.2rem 0 0.4rem 0.8rem', gap: '0.2rem' }}>
                {node.subcategories.map((sub) => {
                  const isCurrentSub = selectedCategory === node.name && selectedSubcategory === sub;

                  return (
                    <div 
                      key={sub}
                      onClick={() => onSelect(node.name, sub)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.76rem',
                        fontWeight: isCurrentSub ? 700 : 400,
                        color: isCurrentSub ? 'var(--primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '0.3rem 0.5rem',
                        borderRadius: '4px',
                        background: isCurrentSub ? 'rgba(0, 229, 160, 0.08)' : 'transparent',
                        transition: 'var(--transition-fast)'
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrentSub) e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrentSub) e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                    >
                      <File size={12} style={{ opacity: 0.6 }} />
                      <span>{sub.replace('_', ' ')}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
