export type WorkspaceType =
  | "fisherman"
  | "marine-monitoring"
  | "protected-areas"
  | "coastal-authority"
  | "disaster-management";

export type VerificationState =
  | "verified"
  | "unverified"
  | "needs_review"
  | "conflicting"
  | "insufficient_evidence";

export interface EvidenceRecord {
  id: string;
  dataset_id: string;
  source_name: string;
  source_url?: string;
  retrieval_time: string;
  observation_time?: string;
  valid_until_time?: string;
  latitude?: number;
  longitude?: number;
  coverage_area?: string;
  variable?: string;
  value?: any;
  unit?: string;
  quality_flag?: string;
  license?: string;
  metadata?: Record<string, any>;
}

export interface Finding {
  id: string;
  claim: string;
  value?: any;
  unit?: string;
  evidence_ids: string[];
  uncertainty?: string;
  is_forecast?: boolean;
  observation_time?: string;
  metadata?: Record<string, any>;
}

export interface VerificationResult {
  overall_state: VerificationState;
  verified_claims_count: number;
  unverified_claims_count: number;
  notes: string;
  details: Array<{
    finding_id: string;
    state: string;
    reason: string;
  }>;
}

export interface LocationContext {
  latitude: number;
  longitude: number;
  name?: string;
  radius_km?: number;
}

export interface TimeWindow {
  start_time?: string;
  end_time?: string;
}

export interface InvestigationCreate {
  workspace: string;
  query: string;
  location?: LocationContext;
  time_window?: TimeWindow;
  preferred_agents?: string[];
}

export interface ExecutionEvent {
  id: string;
  investigation_id: string;
  agent_id?: string;
  event_type: string;
  payload?: Record<string, any>;
  timestamp: string;
}

export interface InvestigationResponse {
  investigation_id: string;
  workspace: string;
  status: string;
  query: string;
  summary?: string;
  location?: LocationContext;
  time_window?: TimeWindow;
  findings: Finding[];
  verification_summary?: VerificationResult;
  limitations: string[];
  created_at: string;
  completed_at?: string;
}

export interface InvestigationReportResponse {
  investigation_id: string;
  title: string;
  workspace: string;
  generated_at: string;
  markdown_content: string;
  findings_count: number;
  evidence_count: number;
  verification_summary?: VerificationResult;
  limitations: string[];
}

export interface MarineObservation {
  id: string;
  dataset_id: string;
  variable: string;
  value: number;
  unit: string;
  latitude: number;
  longitude: number;
  observation_time: string;
  retrieval_time: string;
  is_forecast: boolean;
  quality_flag?: string;
  metadata?: Record<string, any>;
}

export interface HazardTrackPoint {
  time: string;
  latitude: number;
  longitude: number;
  wind_speed_knots?: number;
  pressure_hpa?: number;
  category?: string;
  is_forecast: boolean;
}

export interface Hazard {
  hazard_id: string;
  name: string;
  type: string;
  source: string;
  basin?: string;
  status: string;
  first_observed?: string;
  last_observed?: string;
  track_points: HazardTrackPoint[];
}
