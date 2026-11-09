import {
  GDACSStatusResponse,
  GDACSSyncResponse,
  HazardEvent,
  HazardFilterState,
  HazardListResponse,
  HazardStatsResponse,
  HazardTrackResponse,
} from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

class HazardDemoApiClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        errorMessage = errorJson.detail || errorMessage;
      } catch {
        // Fallback to text
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async fetchHazardList(filters: HazardFilterState): Promise<HazardListResponse> {
    const params = new URLSearchParams();
    if (filters.search?.trim()) params.append("search", filters.search.trim());
    if (filters.basin && filters.basin !== "all") params.append("basin", filters.basin);
    if (filters.category && filters.category !== "all") params.append("category", filters.category);
    if (filters.sortBy) params.append("sort_by", filters.sortBy);
    if (filters.sortOrder) params.append("sort_order", filters.sortOrder);
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.limit) params.append("limit", filters.limit.toString());
    // Historical storms filter
    params.append("status", "historical");
    params.append("include_tracks", "false");

    const qs = params.toString();
    return this.request<HazardListResponse>(`/hazards${qs ? `?${qs}` : ""}`);
  }

  async fetchActiveLiveAlerts(): Promise<HazardEvent[]> {
    const response = await this.request<HazardListResponse>(
      "/hazards?status=active&include_tracks=true&limit=50&sort_by=last_observed&sort_order=desc"
    );
    return response.items;
  }

  async syncGdacsLiveAlerts(): Promise<GDACSSyncResponse> {
    return this.request<GDACSSyncResponse>("/hazards/sync/gdacs", {
      method: "POST",
    });
  }

  async fetchGdacsStatus(): Promise<GDACSStatusResponse> {
    return this.request<GDACSStatusResponse>("/hazards/sync/gdacs/status");
  }

  async fetchHazardDetail(hazardId: string): Promise<HazardEvent> {
    return this.request<HazardEvent>(`/hazards/${encodeURIComponent(hazardId)}`);
  }

  async fetchHazardTrack(hazardId: string): Promise<HazardTrackResponse> {
    return this.request<HazardTrackResponse>(`/hazards/${encodeURIComponent(hazardId)}/track`);
  }

  async fetchHazardStats(hazardId: string): Promise<HazardStatsResponse> {
    return this.request<HazardStatsResponse>(`/hazards/${encodeURIComponent(hazardId)}/stats`);
  }

  // ===========================================================================
  // MARINE WAVE FORECASTS (Open-Meteo)
  // ===========================================================================

  async fetchMarineForecasts(
    latitude: number,
    longitude: number,
    radiusDeg: number = 0.5,
    limit: number = 72
  ): Promise<import("./types").MarineForecastResponse> {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radius_deg: radiusDeg.toString(),
      limit: limit.toString(),
    });
    return this.request<import("./types").MarineForecastResponse>(`/forecasts/marine?${params.toString()}`);
  }

  async fetchLatestMarineForecast(
    latitude: number,
    longitude: number
  ): Promise<import("./types").MarineForecastItem> {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
    });
    return this.request<import("./types").MarineForecastItem>(`/forecasts/marine/latest?${params.toString()}`);
  }

  async syncMarineForecasts(
    payload: import("./types").MarineForecastSyncRequest
  ): Promise<import("./types").MarineForecastSyncResponse> {
    return this.request<import("./types").MarineForecastSyncResponse>("/forecasts/marine/sync", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async fetchMarineProviderStatus(
    latitude?: number,
    longitude?: number
  ): Promise<import("./types").MarineProviderStatusResponse> {
    const params = new URLSearchParams();
    if (latitude !== undefined) params.append("latitude", latitude.toString());
    if (longitude !== undefined) params.append("longitude", longitude.toString());
    const qs = params.toString();
    return this.request<import("./types").MarineProviderStatusResponse>(
      `/forecasts/marine/status${qs ? `?${qs}` : ""}`
    );
  }

  // ===========================================================================
  // CYCLONE 5-DAY TRAJECTORY FORECASTS (NOAA NHC)
  // ===========================================================================

  async fetchCycloneForecastRuns(
    stormId?: string
  ): Promise<import("./types").CycloneForecastRunListResponse> {
    const qs = stormId ? `?storm_id=${encodeURIComponent(stormId)}` : "";
    return this.request<import("./types").CycloneForecastRunListResponse>(`/forecasts/cyclones/runs${qs}`);
  }

  async fetchCycloneForecastPositions(
    runId: string
  ): Promise<import("./types").CycloneForecastPositionItem[]> {
    return this.request<import("./types").CycloneForecastPositionItem[]>(
      `/forecasts/cyclones/runs/${encodeURIComponent(runId)}/positions`
    );
  }

  async fetchCycloneProviderStatus(): Promise<import("./types").CycloneProviderStatusResponse> {
    return this.request<import("./types").CycloneProviderStatusResponse>("/forecasts/cyclones/status");
  }

  async syncCycloneForecasts(): Promise<import("./types").CycloneForecastSyncResponse> {
    return this.request<import("./types").CycloneForecastSyncResponse>("/forecasts/cyclones/sync", {
      method: "POST",
    });
  }

  // ===========================================================================
  // MARINE HAZARD & FORECAST AGENT (P2-06)
  // ===========================================================================

  async analyzeHazardAgent(
    request: import("./types").HazardAgentAnalysisRequest
  ): Promise<import("./types").HazardAgentAnalysisResponse> {
    return this.request<import("./types").HazardAgentAnalysisResponse>("/hazards/agent/analyze", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async chatWithHazardAgent(
    request: import("./types").HazardAgentChatRequest
  ): Promise<import("./types").HazardAgentChatResponse> {
    return this.request<import("./types").HazardAgentChatResponse>("/hazards/agent/chat", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }
}

export const hazardApi = new HazardDemoApiClient();

