'use client';

// ============================================================
// JEET ERP — Pre-Sales: Competitor Tracking
// Competitor register + per-tender competitive log (who won, their
// estimated price, why we lost) + competitive intelligence.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import competitorService, { Competitor, TenderCompetitor, CompetitorType } from '@/services/competitorService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Swords, Plus, FileDown, Sheet, Trash2, Pencil, Trophy } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
const TYPES: CompetitorType[] = ['CONTRACTOR', 'ELV_SPECIALIST', 'SUPPLIER', 'CONSULTANT', 'OTHER'];

export default function CompetitorTrackingPage() {
  const [userName, setUserName] = useState<string | null>(null);
  const [tab, setTab] = useState<'directory' | 'log'>('directory');
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [entries, setEntries] = useState<TenderCompetitor[]>([]);
  const [tenders, setTenders] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // competitor modal
  const [cModal, setCModal] = useState(false); const [cEditId, setCEditId] = useState<string | null>(null);
  const [cForm, setCForm] = useState({ name: '', type: 'CONTRACTOR' as CompetitorType, location: '', strengths: '', weaknesses: '', notes: '' });
  // entry modal
  const [eModal, setEModal] = useState(false); const [eEditId, setEEditId] = useState<string | null>(null);
  const [eForm, setEForm] = useState({ tender_id: '', competitor_id: '', estimated_price: '', is_winner: false, reason_for_loss: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserName((data.user?.user_metadata?.name as string) || data.user?.email || null));
    supabase.from('tenders').select('id, title, project_name, client_name').order('created_at', { ascending: false })
      .then(({ data }) => setTenders((data || []).map((t: any) => ({ id: t.id, label: `${t.title || t.project_name} — ${t.client_name || ''}` }))));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { const [c, e] = await Promise.all([competitorService.listCompetitors(), competitorService.listTenderCompetitors()]); setCompetitors(c); setEntries(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // competitor CRUD
  const openCNew = () => { setCEditId(null); setCForm({ name: '', type: 'CONTRACTOR', location: '', strengths: '', weaknesses: '', notes: '' }); setCModal(true); };
  const openCEdit = (c: Competitor) => { setCEditId(c.id); setCForm({ name: c.name, type: c.type, location: c.location || '', strengths: c.strengths || '', weaknesses: c.weaknesses || '', notes: c.notes || '' }); setCModal(true); };
  const saveC = async () => {
    if (!cForm.name.trim()) { alert('Competitor name is required.'); return; }
    setSaving(true);
    try { if (cEditId) await competitorService.updateCompetitor(cEditId, cForm as any); else await competitorService.createCompetitor({ ...cForm, name: cForm.name.trim(), created_by_name: userName } as any); setCModal(false); await load(); }
    catch (e: any) { alert(e?.message || 'Save failed — apply the competitor_tracking migration.'); } finally { setSaving(false); }
  };
  const delC = async (c: Competitor) => { if (!confirm(`Remove competitor "${c.name}"?`)) return; await competitorService.removeCompetitor(c.id); await load(); };

  // entry CRUD
  const openENew = () => { setEEditId(null); setEForm({ tender_id: '', competitor_id: '', estimated_price: '', is_winner: false, reason_for_loss: '', notes: '' }); setEModal(true); };
  const openEEdit = (e: TenderCompetitor) => { setEEditId(e.id); setEForm({ tender_id: e.tender_id, competitor_id: e.competitor_id, estimated_price: String(e.estimated_price), is_winner: e.is_winner, reason_for_loss: e.reason_for_loss || '', notes: e.notes || '' }); setEModal(true); };
  const saveE = async () => {
    if (!eForm.tender_id || !eForm.competitor_id) { alert('Select a tender and competitor.'); return; }
    setSaving(true);
    try {
      const patch = { estimated_price: Number(eForm.estimated_price) || 0, is_winner: eForm.is_winner, reason_for_loss: eForm.reason_for_loss.trim() || null, notes: eForm.notes.trim() || null };
      if (eEditId) await competitorService.updateTenderCompetitor(eEditId, patch as any);
      else await competitorService.addTenderCompetitor({ ...patch, tender_id: eForm.tender_id, competitor_id: eForm.competitor_id, created_by_name: userName } as any);
      setEModal(false); await load();
    } catch (e: any) { alert(e?.message || 'Save failed — apply the competitor_tracking migration.'); } finally { setSaving(false); }
  };
  const delE = async (e: TenderCompetitor) => { if (!confirm('Remove this competitive entry?')) return; await competitorService.removeTenderCompetitor(e.id); await load(); };

  const lostTo = entries.filter(e => e.is_winner);
  const valueLost = lostTo.reduce((s, e) => s + Number(e.estimated_price || 0), 0);
  const winsByComp = useMemo(() => [...competitors].filter(c => (c.wins || 0) > 0).sort((a, b) => (b.wins || 0) - (a.wins || 0)).slice(0, 8).map(c => ({ name: c.name.slice(0, 16), wins: c.wins || 0 })), [competitors]);
  const reasons = useMemo(() => { const m = new Map<string, number>(); lostTo.forEach(e => { const r = (e.reason_for_loss || 'Unspecified').trim() || 'Unspecified'; m.set(r, (m.get(r) || 0) + 1); }); return [...m.entries()].map(([name, count]) => ({ name: name.slice(0, 24), count })).sort((a, b) => b.count - a.count).slice(0, 8); }, [lostTo]);
  const topComp = winsByComp[0];

  const cCols = ['Competitor', 'Type', 'Location', 'Bids', 'Jobs won vs us', 'Value won'];
  const cRows = competitors.map(c => [c.name, c.type, c.location || '', c.bids || 0, c.wins || 0, c.value_won || 0]);
  const eCols = ['Tender', 'Client', 'Competitor', 'Est. price', 'Winner', 'Reason for loss'];
  const eRows = entries.map(e => [e.tender_label || '', e.tender_client || '', e.competitor_name || '', e.estimated_price, e.is_winner ? 'Yes' : '', e.reason_for_loss || '']);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Competitor Tracking"
        subtitle="Who won the job, their estimated price, and why we lost"
        breadcrumbs={[{ label: 'Pre-Sales', href: '/sales' }, { label: 'Competitors' }]}
        actions={
          <div className="flex gap-2">
            {tab === 'directory' ? <>
              {competitors.length > 0 && <>
                <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Competitors', columns: cCols, rows: cRows, fileName: 'competitors' })}>PDF</Button>
                <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Competitors', columns: cCols, rows: cRows, fileName: 'competitors' })}>Excel</Button>
              </>}
              <Button icon={Plus} onClick={openCNew}>Add competitor</Button>
            </> : <>
              {entries.length > 0 && <>
                <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Competitive Log', columns: eCols, rows: eRows, fileName: 'competitive-log' })}>PDF</Button>
                <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Competitive Log', columns: eCols, rows: eRows, fileName: 'competitive-log' })}>Excel</Button>
              </>}
              <Button icon={Plus} onClick={openENew}>Log competitor on tender</Button>
            </>}
          </div>
        }
      />

      {/* Intelligence KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Competitors tracked</div><div className="text-2xl font-bold mt-1">{competitors.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Jobs lost to competitors</div><div className="text-2xl font-bold mt-1" style={{ color: lostTo.length ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{lostTo.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Value lost</div><div className="text-lg font-bold mt-1" style={{ color: 'var(--status-danger-text)' }}>{aed(valueLost)}</div></Card>
        <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Toughest competitor</div><div className="text-sm font-semibold mt-1 line-clamp-1 flex items-center gap-1">{topComp ? <><Trophy size={13} className="text-[var(--status-warning-text)]" />{topComp.name}</> : '—'}</div><div className="text-[11px] text-[var(--text-tertiary)]">{topComp ? `${topComp.wins} win(s)` : ''}</div></Card>
      </div>

      {(winsByComp.length > 0 || reasons.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Jobs won against us by competitor</div>
            <div style={{ width: '100%', height: 230 }}>
              <ResponsiveContainer>
                {winsByComp.length ? (
                  <BarChart data={winsByComp} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip />
                    <Bar dataKey="wins" fill="var(--status-danger-text)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                ) : <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">No recorded wins yet</div>}
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Reasons for losing</div>
            <div style={{ width: '100%', height: 230 }}>
              <ResponsiveContainer>
                {reasons.length ? (
                  <BarChart data={reasons} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--status-warning-text)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                ) : <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">No loss reasons recorded</div>}
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {(['directory', 'log'] as const).map(tk => (
          <button key={tk} onClick={() => setTab(tk)} className="px-4 py-2 text-sm font-medium border-b-2 -mb-px" style={{ borderColor: tab === tk ? 'var(--accent)' : 'transparent', color: tab === tk ? 'var(--accent)' : 'var(--text-tertiary)' }}>
            {tk === 'directory' ? 'Competitors' : 'Competitive log'}
          </button>
        ))}
      </div>

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : tab === 'directory' ? (
        competitors.length === 0 ? (
          <Card><EmptyState icon={Swords} title="No competitors" description="Add competitors you bid against. (Apply the competitor_tracking migration if saving fails.)" /></Card>
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Competitor</th><th className="p-3">Type</th><th className="p-3">Location</th><th className="p-3 text-right">Bids</th><th className="p-3 text-right">Won vs us</th><th className="p-3 text-right">Value won</th><th className="p-3"></th>
              </tr></thead>
              <tbody>
                {competitors.map(c => (
                  <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{c.name}</div>{c.strengths && <div className="text-[11px] text-[var(--text-tertiary)] line-clamp-1">+ {c.strengths}</div>}</td>
                    <td className="p-3 text-xs">{c.type.replace('_', ' ')}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{c.location || '—'}</td>
                    <td className="p-3 text-right tabular-nums">{c.bids || 0}</td>
                    <td className="p-3 text-right tabular-nums font-medium" style={{ color: (c.wins || 0) > 0 ? 'var(--status-danger-text)' : 'var(--text-tertiary)' }}>{c.wins || 0}</td>
                    <td className="p-3 text-right tabular-nums">{c.value_won ? aed(c.value_won) : '—'}</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button onClick={() => openCEdit(c)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent)]"><Pencil size={15} /></button>
                      <button onClick={() => delC(c)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--status-danger-text)]"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      ) : (
        entries.length === 0 ? (
          <Card><EmptyState icon={Swords} title="No competitive entries" description="Log which competitors bid on each tender, their price and the outcome." /></Card>
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Tender</th><th className="p-3">Competitor</th><th className="p-3 text-right">Est. price</th><th className="p-3">Outcome</th><th className="p-3">Reason for loss</th><th className="p-3"></th>
              </tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)] line-clamp-1">{e.tender_label}</div><div className="text-[11px] text-[var(--text-tertiary)]">{e.tender_client}</div></td>
                    <td className="p-3 text-[var(--text-secondary)]">{e.competitor_name}</td>
                    <td className="p-3 text-right tabular-nums">{e.estimated_price ? aed(e.estimated_price) : '—'}</td>
                    <td className="p-3">{e.is_winner ? <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)' }}><Trophy size={10} />Won the job</span> : <span className="text-[11px] text-[var(--text-tertiary)]">Bid</span>}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)] line-clamp-1">{e.reason_for_loss || '—'}</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button onClick={() => openEEdit(e)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent)]"><Pencil size={15} /></button>
                      <button onClick={() => delE(e)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--status-danger-text)]"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      )}

      {/* Competitor modal */}
      {cModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCModal(false)}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="text-base font-semibold mb-3">{cEditId ? 'Edit competitor' : 'New competitor'}</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-[var(--text-secondary)]">Name<input value={cForm.name} onChange={e => setCForm(f => ({ ...f, name: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)]">Type<select value={cForm.type} onChange={e => setCForm(f => ({ ...f, type: e.target.value as CompetitorType }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">{TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Location<input value={cForm.location} onChange={e => setCForm(f => ({ ...f, location: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Strengths<input value={cForm.strengths} onChange={e => setCForm(f => ({ ...f, strengths: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Weaknesses<input value={cForm.weaknesses} onChange={e => setCForm(f => ({ ...f, weaknesses: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Notes<textarea value={cForm.notes} onChange={e => setCForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full mt-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
            </div>
            <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setCModal(false)}>Cancel</Button><Button onClick={saveC} isLoading={saving}>{cEditId ? 'Save' : 'Add'}</Button></div>
          </div>
        </div>
      )}

      {/* Entry modal */}
      {eModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEModal(false)}>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="text-base font-semibold mb-3">{eEditId ? 'Edit competitive entry' : 'Log competitor on tender'}</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Tender<select value={eForm.tender_id} disabled={!!eEditId} onChange={e => setEForm(f => ({ ...f, tender_id: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm disabled:opacity-60"><option value="">Select…</option>{tenders.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Competitor<select value={eForm.competitor_id} disabled={!!eEditId} onChange={e => setEForm(f => ({ ...f, competitor_id: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm disabled:opacity-60"><option value="">Select…</option>{competitors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="text-xs text-[var(--text-secondary)]">Estimated price (AED)<input type="number" value={eForm.estimated_price} onChange={e => setEForm(f => ({ ...f, estimated_price: e.target.value }))} className="w-full mt-1 px-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
              <label className="text-xs text-[var(--text-secondary)] flex items-end gap-2 pb-1"><input type="checkbox" checked={eForm.is_winner} onChange={e => setEForm(f => ({ ...f, is_winner: e.target.checked }))} /> This competitor won the job</label>
              <label className="text-xs text-[var(--text-secondary)] col-span-2">Reason for loss<textarea value={eForm.reason_for_loss} onChange={e => setEForm(f => ({ ...f, reason_for_loss: e.target.value }))} rows={2} placeholder="e.g. Lower price, incumbent relationship, faster delivery…" className="w-full mt-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" /></label>
            </div>
            <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setEModal(false)}>Cancel</Button><Button onClick={saveE} isLoading={saving}>{eEditId ? 'Save' : 'Log'}</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
