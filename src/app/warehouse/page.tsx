'use client';

// ============================================================
// JEET ERP — Warehouse & Inventory hub
// ============================================================

import React from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Users, Package, Truck, Calculator, ArrowRight } from 'lucide-react';

const SECTIONS = [
  { href: '/warehouse/suppliers', title: 'Suppliers & Subcontractors', desc: 'Register and manage suppliers; performance scoring from order history. Suppliers created anywhere in the system appear here.', icon: Users },
  { href: '/warehouse/store', title: 'Store', desc: 'Registered goods and materials on hand, valuation, and stock-risk alerts (out of stock / below reorder level).', icon: Package },
  { href: '/warehouse/movements', title: 'Goods Movements', desc: 'Track materials across sites and projects — receipts, issues, returns, transfers, adjustments and write-offs.', icon: Truck },
  { href: '/pricing', title: 'Pricing Catalogue', desc: 'Master rate catalogue feeding BOQ and quotations. Prices update as offers, proformas and supplier invoices are received.', icon: Calculator },
];

export default function WarehouseHub() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Warehouse & Inventory"
        subtitle="Suppliers, store, goods movements and the pricing catalogue — one place for materials and supply"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SECTIONS.map(s => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href} className="no-underline group">
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--text-muted)] rounded-lg p-4 h-full flex flex-col gap-2.5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-8 rounded-md bg-[var(--bg-dark)] border border-[var(--border-color)] flex items-center justify-center">
                    <Icon size={15} className="text-[var(--text-secondary)]" />
                  </div>
                  <ArrowRight size={13} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">{s.title}</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
