// ============================================================
// JEET ERP — Document Template Service
// Visual templates with {{variables}}, headers, footers,
// watermarks, QR placeholders and signature blocks.
// Renders to print-ready HTML consumable by any module.
// ============================================================

import { supabase } from '@/lib/supabase';
import { recordAudit } from '@/lib/audit/recordAudit';
import { renderTemplate } from '@/lib/workflow/engine';
import settingsService from '@/services/settingsService';
import type { DocumentTemplate, TemplateContent } from '@/types/platform.types';

export const DEFAULT_TEMPLATE_CONTENT: TemplateContent = {
  header: { show_logo: true, title: '', subtitle: '', show_qr: false },
  body_html: '<h2>{{DocumentTitle}}</h2>\n<p>Document No: <strong>{{DocumentNo}}</strong></p>\n<p>Date: {{Date}}</p>\n<p>Project: {{ProjectName}}</p>\n<p>Client: {{ClientName}}</p>',
  footer: { text: '', show_page_numbers: true },
  watermark: { enabled: false, text: 'DRAFT' },
  signature_blocks: [{ label: 'Prepared By' }, { label: 'Reviewed By' }, { label: 'Approved By' }],
  variables: ['DocumentTitle', 'DocumentNo', 'Date', 'ProjectName', 'ClientName', 'PreparedBy'],
};

export const templateService = {
  async getTemplates(): Promise<DocumentTemplate[]> {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .order('module_key')
      .order('name');
    if (error) throw error;
    return data as DocumentTemplate[];
  },

  async getTemplate(idOrKey: string): Promise<DocumentTemplate | null> {
    const isUuid = /^[0-9a-f]{8}-/.test(idOrKey);
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq(isUuid ? 'id' : 'template_key', idOrKey)
      .maybeSingle();
    if (error) throw error;
    return data as DocumentTemplate | null;
  },

  async createTemplate(input: {
    template_key: string;
    name: string;
    module_key?: string;
    description?: string;
  }): Promise<DocumentTemplate> {
    const { data, error } = await supabase
      .from('document_templates')
      .insert({ ...input, content: DEFAULT_TEMPLATE_CONTENT })
      .select()
      .single();
    if (error) throw error;

    await recordAudit({
      action: 'CREATE', entity_type: 'DOCUMENT_TEMPLATE', entity_id: data.id,
      entity_label: input.name, summary: `Created document template '${input.name}' (${input.template_key})`,
      module: 'SYSTEM',
    });
    return data as DocumentTemplate;
  },

  async updateTemplate(id: string, patch: Partial<Pick<DocumentTemplate, 'name' | 'description' | 'content' | 'paper_size' | 'orientation' | 'is_active' | 'module_key'>>): Promise<void> {
    const { error } = await supabase
      .from('document_templates')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase.from('document_templates').delete().eq('id', id);
    if (error) throw error;
  },

  async cloneTemplate(id: string): Promise<DocumentTemplate> {
    const src = await this.getTemplate(id);
    if (!src) throw new Error('Template not found');
    const { data, error } = await supabase
      .from('document_templates')
      .insert({
        template_key: `${src.template_key}_COPY_${Date.now().toString(36)}`,
        name: `${src.name} (copy)`,
        module_key: src.module_key,
        description: src.description,
        content: src.content,
        paper_size: src.paper_size,
        orientation: src.orientation,
        version: src.version + 1,
        is_active: false,
      })
      .select()
      .single();
    if (error) throw error;
    return data as DocumentTemplate;
  },

  /**
   * Renders a template to a complete print-ready HTML page.
   * Variables resolve from the supplied map; company branding
   * resolves from company settings automatically.
   */
  async renderToHtml(template: DocumentTemplate, variables: Record<string, unknown>): Promise<string> {
    const company = await settingsService.getCompanyProfile().catch(() => null);
    const c = template.content || DEFAULT_TEMPLATE_CONTENT;

    const vars: Record<string, unknown> = {
      CompanyName: company?.company_name || '',
      CompanyAddress: company?.address || '',
      CompanyPhone: company?.phone || '',
      CompanyEmail: company?.email || '',
      CompanyTRN: company?.trn || '',
      Date: new Date().toLocaleDateString('en-AE'),
      ...variables,
    };

    const headerTitle = renderTemplate(c.header?.title || '', vars);
    const headerSubtitle = renderTemplate(c.header?.subtitle || '', vars);
    const body = renderTemplate(c.body_html || '', vars);
    const footerText = renderTemplate(c.footer?.text || '', vars);

    const logo = c.header?.show_logo && company?.logo_url
      ? `<img src="${company.logo_url}" alt="logo" style="height:48px;object-fit:contain;" />`
      : '';

    const watermark = c.watermark?.enabled
      ? `<div style="position:fixed;top:40%;left:0;right:0;text-align:center;transform:rotate(-30deg);font-size:96px;color:rgba(0,0,0,0.06);font-weight:700;pointer-events:none;z-index:0;">${escapeHtml(c.watermark.text || '')}</div>`
      : '';

    const signatures = (c.signature_blocks || []).map(b => `
      <div style="flex:1;min-width:140px;">
        <div style="border-top:1px solid #333;margin-top:56px;padding-top:6px;font-size:11px;color:#333;">
          ${escapeHtml(renderTemplate(b.label, vars))}
        </div>
      </div>`).join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(headerTitle || template.name)}</title>
<style>
  @page { size: ${template.paper_size} ${template.orientation}; margin: 18mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; font-size: 12.5px; line-height: 1.55; margin: 0; position: relative; }
  table { width: 100%; border-collapse: collapse; }
  table.data th, table.data td { border: 1px solid #ccc; padding: 6px 9px; font-size: 11.5px; text-align: left; }
  table.data th { background: #f3f4f6; }
  h1,h2,h3 { margin: 0 0 8px; }
</style>
</head>
<body>
${watermark}
<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1a1a1a;padding-bottom:12px;margin-bottom:18px;position:relative;z-index:1;">
  <div style="display:flex;align-items:center;gap:14px;">
    ${logo}
    <div>
      <div style="font-size:17px;font-weight:700;">${escapeHtml(headerTitle || company?.company_name || '')}</div>
      <div style="font-size:11px;color:#555;">${escapeHtml(headerSubtitle)}</div>
    </div>
  </div>
  ${c.header?.show_qr ? '<div style="width:64px;height:64px;border:1px solid #999;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999;">QR</div>' : ''}
</div>
<div style="position:relative;z-index:1;">${body}</div>
<div style="display:flex;gap:24px;margin-top:32px;position:relative;z-index:1;">${signatures}</div>
<div style="border-top:1px solid #ccc;margin-top:28px;padding-top:8px;font-size:10px;color:#777;display:flex;justify-content:space-between;position:relative;z-index:1;">
  <span>${escapeHtml(footerText)}</span>
  ${c.footer?.show_page_numbers ? '<span>Page 1</span>' : ''}
</div>
</body>
</html>`;
  },

  /** Opens a rendered template in a new window for print/PDF. */
  async print(templateKey: string, variables: Record<string, unknown>): Promise<void> {
    const tpl = await this.getTemplate(templateKey);
    if (!tpl) throw new Error(`Template '${templateKey}' not found`);
    const html = await this.renderToHtml(tpl, variables);
    const w = window.open('', '_blank');
    if (!w) throw new Error('Popup blocked — allow popups to print documents');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default templateService;
