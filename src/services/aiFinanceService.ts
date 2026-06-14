// ============================================================
// JEET ERP — Finance: AI Finance Agent (Phase 1, rule-based)
// Risk scoring + recommendations over existing finance data. No
// external LLM yet — deterministic heuristics with confidence
// scores, ready to be swapped for a model later. Read-only.
// ============================================================

import { supabase } from '@/lib/supabase';
import executiveFinanceService from './executiveFinanceService';

export interface AiRecommendation {
  action: 'COLLECT' | 'DELAY_PAYMENT' | 'REVIEW_PROJECT' | 'REPLENISH' | 'WATCH';
  title: string; detail: string; amount?: number; confidence: number; // 0..1
}
export interface AiRisk { level: 'danger' | 'warning'; title: string; detail: string; }
export interface AiInsights {
  riskScore: number;        // 0..100 (higher = riskier)
  riskLabel: 'Low' | 'Medium' | 'High';
  kpis: { currentCash: number; forecastCash: number; expectedCollections: number; expectedPayments: number; netProfit: number; projectsAtRisk: number };
  risks: AiRisk[];
  recommendations: AiRecommendation[];
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const safe = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>, fb: T): Promise<T> => {
  try { const { data } = await p; return data ?? fb; } catch { return fb; }
};

export const aiFinanceService = {
  async getInsights(): Promise<AiInsights> {
    const exec = await executiveFinanceService.getDashboard();
    const today = new Date().toISOString().slice(0, 10);

    // Overdue receivables (collection candidates)
    const ar = await safe<any[]>(supabase.from('client_invoices')
      .select('invoice_number, client_name, total_incl_vat, amount_paid, due_date, status')
      .in('status', ['APPROVED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE']).lt('due_date', today), []);
    const overdue = ar.map(i => ({ ...i, outstanding: r2((Number(i.total_incl_vat) || 0) - (Number(i.amount_paid) || 0)),
      days: Math.floor((Date.now() - new Date(i.due_date).getTime()) / 86400000) }))
      .filter(i => i.outstanding > 0.01).sort((a, b) => b.outstanding - a.outstanding);
    const overdueTotal = r2(overdue.reduce((s, i) => s + i.outstanding, 0));

    // Payments due soon (delay candidates if cash is tight)
    const apSoon = await safe<any[]>(supabase.from('supplier_invoices')
      .select('supplier_invoice_number, total, amount_paid, due_date, status')
      .in('status', ['APPROVED', 'SCHEDULED', 'REGISTERED']).gte('due_date', today), []);
    const dueSoon = apSoon.map(i => ({ ...i, outstanding: r2((Number(i.total) || 0) - (Number(i.amount_paid) || 0)) }))
      .filter(i => i.outstanding > 0.01).sort((a, b) => b.outstanding - a.outstanding);

    // Risk score (0..100)
    let score = 0;
    const k = exec.kpis;
    if (k.forecastCash < 0) score += 30;
    else if (k.forecastCash < k.expectedPayments * 0.25) score += 15;
    const arRatio = k.expectedCollections > 0 ? overdueTotal / k.expectedCollections : 0;
    score += Math.min(25, Math.round(arRatio * 25));
    score += Math.min(25, k.projectsAtRisk * 8);
    if (exec.alerts.some(a => a.title.includes('vendor'))) score += 10;
    if (k.netProfit < 0) score += 10;
    score = Math.min(100, score);
    const riskLabel = score >= 60 ? 'High' : score >= 30 ? 'Medium' : 'Low';

    // Recommendations
    const recs: AiRecommendation[] = [];
    for (const i of overdue.slice(0, 4)) {
      recs.push({ action: 'COLLECT', title: `Chase ${i.client_name}`, amount: i.outstanding,
        detail: `Invoice ${i.invoice_number} is ${i.days} days overdue — collect ${r2(i.outstanding)} AED.`,
        confidence: Math.min(0.95, 0.6 + i.days / 200) });
    }
    if ((k.forecastCash < 0 || score >= 60) && dueSoon.length) {
      const top = dueSoon[0];
      recs.push({ action: 'DELAY_PAYMENT', title: 'Re-time a large payment', amount: top.outstanding,
        detail: `Cash is tight — consider deferring ${top.supplier_invoice_number} (${r2(top.outstanding)} AED) until collections land.`, confidence: 0.7 });
    }
    for (const p of exec.topProjects.filter(p => p.margin < 0).slice(0, 3)) {
      recs.push({ action: 'REVIEW_PROJECT', title: `Review project ${p.project_number}`, amount: p.margin,
        detail: `Forecast margin is negative (${r2(p.margin)} AED) — review scope, cost and variations.`, confidence: 0.75 });
    }
    if (recs.length === 0) recs.push({ action: 'WATCH', title: 'Healthy position', detail: 'No urgent collection, payment or project risks detected.', confidence: 0.6 });

    return {
      riskScore: score, riskLabel,
      kpis: { currentCash: k.currentCash, forecastCash: k.forecastCash, expectedCollections: k.expectedCollections, expectedPayments: k.expectedPayments, netProfit: k.netProfit, projectsAtRisk: k.projectsAtRisk },
      risks: exec.alerts, recommendations: recs,
    };
  },
};

export default aiFinanceService;
