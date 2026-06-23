// ============================================================
// AURA 0.2 — Intelligence Layer type contracts
// The intelligence layer reads events and emits Risk Alerts,
// Recommendations and Insights. It never writes to CORE tables.
// ============================================================

export type Engine = 'RISK' | 'MARGIN' | 'FORECAST';
export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
export type RiskDomain = 'FINANCE' | 'PROCUREMENT' | 'PROJECT' | 'COMPLIANCE' | 'SUPPLY' | 'HR' | 'GENERAL';
/** Lifecycle transitions a user can request on a risk alert. */
export type RiskAction = 'acknowledge' | 'resolve' | 'dismiss';

/**
 * One explainable contributor to a risk score. The alert's score is the sum of
 * its factors' `impact` (clamped 0-100), so every score is fully traceable.
 */
export interface RiskFactor {
  key: string;
  value: number | string | boolean | null;
  impact: number;     // points this factor added to the score
  label?: string;     // human-readable
}
export type RecPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type RecStatus = 'PENDING' | 'ACCEPTED' | 'DISMISSED' | 'DONE';

/** Normalised event handed to the engines (from public.system_events). */
export interface IngestEvent {
  id: string;
  event_type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  project_id?: string | null;
  company_id?: string | null;
  payload: Record<string, any>;
  created_at: string;
}

/** Shared context every engine output carries back to the source event. */
export interface SourceContext {
  company_id: string | null;
  source_event_id: string;
  source_event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  project_id: string | null;
}

// ---- Insert shapes (status/id/created_at filled by DB defaults) ----
export interface NewRiskAlert extends SourceContext {
  engine: 'RISK';
  risk_domain: RiskDomain;
  severity: RiskSeverity;
  score: number;          // 0-100, drives severity
  category: string;
  dedup_key: string;      // company:scope:event_type — one active alert per key
  title: string;
  detail: string;
  confidence: number;
  factors: RiskFactor[];  // explainable score breakdown
}

export interface NewRecommendation extends SourceContext {
  engine: Engine;
  action_type: string;
  priority: RecPriority;
  title: string;
  detail: string;
  rationale: string;
  expected_impact: Record<string, any>;
}

export interface NewInsight extends SourceContext {
  engine: Engine;
  kind: string;
  title: string;
  detail: string;
  metrics: Record<string, any>;
  confidence: number;
}

export interface EngineOutput {
  riskAlerts: NewRiskAlert[];
  recommendations: NewRecommendation[];
  insights: NewInsight[];
}

// ---- Row shapes (as read back from the DB) ----
export interface RiskAlertRow extends NewRiskAlert {
  id: string;
  status: RiskStatus;
  occurrence_count: number;
  created_at: string;
  updated_at: string | null;
  last_event_at: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  status_changed_by: string | null;
  resolution_note: string | null;
}

/** Canonical persisted risk alert (alias of the DB row shape). */
export type RiskAlert = RiskAlertRow;
export interface RecommendationRow extends NewRecommendation {
  id: string;
  status: RecStatus;
  created_at: string;
}
export interface InsightRow extends NewInsight {
  id: string;
  created_at: string;
}
