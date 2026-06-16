// JEET ERP — Document sharing with version control + comments
import { supabase } from '@/lib/supabase';
import type { SharedDocument, DocumentVersion, DocumentComment } from '@/types/comms.types';

const BUCKET = 'documents';

async function nameMap(ids: (string | null)[]) {
  const uniq = [...new Set(ids.filter(Boolean))] as string[];
  if (!uniq.length) return new Map<string, string>();
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', uniq);
  return new Map((data || []).map((p: any) => [p.id, p.full_name as string]));
}

export const commDocsService = {
  async list(): Promise<SharedDocument[]> {
    const { data, error } = await supabase.from('shared_documents').select('*').eq('is_archived', false).order('updated_at', { ascending: false });
    if (error) return [];
    const rows = (data || []) as SharedDocument[];
    const ids = rows.map(r => r.id);
    const [{ data: vers }, { data: cmts }] = await Promise.all([
      ids.length ? supabase.from('document_versions').select('document_id') as any : Promise.resolve({ data: [] }),
      ids.length ? supabase.from('document_comments').select('document_id') as any : Promise.resolve({ data: [] }),
    ]);
    const vc = new Map<string, number>(); (vers || []).forEach((v: any) => vc.set(v.document_id, (vc.get(v.document_id) || 0) + 1));
    const cc = new Map<string, number>(); (cmts || []).forEach((c: any) => cc.set(c.document_id, (cc.get(c.document_id) || 0) + 1));
    const nm = await nameMap(rows.map(r => r.owner_id));
    return rows.map(d => ({ ...d, owner_name: d.owner_id ? nm.get(d.owner_id) : undefined, version_count: vc.get(d.id) || 1, comment_count: cc.get(d.id) || 0 }));
  },

  async getVersions(documentId: string): Promise<DocumentVersion[]> {
    const { data } = await supabase.from('document_versions').select('*').eq('document_id', documentId).order('version', { ascending: false });
    const rows = (data || []) as DocumentVersion[];
    const nm = await nameMap(rows.map(r => r.uploaded_by));
    return rows.map(v => ({ ...v, uploaded_by_name: v.uploaded_by ? nm.get(v.uploaded_by) : undefined }));
  },

  async getComments(documentId: string): Promise<DocumentComment[]> {
    const { data } = await supabase.from('document_comments').select('*').eq('document_id', documentId).order('created_at', { ascending: true });
    const rows = (data || []) as DocumentComment[];
    const nm = await nameMap(rows.map(r => r.user_id));
    return rows.map(c => ({ ...c, user_name: c.user_id ? nm.get(c.user_id) : undefined }));
  },

  async upload(file: File, ownerId: string): Promise<string | null> {
    const path = `COMMS_DOCS/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file);
    return error ? null : path;
  },

  async create(p: { title: string; description?: string; ownerId: string; path: string; mime: string; size: number; note?: string }): Promise<SharedDocument | null> {
    const { data, error } = await supabase.from('shared_documents').insert({
      title: p.title, description: p.description || null, owner_id: p.ownerId, storage_path: p.path,
      mime_type: p.mime, size_bytes: p.size, current_version: 1,
    }).select().single();
    if (error || !data) return null;
    await supabase.from('document_versions').insert({ document_id: data.id, version: 1, storage_path: p.path, size_bytes: p.size, note: p.note || 'Initial version', uploaded_by: p.ownerId });
    return data as SharedDocument;
  },

  async addVersion(documentId: string, p: { path: string; size: number; note?: string; uploadedBy: string }): Promise<void> {
    const { data: doc } = await supabase.from('shared_documents').select('current_version').eq('id', documentId).limit(1);
    const next = ((doc?.[0]?.current_version as number) || 0) + 1;
    await supabase.from('document_versions').insert({ document_id: documentId, version: next, storage_path: p.path, size_bytes: p.size, note: p.note || null, uploaded_by: p.uploadedBy });
    await supabase.from('shared_documents').update({ current_version: next, storage_path: p.path, size_bytes: p.size, updated_at: new Date().toISOString() }).eq('id', documentId);
  },

  async addComment(documentId: string, userId: string, body: string): Promise<void> {
    await supabase.from('document_comments').insert({ document_id: documentId, user_id: userId, body });
  },

  async signedUrl(path: string): Promise<string | null> {
    if (!path) return null;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  },
};
