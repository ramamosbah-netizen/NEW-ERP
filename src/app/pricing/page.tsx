'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Search,
  Plus,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Package,
  Eye,
  Pencil,
  Trash2,
  X,
  DollarSign,
  Database,
  Activity,
  Users,
  Layers,
  ArrowLeft,
  Copy,
  Lock,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Wrench,
  Settings,
  HardHat,
  Calculator,
} from 'lucide-react';
import type {
  PricingItem,
  PricingFilters,
  PricingSystem,
  PricingTemplate,
} from '@/lib/pricing-types';
import { DEFAULT_FILTERS, PRICING_SYSTEMS } from '@/lib/pricing-types';
import {
  calculatePricing,
  formatAED,
  formatAEDCompact,
  formatPct,
  formatDateDMY,
  SYSTEM_LABELS,
  SYSTEM_COLORS,
} from '@/lib/pricing-engine';
import {
  fetchPricingItems,
  fetchPricingStats,
  fetchTemplates,
  createPricingItem,
  updatePricingItem,
  deletePricingItem,
  applyTemplateToItems,
  fetchDistinctBrands,
} from '@/lib/pricing-service';
import '@/app/pricing/pricing.css';

// ============================================================
// Page Component
// ============================================================

export default function PricingItemsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PricingItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<PricingFilters>({ ...DEFAULT_FILTERS });
  const [stats, setStats] = useState<{
    total_items: number;
    active_items: number;
    avg_sell_price: number;
    total_material_value: number;
    systems_count: Record<string, number>;
  } | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<PricingTemplate[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create'>('view');
  const [activeItem, setActiveItem] = useState<PricingItem | null>(null);
  const [drawerTab, setDrawerTab] = useState<'details' | 'labour' | 'pricing'>('details');
  const [saving, setSaving] = useState(false);

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Data fetching ---
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsResult, statsResult, templatesResult, brandsResult] = await Promise.all([
        fetchPricingItems(filters),
        fetchPricingStats(),
        fetchTemplates(),
        fetchDistinctBrands(),
      ]);
      setItems(itemsResult.data);
      setTotalCount(itemsResult.count);
      setStats(statsResult);
      setTemplates(templatesResult);
      setBrands(brandsResult);
    } catch (err) {
      console.error('Failed to load pricing data:', err);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadData(); }, [loadData]);

  // --- Toast ---
  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // --- Filters ---
  const updateFilter = <K extends keyof PricingFilters>(key: K, value: PricingFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value, page: key === 'page' ? value as number : 1 }));
  };

  const handleSearchChange = (value: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      updateFilter('search', value);
    }, 350);
  };

  const toggleSort = (col: PricingFilters['sort_by']) => {
    setFilters(prev => ({
      ...prev,
      sort_by: col,
      sort_dir: prev.sort_by === col && prev.sort_dir === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  };

  const clearFilters = () => {
    setFilters({ ...DEFAULT_FILTERS });
  };

  const toggleSystemFilter = (sys: PricingSystem) => {
    setFilters(prev => {
      const systems = prev.systems.includes(sys)
        ? prev.systems.filter(s => s !== sys)
        : [...prev.systems, sys];
      return { ...prev, systems, page: 1 };
    });
  };

  // --- Selection ---
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  };

  // --- Drawer ---
  const openDrawer = (item: PricingItem | null, mode: 'view' | 'edit' | 'create') => {
    setActiveItem(item ? { ...item } : createBlankItem());
    setDrawerMode(mode);
    setDrawerTab('details');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setActiveItem(null);
  };

  const handleDrawerSave = async () => {
    if (!activeItem) return;
    setSaving(true);
    try {
      if (drawerMode === 'create') {
        await createPricingItem(activeItem);
        showToast('Item created successfully', 'success');
      } else {
        await updatePricingItem(activeItem.id, activeItem);
        showToast('Item updated successfully', 'success');
      }
      closeDrawer();
      loadData();
    } catch (err) {
      console.error('Save error:', err);
      showToast('Failed to save item', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Soft-delete this item? It will be marked inactive.')) return;
    try {
      await deletePricingItem(id);
      showToast('Item archived', 'success');
      loadData();
    } catch (err) {
      showToast('Delete failed', 'error');
    }
  };

  const updateActiveItem = (key: keyof PricingItem, value: unknown) => {
    setActiveItem(prev => prev ? { ...prev, [key]: value } as PricingItem : null);
  };

  // --- Pagination ---
  const totalPages = Math.ceil(totalCount / filters.per_page) || 1;
  const hasFiltersActive = filters.search || filters.systems.length > 0 || filters.price_tier !== 'all' || filters.brand;

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="pricing-shell">
      {/* Top Bar */}
      <header className="pricing-topbar">
        <div className="pricing-topbar-left">
          <Link href="/dashboard" className="pricing-topbar-btn" style={{ gap: '4px' }}>
            <ArrowLeft size={14} />
            ERP
          </Link>
          <div className="pricing-topbar-divider" />
          <span className="pricing-topbar-logo">
            <Database size={16} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
            Pricing
          </span>
          <div className="pricing-topbar-divider" />
          <span className="pricing-topbar-title">Master Rate Catalog</span>
        </div>
        <div className="pricing-topbar-right">
          {selectedIds.size > 0 && (
            <span style={{ fontSize: '0.78rem', color: 'var(--p-mint)', fontFamily: 'var(--p-font-data)' }}>
              {selectedIds.size} selected
            </span>
          )}
          <button className="pricing-topbar-btn" onClick={() => openDrawer(null, 'create')}>
            <Plus size={14} />
            New Item
          </button>
        </div>
      </header>

      <div className="pricing-body">
        {/* Stats Row */}
        {stats && (
          <div className="pricing-stats-row">
            <div className="pricing-stat-card">
              <span className="pricing-stat-label">Total Items</span>
              <span className="pricing-stat-value mint">{stats.total_items}</span>
              <span className="pricing-stat-sub">{stats.active_items} active</span>
            </div>
            <div className="pricing-stat-card">
              <span className="pricing-stat-label">Systems Covered</span>
              <span className="pricing-stat-value blue">{Object.keys(stats.systems_count).length}</span>
              <span className="pricing-stat-sub">ELV & MEP categories</span>
            </div>
            <div className="pricing-stat-card">
              <span className="pricing-stat-label">Avg Sell Price</span>
              <span className="pricing-stat-value orange">{formatAEDCompact(stats.avg_sell_price)}</span>
              <span className="pricing-stat-sub">across all items</span>
            </div>
            <div className="pricing-stat-card">
              <span className="pricing-stat-label">Material Value</span>
              <span className="pricing-stat-value purple">{formatAEDCompact(stats.total_material_value)}</span>
              <span className="pricing-stat-sub">total catalog value</span>
            </div>
            <div className="pricing-stat-card">
              <span className="pricing-stat-label">Showing</span>
              <span className="pricing-stat-value">{items.length} / {totalCount}</span>
              <span className="pricing-stat-sub">page {filters.page} of {totalPages}</span>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="pricing-filter-bar">
          <div className="pricing-search-box">
            <Search size={16} />
            <input
              type="text"
              className="pricing-search-input"
              placeholder="Search items, codes, brands..."
              defaultValue={filters.search}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>

          <select
            className="pricing-filter-select"
            value=""
            onChange={e => { if (e.target.value) toggleSystemFilter(e.target.value as PricingSystem); }}
          >
            <option value="">+ System</option>
            {PRICING_SYSTEMS.map(sys => (
              <option key={sys} value={sys}>
                {SYSTEM_LABELS[sys] || sys}
              </option>
            ))}
          </select>

          <select
            className="pricing-filter-select"
            value={filters.price_tier}
            onChange={e => updateFilter('price_tier', e.target.value as PricingFilters['price_tier'])}
          >
            <option value="all">All Tiers</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
            <option value="budget">Budget</option>
          </select>

          {brands.length > 0 && (
            <select
              className="pricing-filter-select"
              value={filters.brand}
              onChange={e => updateFilter('brand', e.target.value)}
            >
              <option value="">All Brands</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}

          {hasFiltersActive && (
            <button className="pricing-topbar-btn" onClick={clearFilters} style={{ color: 'var(--p-red)' }}>
              <X size={14} />
              Clear
            </button>
          )}
        </div>

        {/* Active System Filter Chips */}
        {filters.systems.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {filters.systems.map(sys => (
              <span key={sys} className="pricing-filter-chip" onClick={() => toggleSystemFilter(sys)}>
                <span className="dot" style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: SYSTEM_COLORS[sys] || '#fff' }} />
                {SYSTEM_LABELS[sys] || sys}
                <span className="remove">×</span>
              </span>
            ))}
          </div>
        )}

        {/* Data Table */}
        <div className="pricing-table-wrap">
          {loading ? (
            <div className="pricing-spinner">
              <div className="pricing-spinner-dot" />
              <div className="pricing-spinner-dot" />
              <div className="pricing-spinner-dot" />
            </div>
          ) : items.length === 0 ? (
            <div className="pricing-empty">
              <Package size={48} />
              <h3>No items found</h3>
              <p>Adjust filters or create a new item.</p>
            </div>
          ) : (
            <>
              <div className="pricing-table-scroll">
                <table className="pricing-table">
                  <thead>
                    <tr>
                      <th style={{ width: '36px' }}>
                        <input
                          type="checkbox"
                          className="pricing-checkbox"
                          checked={selectedIds.size === items.length && items.length > 0}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <SortHeader label="Code" col="item_code" filters={filters} onSort={toggleSort} />
                      <th>System</th>
                      <SortHeader label="Description" col="description" filters={filters} onSort={toggleSort} />
                      <th>Unit</th>
                      <th>Brand</th>
                      <SortHeader label="Material" col="material_cost" filters={filters} onSort={toggleSort} />
                      <th>Labour</th>
                      <SortHeader label="Sell Price" col="sell_price" filters={filters} onSort={toggleSort} />
                      <th>+VAT</th>
                      <th>Tier</th>
                      <SortHeader label="Usage" col="usage_count" filters={filters} onSort={toggleSort} />
                      <th style={{ width: '80px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const calc = calculatePricing(item);
                      return (
                        <tr
                          key={item.id}
                          className={selectedIds.has(item.id) ? 'selected' : ''}
                          onDoubleClick={() => openDrawer(item, 'view')}
                        >
                          <td>
                            <input
                              type="checkbox"
                              className="pricing-checkbox"
                              checked={selectedIds.has(item.id)}
                              onChange={() => toggleSelect(item.id)}
                            />
                          </td>
                          <td className="code">{item.item_code}</td>
                          <td>
                            <SystemBadge system={item.system} />
                          </td>
                          <td style={{ maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.description}
                            {item.is_locked && <Lock size={11} style={{ marginLeft: '4px', color: 'var(--p-orange)', verticalAlign: '-1px' }} />}
                          </td>
                          <td style={{ color: 'var(--p-text-dim)', fontSize: '0.75rem' }}>{item.unit}</td>
                          <td style={{ color: 'var(--p-text-dim)' }}>{item.brand || '—'}</td>
                          <td className="num">{formatAED(item.material_cost)}</td>
                          <td className="num" style={{ color: 'var(--p-cyan)' }}>{formatAED(calc.labour_cost)}</td>
                          <td className="num" style={{ fontWeight: 600, color: 'var(--p-text-bright)' }}>
                            {formatAED(calc.sell_price)}
                          </td>
                          <td className="num" style={{ color: 'var(--p-text-dim)', fontSize: '0.75rem' }}>
                            {formatAED(calc.total_with_vat)}
                          </td>
                          <td>
                            <span className={`tier-badge tier-${item.price_tier}`}>{item.price_tier}</span>
                          </td>
                          <td className="num" style={{ color: 'var(--p-text-muted)' }}>{item.usage_count}</td>
                          <td className="action-cell">
                            <div className="pricing-row-actions">
                              <button
                                className="pricing-row-action-btn"
                                title="View"
                                onClick={() => openDrawer(item, 'view')}
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                className="pricing-row-action-btn"
                                title="Edit"
                                onClick={() => openDrawer(item, 'edit')}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                className="pricing-row-action-btn danger"
                                title="Archive"
                                onClick={() => handleDelete(item.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="pricing-pagination">
                <span className="pricing-pagination-info">
                  {(filters.page - 1) * filters.per_page + 1}–{Math.min(filters.page * filters.per_page, totalCount)} of {totalCount}
                </span>
                <div className="pricing-pagination-btns">
                  <button
                    className="pricing-page-btn"
                    disabled={filters.page <= 1}
                    onClick={() => updateFilter('page', filters.page - 1)}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        className={`pricing-page-btn ${filters.page === page ? 'active' : ''}`}
                        onClick={() => updateFilter('page', page)}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    className="pricing-page-btn"
                    disabled={filters.page >= totalPages}
                    onClick={() => updateFilter('page', filters.page + 1)}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* === DRAWER === */}
      {drawerOpen && activeItem && (
        <>
          <div className="pricing-drawer-overlay" onClick={closeDrawer} />
          <div className="pricing-drawer">
            <div className="pricing-drawer-header">
              <h2>
                {drawerMode === 'create' ? 'New Item' : activeItem.item_code}
                {drawerMode === 'view' && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--p-text-muted)', marginLeft: '10px', fontWeight: 400 }}>
                    View only
                  </span>
                )}
              </h2>
              <button className="pricing-drawer-close" onClick={closeDrawer}>
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="pricing-tabs">
              <div className={`pricing-tab ${drawerTab === 'details' ? 'active' : ''}`} onClick={() => setDrawerTab('details')}>
                <Package size={14} style={{ verticalAlign: '-2px', marginRight: '5px' }} />
                Details
              </div>
              <div className={`pricing-tab ${drawerTab === 'labour' ? 'active' : ''}`} onClick={() => setDrawerTab('labour')}>
                <HardHat size={14} style={{ verticalAlign: '-2px', marginRight: '5px' }} />
                Labour
              </div>
              <div className={`pricing-tab ${drawerTab === 'pricing' ? 'active' : ''}`} onClick={() => setDrawerTab('pricing')}>
                <Calculator size={14} style={{ verticalAlign: '-2px', marginRight: '5px' }} />
                Pricing
              </div>
            </div>

            <div className="pricing-drawer-body">
              {drawerTab === 'details' && (
                <DrawerDetailsTab
                  item={activeItem}
                  readOnly={drawerMode === 'view'}
                  onChange={updateActiveItem}
                />
              )}
              {drawerTab === 'labour' && (
                <DrawerLabourTab
                  item={activeItem}
                  readOnly={drawerMode === 'view'}
                  onChange={updateActiveItem}
                />
              )}
              {drawerTab === 'pricing' && (
                <DrawerPricingTab
                  item={activeItem}
                  readOnly={drawerMode === 'view'}
                  onChange={updateActiveItem}
                  templates={templates}
                />
              )}
            </div>

            {drawerMode !== 'view' && (
              <div className="pricing-drawer-footer">
                <button className="pricing-topbar-btn" onClick={closeDrawer}>Cancel</button>
                <button className="pricing-topbar-btn primary" onClick={handleDrawerSave} disabled={saving}>
                  {saving ? 'Saving...' : drawerMode === 'create' ? 'Create Item' : 'Save Changes'}
                </button>
              </div>
            )}

            {drawerMode === 'view' && (
              <div className="pricing-drawer-footer">
                <button className="pricing-topbar-btn" onClick={() => setDrawerMode('edit')}>
                  <Pencil size={14} />
                  Edit Item
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={`pricing-toast ${toast.type}`}>
          {toast.type === 'success' ? <Activity size={16} style={{ color: 'var(--p-mint)' }} /> : <X size={16} style={{ color: 'var(--p-red)' }} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sub-Components
// ============================================================

function SystemBadge({ system }: { system: string }) {
  const color = SYSTEM_COLORS[system] || '#888';
  const label = SYSTEM_LABELS[system] || system;
  return (
    <span className="sys-badge" style={{ background: `${color}15`, color }}>
      <span className="dot" style={{ background: color }} />
      {label}
    </span>
  );
}

function SortHeader({
  label,
  col,
  filters,
  onSort,
}: {
  label: string;
  col: PricingFilters['sort_by'];
  filters: PricingFilters;
  onSort: (col: PricingFilters['sort_by']) => void;
}) {
  const isSorted = filters.sort_by === col;
  return (
    <th className={isSorted ? 'sorted' : ''} onClick={() => onSort(col)}>
      {label}
      <span className="sort-arrow">
        {isSorted ? (filters.sort_dir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  );
}

// --- Details Tab ---
function DrawerDetailsTab({
  item,
  readOnly,
  onChange,
}: {
  item: PricingItem;
  readOnly: boolean;
  onChange: (key: keyof PricingItem, val: unknown) => void;
}) {
  return (
    <>
      <div className="pricing-form-section">
        <Package size={16} /> Item Identity
      </div>
      <div className="pricing-form-row">
        <Field label="Item Code" value={item.item_code} readOnly mono onChange={v => onChange('item_code', v)} />
        <FieldSelect label="System" value={item.system} readOnly={readOnly} options={PRICING_SYSTEMS.map(s => ({ value: s, label: SYSTEM_LABELS[s] || s }))} onChange={v => onChange('system', v)} />
        <Field label="Category" value={item.category} readOnly={readOnly} onChange={v => onChange('category', v)} />
        <Field label="Sub-Category" value={item.sub_category || ''} readOnly={readOnly} onChange={v => onChange('sub_category', v)} />
      </div>

      <div className="pricing-form-group">
        <label className="pricing-form-label">Description</label>
        <textarea
          className="pricing-form-input"
          rows={2}
          value={item.description}
          readOnly={readOnly}
          onChange={e => onChange('description', e.target.value)}
          style={{ resize: 'vertical' }}
        />
      </div>

      <div className="pricing-form-row">
        <Field label="Short Name" value={item.short_name || ''} readOnly={readOnly} onChange={v => onChange('short_name', v)} />
        <Field label="Unit" value={item.unit} readOnly={readOnly} onChange={v => onChange('unit', v)} />
        <Field label="Brand" value={item.brand || ''} readOnly={readOnly} onChange={v => onChange('brand', v)} />
        <Field label="Part Number" value={item.part_number || ''} readOnly={readOnly} mono onChange={v => onChange('part_number', v)} />
      </div>

      <div className="pricing-form-section">
        <Settings size={16} /> Specifications
      </div>
      <div className="pricing-form-row">
        <Field label="Supplier" value={item.supplier || ''} readOnly={readOnly} onChange={v => onChange('supplier', v)} />
        <Field label="Spec Reference" value={item.spec_reference || ''} readOnly={readOnly} onChange={v => onChange('spec_reference', v)} />
        <FieldSelect label="Price Tier" value={item.price_tier} readOnly={readOnly} options={[{ value: 'standard', label: 'Standard' }, { value: 'premium', label: 'Premium' }, { value: 'budget', label: 'Budget' }]} onChange={v => onChange('price_tier', v)} />
      </div>
      <div className="pricing-form-row">
        <FieldNum label="Lead Time (days)" value={item.lead_time_days} readOnly={readOnly} onChange={v => onChange('lead_time_days', v)} />
        <FieldNum label="Warranty (months)" value={item.warranty_months} readOnly={readOnly} onChange={v => onChange('warranty_months', v)} />
      </div>

      <div className="pricing-form-group" style={{ marginTop: '16px' }}>
        <label className="pricing-form-label">Notes</label>
        <textarea
          className="pricing-form-input"
          rows={2}
          value={item.notes || ''}
          readOnly={readOnly}
          onChange={e => onChange('notes', e.target.value)}
          style={{ resize: 'vertical' }}
        />
      </div>
    </>
  );
}

// --- Labour Tab ---
function DrawerLabourTab({
  item,
  readOnly,
  onChange,
}: {
  item: PricingItem;
  readOnly: boolean;
  onChange: (key: keyof PricingItem, val: unknown) => void;
}) {
  const calc = calculatePricing(item);
  const L = calc.labour;

  return (
    <>
      <div className="pricing-form-section">
        <HardHat size={16} /> Labour Breakdown — Per Unit
      </div>

      <div className="labour-card">
        <div className="labour-card-title">Manpower Allocation</div>
        <div className="labour-grid">
          <div className="labour-grid-header">Role</div>
          <div className="labour-grid-header">Hours</div>
          <div className="labour-grid-header">Count</div>
          <div className="labour-grid-header">Rate (AED/hr)</div>
          <div className="labour-grid-header">Total</div>

          {/* Technician */}
          <div className="labour-grid-role">Technician</div>
          <div className="labour-grid-num">
            {readOnly ? item.labour_technician_hours : (
              <input className="pricing-inline-input" type="number" step="0.25" value={item.labour_technician_hours} onChange={e => onChange('labour_technician_hours', parseFloat(e.target.value) || 0)} />
            )}
          </div>
          <div className="labour-grid-num">
            {readOnly ? item.labour_technician_count : (
              <input className="pricing-inline-input" type="number" step="1" value={item.labour_technician_count} onChange={e => onChange('labour_technician_count', parseFloat(e.target.value) || 0)} />
            )}
          </div>
          <div className="labour-grid-num">
            {readOnly ? formatAED(item.labour_technician_rate) : (
              <input className="pricing-inline-input" type="number" step="0.5" value={item.labour_technician_rate} onChange={e => onChange('labour_technician_rate', parseFloat(e.target.value) || 0)} />
            )}
          </div>
          <div className="labour-grid-total">{formatAED(L.technician.total)}</div>

          {/* Engineer */}
          <div className="labour-grid-role">Engineer</div>
          <div className="labour-grid-num">
            {readOnly ? item.labour_engineer_hours : (
              <input className="pricing-inline-input" type="number" step="0.25" value={item.labour_engineer_hours} onChange={e => onChange('labour_engineer_hours', parseFloat(e.target.value) || 0)} />
            )}
          </div>
          <div className="labour-grid-num">
            {readOnly ? item.labour_engineer_count : (
              <input className="pricing-inline-input" type="number" step="1" value={item.labour_engineer_count} onChange={e => onChange('labour_engineer_count', parseFloat(e.target.value) || 0)} />
            )}
          </div>
          <div className="labour-grid-num">
            {readOnly ? formatAED(item.labour_engineer_rate) : (
              <input className="pricing-inline-input" type="number" step="0.5" value={item.labour_engineer_rate} onChange={e => onChange('labour_engineer_rate', parseFloat(e.target.value) || 0)} />
            )}
          </div>
          <div className="labour-grid-total">{formatAED(L.engineer.total)}</div>

          {/* PM */}
          <div className="labour-grid-role">Project Manager</div>
          <div className="labour-grid-num">
            {readOnly ? item.labour_pm_hours : (
              <input className="pricing-inline-input" type="number" step="0.25" value={item.labour_pm_hours} onChange={e => onChange('labour_pm_hours', parseFloat(e.target.value) || 0)} />
            )}
          </div>
          <div className="labour-grid-num">
            {readOnly ? item.labour_pm_count : (
              <input className="pricing-inline-input" type="number" step="1" value={item.labour_pm_count} onChange={e => onChange('labour_pm_count', parseFloat(e.target.value) || 0)} />
            )}
          </div>
          <div className="labour-grid-num">
            {readOnly ? formatAED(item.labour_pm_rate) : (
              <input className="pricing-inline-input" type="number" step="0.5" value={item.labour_pm_rate} onChange={e => onChange('labour_pm_rate', parseFloat(e.target.value) || 0)} />
            )}
          </div>
          <div className="labour-grid-total">{formatAED(L.pm.total)}</div>

          {/* Helper */}
          <div className="labour-grid-role">Helper</div>
          <div className="labour-grid-num">
            {readOnly ? item.labour_helper_hours : (
              <input className="pricing-inline-input" type="number" step="0.25" value={item.labour_helper_hours} onChange={e => onChange('labour_helper_hours', parseFloat(e.target.value) || 0)} />
            )}
          </div>
          <div className="labour-grid-num">
            {readOnly ? item.labour_helper_count : (
              <input className="pricing-inline-input" type="number" step="1" value={item.labour_helper_count} onChange={e => onChange('labour_helper_count', parseFloat(e.target.value) || 0)} />
            )}
          </div>
          <div className="labour-grid-num">
            {readOnly ? formatAED(item.labour_helper_rate) : (
              <input className="pricing-inline-input" type="number" step="0.5" value={item.labour_helper_rate} onChange={e => onChange('labour_helper_rate', parseFloat(e.target.value) || 0)} />
            )}
          </div>
          <div className="labour-grid-total">{formatAED(L.helper.total)}</div>
        </div>

        <div className="labour-summary">
          <div className="labour-summary-item">
            <div className="labour-summary-label">Raw Total</div>
            <div className="labour-summary-value">{formatAED(L.raw_total)}</div>
          </div>
          <div className="labour-summary-item">
            <div className="labour-summary-label">Productivity ×</div>
            <div className="labour-summary-value">
              {readOnly ? L.productivity_factor.toFixed(2) : (
                <input
                  className="pricing-inline-input"
                  type="number"
                  step="0.05"
                  value={item.labour_productivity_factor}
                  onChange={e => onChange('labour_productivity_factor', parseFloat(e.target.value) || 1)}
                  style={{ width: '80px', textAlign: 'center' }}
                />
              )}
            </div>
          </div>
          <div className="labour-summary-item">
            <div className="labour-summary-label">Site Factor ×</div>
            <div className="labour-summary-value">
              {readOnly ? L.site_factor.toFixed(2) : (
                <input
                  className="pricing-inline-input"
                  type="number"
                  step="0.05"
                  value={item.labour_site_factor}
                  onChange={e => onChange('labour_site_factor', parseFloat(e.target.value) || 1)}
                  style={{ width: '80px', textAlign: 'center' }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="cost-buildup" style={{ marginTop: '16px' }}>
        <div className="cost-buildup-row total">
          <span className="label">Adjusted Labour Cost</span>
          <span className="value">{formatAED(L.adjusted_total)}</span>
        </div>
      </div>
    </>
  );
}

// --- Labour Detail Row Sub-Component ---
function LabourDetailRow({
  label,
  hoursKey,
  countKey,
  rateKey,
  hours,
  count,
  rate,
  total,
  readOnly,
  onChange,
}: {
  label: string;
  hoursKey: keyof PricingItem;
  countKey: keyof PricingItem;
  rateKey: keyof PricingItem;
  hours: number;
  count: number;
  rate: number;
  total: number;
  readOnly: boolean;
  onChange: (key: keyof PricingItem, val: unknown) => void;
}) {
  return (
    <div className="labour-detail-row">
      <span className="role-label">{label}</span>
      <div className="col-input">
        {readOnly ? (
          <span className="mono">{hours}h</span>
        ) : (
          <input 
            type="number" 
            className="pricing-inline-input" 
            step="0.25"
            value={hours}
            onChange={e => onChange(hoursKey, parseFloat(e.target.value) || 0)}
          />
        )}
      </div>
      <div className="col-input">
        {readOnly ? (
          <span className="mono">{count}</span>
        ) : (
          <input 
            type="number" 
            className="pricing-inline-input" 
            step="1"
            value={count}
            onChange={e => onChange(countKey, parseInt(e.target.value) || 0)}
          />
        )}
      </div>
      <div className="col-input">
        {readOnly ? (
          <span className="mono">{formatAED(rate)}</span>
        ) : (
          <input 
            type="number" 
            className="pricing-inline-input" 
            step="0.5"
            value={rate}
            onChange={e => onChange(rateKey, parseFloat(e.target.value) || 0)}
          />
        )}
      </div>
      <span className="total-val mono">{formatAED(total)}</span>
    </div>
  );
}

// --- Pricing Tab ---
function DrawerPricingTab({
  item,
  readOnly,
  onChange,
  templates,
}: {
  item: PricingItem;
  readOnly: boolean;
  onChange: (key: keyof PricingItem, val: unknown) => void;
  templates: PricingTemplate[];
}) {
  const calc = calculatePricing(item);
  const [labourExpanded, setLabourExpanded] = useState(false);

  const applyTemplate = (tmpl: PricingTemplate) => {
    onChange('overhead_pct', tmpl.overhead_pct);
    onChange('gna_pct', tmpl.gna_pct);
    onChange('contingency_pct', tmpl.contingency_pct);
    onChange('markup_pct', tmpl.markup_pct);
  };

  const totalManHours = (item.labour_technician_hours * item.labour_technician_count) +
                         (item.labour_engineer_hours * item.labour_engineer_count) +
                         (item.labour_pm_hours * item.labour_pm_count) +
                         (item.labour_helper_hours * item.labour_helper_count);

  return (
    <>
      <div className="pricing-form-section">
        <DollarSign size={16} /> Cost Inputs
      </div>

      <div className="pricing-form-row-3">
        <FieldNum label="Material Cost (AED)" value={item.material_cost} readOnly={readOnly} onChange={v => onChange('material_cost', v)} />
        <FieldNum label="Subcon Cost (AED)" value={item.subcon_cost} readOnly={readOnly} onChange={v => onChange('subcon_cost', v)} />
        <div className="pricing-form-group">
          <label className="pricing-form-label">Labour Cost (computed)</label>
          <input className="pricing-form-input mono" value={formatAED(calc.labour_cost)} readOnly style={{ color: 'var(--p-cyan)' }} />
        </div>
      </div>

      <div className="pricing-form-section">
        <Wrench size={16} /> Percentages
      </div>

      {!readOnly && templates.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <label className="pricing-form-label">Apply Template</label>
          <select
            className="pricing-filter-select"
            style={{ width: '100%' }}
            value=""
            onChange={e => {
              const tmpl = templates.find(t => t.id === e.target.value);
              if (tmpl) applyTemplate(tmpl);
            }}
          >
            <option value="">Select a template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.template_name} (OH {t.overhead_pct}% / G&A {t.gna_pct}% / C {t.contingency_pct}% / M {t.markup_pct}%)
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="pricing-form-row-4">
        <FieldNum label="Overhead %" value={item.overhead_pct} readOnly={readOnly} onChange={v => onChange('overhead_pct', v)} />
        <FieldNum label="G&A %" value={item.gna_pct} readOnly={readOnly} onChange={v => onChange('gna_pct', v)} />
        <FieldNum label="Contingency %" value={item.contingency_pct} readOnly={readOnly} onChange={v => onChange('contingency_pct', v)} />
        <FieldNum label="Markup %" value={item.markup_pct} readOnly={readOnly} onChange={v => onChange('markup_pct', v)} />
      </div>

      <div className="pricing-form-section">
        <Calculator size={16} /> Cost Build-Up & Rate Analysis
      </div>

      <div className="cost-buildup">
        <div className="cost-buildup-row">
          <span className="label">Material Cost</span>
          <span className="value">{formatAED(calc.material_cost)}</span>
        </div>

        {/* Expandable Labour Breakdown Inset */}
        <div 
          className={`cost-buildup-row labour-toggle-row ${labourExpanded ? 'expanded' : ''}`}
          onClick={() => setLabourExpanded(!labourExpanded)}
          style={{ cursor: 'pointer' }}
        >
          <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ChevronRight 
              size={13} 
              style={{ 
                transform: labourExpanded ? 'rotate(90deg)' : 'rotate(0deg)', 
                transition: 'transform 0.2s',
                color: 'var(--p-cyan)'
              }} 
            />
            Labour Cost (adjusted)
          </span>
          <span className="value" style={{ color: 'var(--p-cyan)' }}>{formatAED(calc.labour_cost)}</span>
        </div>

        {labourExpanded && (
          <div className="labour-expandable-panel boq-animate-in">
            <div className="labour-expandable-header">
              <span>Resource Role</span>
              <span>Hours</span>
              <span>Count</span>
              <span>Rate/hr</span>
              <span className="text-right">Total (AED)</span>
            </div>
            
            <LabourDetailRow 
              label="Technician" 
              hoursKey="labour_technician_hours" 
              countKey="labour_technician_count" 
              rateKey="labour_technician_rate"
              hours={item.labour_technician_hours} 
              count={item.labour_technician_count} 
              rate={item.labour_technician_rate} 
              total={calc.labour.technician.total} 
              readOnly={readOnly} 
              onChange={onChange} 
            />
            <LabourDetailRow 
              label="Engineer" 
              hoursKey="labour_engineer_hours" 
              countKey="labour_engineer_count" 
              rateKey="labour_engineer_rate"
              hours={item.labour_engineer_hours} 
              count={item.labour_engineer_count} 
              rate={item.labour_engineer_rate} 
              total={calc.labour.engineer.total} 
              readOnly={readOnly} 
              onChange={onChange} 
            />
            <LabourDetailRow 
              label="Project Manager" 
              hoursKey="labour_pm_hours" 
              countKey="labour_pm_count" 
              rateKey="labour_pm_rate"
              hours={item.labour_pm_hours} 
              count={item.labour_pm_count} 
              rate={item.labour_pm_rate} 
              total={calc.labour.pm.total} 
              readOnly={readOnly} 
              onChange={onChange} 
            />
            <LabourDetailRow 
              label="Helper" 
              hoursKey="labour_helper_hours" 
              countKey="labour_helper_count" 
              rateKey="labour_helper_rate"
              hours={item.labour_helper_hours} 
              count={item.labour_helper_count} 
              rate={item.labour_helper_rate} 
              total={calc.labour.helper.total} 
              readOnly={readOnly} 
              onChange={onChange} 
            />

            <div className="labour-factors-section">
              <div className="factor-row">
                <span className="factor-label">Gross Labour</span>
                <span className="mono">{formatAED(calc.labour.raw_total)}</span>
              </div>
              <div className="factor-row">
                <span className="factor-label">Productivity Factor</span>
                {readOnly ? (
                  <span className="mono">{item.labour_productivity_factor.toFixed(2)}x</span>
                ) : (
                  <input 
                    type="number" 
                    className="pricing-inline-input text-right" 
                    style={{ width: '60px' }}
                    step="0.05"
                    value={item.labour_productivity_factor}
                    onChange={e => onChange('labour_productivity_factor', parseFloat(e.target.value) || 1)}
                  />
                )}
              </div>
              <div className="factor-row">
                <span className="factor-label">Labour Site Factor</span>
                {readOnly ? (
                  <span className="mono">{item.labour_site_factor.toFixed(2)}x</span>
                ) : (
                  <input 
                    type="number" 
                    className="pricing-inline-input text-right" 
                    style={{ width: '60px' }}
                    step="0.05"
                    value={item.labour_site_factor}
                    onChange={e => onChange('labour_site_factor', parseFloat(e.target.value) || 1)}
                  />
                )}
              </div>
              <div className="factor-row final-labour">
                <span className="factor-label">Total Labour Cost</span>
                <span className="mono text-cyan">{formatAED(calc.labour_cost)}</span>
              </div>
              <div className="factor-row total-hours">
                <span className="factor-label">Total Man-Hours</span>
                <span className="mono">{totalManHours.toFixed(2)} hrs</span>
              </div>
            </div>
          </div>
        )}

        <div className="cost-buildup-row">
          <span className="label">Subcon Cost</span>
          <span className="value">{formatAED(calc.subcon_cost)}</span>
        </div>
        <div className="cost-buildup-row total">
          <span className="label">Direct Cost</span>
          <span className="value">{formatAED(calc.direct_cost)}</span>
        </div>

        <div className="cost-buildup-row" style={{ marginTop: '8px' }}>
          <span className="label">Overhead ({formatPct(item.overhead_pct)})</span>
          <span className="value">{formatAED(calc.overhead_cost)}</span>
        </div>
        <div className="cost-buildup-row">
          <span className="label">G&A ({formatPct(item.gna_pct)})</span>
          <span className="value">{formatAED(calc.gna_cost)}</span>
        </div>
        <div className="cost-buildup-row">
          <span className="label">Contingency ({formatPct(item.contingency_pct)})</span>
          <span className="value">{formatAED(calc.contingency_cost)}</span>
        </div>
        <div className="cost-buildup-row total">
          <span className="label">Total Cost</span>
          <span className="value">{formatAED(calc.total_cost)}</span>
        </div>

        <div className="cost-buildup-row" style={{ marginTop: '8px' }}>
          <span className="label">Markup ({formatPct(item.markup_pct)})</span>
          <span className="value" style={{ color: 'var(--p-orange)' }}>{formatAED(calc.markup_value)}</span>
        </div>
        <div className="cost-buildup-row total">
          <span className="label">Sell Price (excl. VAT)</span>
          <span className="value">{formatAED(calc.sell_price)}</span>
        </div>

        <div className="cost-buildup-row">
          <span className="label">VAT (5%)</span>
          <span className="value">{formatAED(calc.vat_amount)}</span>
        </div>
        <div className="cost-buildup-row grand">
          <span className="label">Total with VAT</span>
          <span className="value">{formatAED(calc.total_with_vat)}</span>
        </div>
      </div>
    </>
  );
}

// ============================================================
// Reusable Fields
// ============================================================

function Field({
  label,
  value,
  readOnly = false,
  mono = false,
  onChange,
}: {
  label: string;
  value: string;
  readOnly?: boolean;
  mono?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="pricing-form-group">
      <label className="pricing-form-label">{label}</label>
      <input
        className={`pricing-form-input ${mono ? 'mono' : ''}`}
        value={value}
        readOnly={readOnly}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function FieldNum({
  label,
  value,
  readOnly = false,
  onChange,
}: {
  label: string;
  value: number;
  readOnly?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="pricing-form-group">
      <label className="pricing-form-label">{label}</label>
      <input
        className="pricing-form-input mono"
        type="number"
        step="0.01"
        value={value}
        readOnly={readOnly}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  readOnly = false,
  options,
  onChange,
}: {
  label: string;
  value: string;
  readOnly?: boolean;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  if (readOnly) {
    const display = options.find(o => o.value === value)?.label || value;
    return (
      <div className="pricing-form-group">
        <label className="pricing-form-label">{label}</label>
        <input className="pricing-form-input" value={display} readOnly />
      </div>
    );
  }
  return (
    <div className="pricing-form-group">
      <label className="pricing-form-label">{label}</label>
      <select className="pricing-filter-select" style={{ width: '100%' }} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// --- Helper: blank item ---
function createBlankItem(): PricingItem {
  return {
    id: '',
    item_code: '',
    system: 'CCTV',
    category: '',
    sub_category: null,
    description: '',
    short_name: null,
    unit: 'EA',
    spec_reference: null,
    brand: null,
    part_number: null,
    supplier: null,
    material_cost: 0,
    sell_price: 0,
    vat_amount: 0,
    total_with_vat: 0,
    price_tier: 'standard',
    lead_time_days: 0,
    warranty_months: 12,
    is_active: true,
    is_locked: false,
    is_deleted: false,
    review_date: null,
    last_price_change: null,
    usage_count: 0,
    last_used_on_project: null,
    tags: [],
    notes: null,
    client_facing_notes: null,
    labour_technician_rate: 15,
    labour_engineer_rate: 25,
    labour_pm_rate: 45,
    labour_helper_rate: 8,
    labour_technician_hours: 0,
    labour_engineer_hours: 0,
    labour_pm_hours: 0,
    labour_helper_hours: 0,
    labour_technician_count: 1,
    labour_engineer_count: 0,
    labour_pm_count: 0,
    labour_helper_count: 0,
    labour_productivity_factor: 1,
    labour_site_factor: 1,
    labour_cost_computed: 0,
    overhead_pct: 15,
    gna_pct: 8,
    contingency_pct: 5,
    markup_pct: 20,
    subcon_cost: 0,
    created_at: '',
    updated_at: '',
    created_by: null,
    updated_by: null,
  };
}
