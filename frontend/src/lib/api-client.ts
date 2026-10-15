import {
  InvestigationCreate,
  InvestigationResponse,
  ExecutionEvent,
  EvidenceRecord,
  InvestigationReportResponse,
  MarineObservation,
  Hazard,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

class ApiClient {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const headers = {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // Not JSON
      }
      throw new Error(
        errorJson?.detail || errorJson?.message || `Request failed with status ${response.status}: ${errorText}`
      );
    }

    return response.json();
  }

  async healthCheck(): Promise<any> {
    return this.request<any>("/health");
  }

  async createInvestigation(data: InvestigationCreate): Promise<InvestigationResponse> {
    return this.request<InvestigationResponse>("/investigations", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getInvestigation(id: string): Promise<InvestigationResponse> {
    return this.request<InvestigationResponse>(`/investigations/${id}`);
  }

  async getInvestigationEvents(id: string): Promise<ExecutionEvent[]> {
    return this.request<ExecutionEvent[]>(`/investigations/${id}/events`);
  }

  async getInvestigationEvidence(id: string): Promise<EvidenceRecord[]> {
    return this.request<EvidenceRecord[]>(`/investigations/${id}/evidence`);
  }

  async getInvestigationReport(id: string): Promise<InvestigationReportResponse> {
    return this.request<InvestigationReportResponse>(`/investigations/${id}/report`);
  }

  async getMarineObservations(params?: {
    latitude?: number;
    longitude?: number;
    variable?: string;
    radius_km?: number;
  }): Promise<{ count: number; items: MarineObservation[] }> {
    const searchParams = new URLSearchParams();
    if (params?.latitude !== undefined) searchParams.append("latitude", params.latitude.toString());
    if (params?.longitude !== undefined) searchParams.append("longitude", params.longitude.toString());
    if (params?.variable) searchParams.append("variable", params.variable);
    if (params?.radius_km) searchParams.append("radius_km", params.radius_km.toString());

    const qs = searchParams.toString();
    return this.request<{ count: number; items: MarineObservation[] }>(
      `/marine/observations${qs ? `?${qs}` : ""}`
    );
  }

  async getHazards(params?: {
    hazard_type?: string;
    basin?: string;
    active_only?: boolean;
    limit?: number;
  }): Promise<{ count: number; items: Hazard[] }> {
    const searchParams = new URLSearchParams();
    if (params?.hazard_type) searchParams.append("hazard_type", params.hazard_type);
    if (params?.basin) searchParams.append("basin", params.basin);
    if (params?.active_only !== undefined) searchParams.append("active_only", params.active_only.toString());
    if (params?.limit !== undefined) searchParams.append("limit", params.limit.toString());

    const qs = searchParams.toString();
    return this.request<{ count: number; items: Hazard[] }>(`/hazards${qs ? `?${qs}` : ""}`);
  }
}

export const apiClient = new ApiClient();
