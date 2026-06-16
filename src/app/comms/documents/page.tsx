'use client';

// ============================================================
// JEET ERP — Shared Documents (version control + comments)
// Upload, version, comment and download shared files. Additive;
// uses the existing "documents" storage bucket.
// ============================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { commDocsService } from '@/services/commDocsService';
import type { SharedDocument, DocumentVersion, DocumentComment } from '@/types/comms.types';
import { FileText, Upload, X, History, MessageSquare, Download, Send, Loader2 } from 'lucide-react';

const fmtSize = (b?: number) => !b ? '—' : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
const initials = (n?: string) => (n || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

export default function SharedDocumentsPage() {
  const [docs, setDocs] = useState<SharedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState<SharedDocument | null>(null);

  const load = async () => { setDocs(await commDocsService.list()); setLoading(false); };
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id || null)); load(); }, []);

  const onUpload = async (file: File) => {
    if (!meId) return; setUploading(true);
    try {
      const path = await commDocsService.upload(file, meId);
      if (!path) { alert('Upload failed.'); return; }
      const doc = await commDocsService.create({ title: file.name, ownerId: meId, path, mime: file.type, size: file.size });
      if (doc) load(); else alert('Could not save — apply the comms migration first.');
    } finally { setUploading(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Shared Documents" subtitle="Versioned file sharing with comments"
        breadcrumbs={[{ label: 'Communication', href: '/comms' }, { label: 'Documents' }]}
        actions={<label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-white cursor-pointer" style={{ background: 'var(--accent)' }}>{uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Upload<input type="file" className="hidden" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} /></label>} />

      {loading ? <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
        : docs.length === 0 ? <Card><EmptyState icon={FileText} title="No shared documents" description="Upload a file to share it with version history and comments." /></Card>
          : (
            <Card className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Document</th><th className="p-3">Owner</th><th className="p-3">Version</th><th className="p-3">Size</th><th className="p-3">Comments</th><th className="p-3">Updated</th></tr></thead>
                <tbody>
                  {docs.map(d => (
                    <tr key={d.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => setOpen(d)}>
                      <td className="p-3 font-medium text-[var(--text-primary)] flex items-center gap-2"><FileText size={15} className="text-[var(--accent)]" />{d.title}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{d.owner_name || '—'}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">v{d.current_version} <span className="text-[var(--text-tertiary)]">({d.version_count})</span></td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{fmtSize(d.size_bytes)}</td>
                      <td className="p-3 text-xs text-[var(--text-secondary)]">{d.comment_count || 0}</td>
                      <td className="p-3 text-xs text-[var(--text-tertiary)]">{new Date(d.updated_at).toLocaleDateString('en-AE')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

      {open && <DocDrawer doc={open} meId={meId} close={() => { setOpen(null); load(); }} />}
    </div>
  );
}

function DocDrawer({ doc, meId, close }: { doc: SharedDocument; meId: string | null; close: () => void }) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false);
  const load = async () => { const [v, c] = await Promise.all([commDocsService.getVersions(doc.id), commDocsService.getComments(doc.id)]); setVersions(v); setComments(c); };
  useEffect(() => { load(); }, [doc.id]);

  const download = async (path: string | null) => { if (!path) return; const url = await commDocsService.signedUrl(path); if (url) window.open(url, '_blank'); };
  const newVersion = async (file: File) => {
    if (!meId) return; setBusy(true);
    const path = await commDocsService.upload(file, meId);
    if (path) { await commDocsService.addVersion(doc.id, { path, size: file.size, note: file.name, uploadedBy: meId }); await load(); }
    setBusy(false);
  };
  const comment = async () => { if (!text.trim() || !meId) return; await commDocsService.addComment(doc.id, meId, text.trim()); setText(''); await load(); };

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end" onClick={close}>
      <div className="absolute inset-0 bg-slate-900/40" />
      <div className="relative w-full max-w-md bg-[var(--surface)] border-l border-[var(--border)] h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-[var(--border)] flex items-start justify-between sticky top-0 bg-[var(--surface)] z-10">
          <div className="min-w-0"><div className="flex items-center gap-2"><FileText size={16} className="text-[var(--accent)]" /><h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{doc.title}</h3></div><div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{doc.owner_name} · v{doc.current_version} · {fmtSize(doc.size_bytes)}</div></div>
          <button onClick={close}><X size={18} className="text-[var(--text-tertiary)]" /></button>
        </div>
        <div className="p-4 flex flex-col gap-5">
          <div className="flex gap-2">
            <Button variant="primary" icon={Download} onClick={() => download(doc.storage_path)}>Download latest</Button>
            <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border border-[var(--border)] cursor-pointer text-[var(--text-secondary)]">{busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} New version<input type="file" className="hidden" onChange={e => e.target.files?.[0] && newVersion(e.target.files[0])} /></label>
          </div>

          <div>
            <div className="text-xs font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-1.5"><History size={14} /> Version history ({versions.length})</div>
            <div className="flex flex-col gap-1.5">
              {versions.map(v => (
                <div key={v.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)]">
                  <div><div className="text-sm font-medium text-[var(--text-primary)]">v{v.version}{v.note ? <span className="text-xs text-[var(--text-tertiary)] font-normal"> · {v.note}</span> : ''}</div><div className="text-[10px] text-[var(--text-tertiary)]">{v.uploaded_by_name || '—'} · {new Date(v.created_at).toLocaleString('en-AE', { dateStyle: 'short', timeStyle: 'short' })}</div></div>
                  <button onClick={() => download(v.storage_path)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"><Download size={14} /></button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-1.5"><MessageSquare size={14} /> Comments ({comments.length})</div>
            <div className="flex flex-col gap-2 mb-2">
              {comments.map(c => (
                <div key={c.id} className="flex gap-2">
                  <span className="h-7 w-7 rounded-full grid place-items-center text-[10px] font-bold text-white shrink-0" style={{ background: 'var(--accent)' }}>{initials(c.user_name)}</span>
                  <div className="flex-1 min-w-0"><div className="text-xs"><span className="font-semibold text-[var(--text-primary)]">{c.user_name || 'Unknown'}</span> <span className="text-[10px] text-[var(--text-tertiary)]">{new Date(c.created_at).toLocaleString('en-AE', { dateStyle: 'short', timeStyle: 'short' })}</span></div><div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{c.body}</div></div>
                </div>
              ))}
              {comments.length === 0 && <div className="text-xs text-[var(--text-tertiary)]">No comments yet.</div>}
            </div>
            <div className="flex gap-2">
              <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && comment()} placeholder="Add a comment…" className="flex-1 h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm" />
              <button onClick={comment} className="h-9 w-9 grid place-items-center rounded-lg text-white" style={{ background: 'var(--accent)' }}><Send size={15} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
