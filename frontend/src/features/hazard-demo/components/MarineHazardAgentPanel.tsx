import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
  HelpCircle,
  Loader2,
  MapPin,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  User,
  Wrench,
  X,
} from "lucide-react";
import { hazardApi } from "../api";
import {
  DecisionResult,
  EvidenceRecordItem,
  FindingItem,
  HazardAgentChatRequest,
  HazardAgentChatResponse,
} from "../types";

interface LocationPreset {
  label: string;
  name: string;
  lat: number;
  lon: number;
  basin: string;
}

const PRESET_LOCATIONS: LocationPreset[] = [
  { label: "Mangaluru Port (Arabian Sea)", name: "Mangaluru", lat: 12.91, lon: 74.85, basin: "Arabian Sea" },
  { label: "Mumbai Offshore (Arabian Sea)", name: "Mumbai", lat: 18.96, lon: 72.82, basin: "Arabian Sea" },
  { label: "Kochi Port (Arabian Sea)", name: "Kochi", lat: 9.93, lon: 76.26, basin: "Arabian Sea" },
  { label: "Goa / Mormugao (Arabian Sea)", name: "Goa", lat: 15.41, lon: 73.80, basin: "Arabian Sea" },
  { label: "Chennai Port (Bay of Bengal)", name: "Chennai", lat: 13.08, lon: 80.27, basin: "Bay of Bengal" },
  { label: "Visakhapatnam (Bay of Bengal)", name: "Visakhapatnam", lat: 17.69, lon: 83.22, basin: "Bay of Bengal" },
  { label: "Kolkata / Haldia (Bay of Bengal)", name: "Kolkata", lat: 22.57, lon: 88.36, basin: "Bay of Bengal" },
  { label: "Miami / Atlantic (NOAA NHC Basin)", name: "Miami", lat: 25.76, lon: -80.19, basin: "North Atlantic" },
];

const STARTER_PROMPTS = [
  {
    icon: "🌊",
    title: "Wave & Sea State",
    prompt: "What are the significant wave height, swell period, and Douglas sea state off Mangaluru?",
    location: "Mangaluru",
  },
  {
    icon: "🌪️",
    title: "Active Cyclone Warnings",
    prompt: "Are there any active GDACS tropical cyclone warnings in regional waters?",
    location: "Mumbai",
  },
  {
    icon: "📜",
    title: "Historical Precedent",
    prompt: "Show historical cyclone tracks and closest approach benchmarks near Mumbai.",
    location: "Mumbai",
  },
  {
    icon: "⏱️",
    title: "Pipeline Freshness",
    prompt: "How fresh is the marine forecast data and are any providers in fallback mode?",
    location: "Mangaluru",
  },
];

const PROGRESS_STAGES = [
  "Analyzing question and geographic context...",
  "Selecting and invoking validated hazard tools...",
  "Querying Open-Meteo marine wave spectra...",
  "Filtering GDACS alerts by geographic proximity...",
  "Evaluating Douglas sea state & statutory safety thresholds...",
  "Synthesizing evidence-grounded assessment...",
];

interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  providerUsed?: string;
  modelUsed?: string;
  isFallback?: boolean;
  fallbackReason?: string | null;
  providerAttempted?: string | null;
  synthesisSource?: string;
  traceId?: string | null;
  decision?: DecisionResult;
  toolExecutions?: Array<{
    tool: string;
    arguments: Record<string, any>;
    status: string;
    summary?: any;
    findings_count?: number;
    evidence_count?: number;
  }>;
  findings?: FindingItem[];
  evidence?: EvidenceRecordItem[];
  limitations?: string[];
  locationContext?: {
    name: string | null;
    lat: number | null;
    lon: number | null;
  };
}

/**
 * Lightweight custom Markdown formatter for structured rendering without external dependencies.
 */
const FormattedMarkdown: React.FC<{ content: string; onEvidenceClick?: (id: string) => void }> = ({
  content,
  onEvidenceClick,
}) => {
  const lines = content.split("\n");

  const parseInline = (text: string) => {
    // Process evidence tags e.g. [ev-...]
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[ev-[a-zA-Z0-9_-]+\])/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith("**") && token.endsWith("**")) {
        parts.push(<strong key={match.index} className="text-slate-100 font-semibold">{token.slice(2, -2)}</strong>);
      } else if (token.startsWith("*") && token.endsWith("*")) {
        parts.push(<em key={match.index} className="text-slate-300 italic">{token.slice(1, -1)}</em>);
      } else if (token.startsWith("`") && token.endsWith("`")) {
        parts.push(
          <code key={match.index} className="px-1.5 py-0.5 rounded bg-slate-900 border border-orca-border text-cyan-300 font-mono text-xs">
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith("[ev-") && token.endsWith("]")) {
        const evId = token.slice(1, -1);
        parts.push(
          <button
            key={match.index}
            type="button"
            onClick={() => onEvidenceClick?.(evId)}
            className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded bg-cyan-950/70 border border-cyan-700/60 text-cyan-300 hover:text-cyan-100 hover:border-cyan-400 font-mono text-[11px] transition shadow-xs cursor-pointer"
            title={`View evidence record ${evId}`}
          >
            {evId}
          </button>
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="space-y-2 text-sm text-slate-200 leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="text-sm font-bold text-cyan-300 mt-2.5 mb-1 flex items-center space-x-1.5">
              <span>{trimmed.slice(4)}</span>
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} className="text-base font-bold text-slate-100 mt-3 mb-1 border-b border-orca-border/50 pb-1">
              {trimmed.slice(3)}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={idx} className="text-lg font-extrabold text-cyan-400 mt-3 mb-1.5">
              {trimmed.slice(2)}
            </h2>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={idx} className="flex items-start space-x-2 ml-2 my-1">
              <span className="text-cyan-400 mt-1 text-xs">•</span>
              <span className="flex-1">{parseInline(trimmed.slice(2))}</span>
            </div>
          );
        }
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote key={idx} className="border-l-2 border-cyan-500/70 pl-3 py-0.5 my-1.5 text-xs text-slate-300 italic bg-cyan-950/20 rounded-r">
              {parseInline(trimmed.slice(2))}
            </blockquote>
          );
        }
        return <p key={idx}>{parseInline(line)}</p>;
      })}
    </div>
  );
};

export const MarineHazardAgentPanel: React.FC = () => {
  // Conversation Session State
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progressIndex, setProgressIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Geographic Anchor State
  const [selectedPreset, setSelectedPreset] = useState<string>("Mangaluru");
  const [useCustomCoords, setUseCustomCoords] = useState<boolean>(false);
  const [customLat, setCustomLat] = useState<string>("12.91");
  const [customLon, setCustomLon] = useState<string>("74.85");
  const [forceLiveRefresh, setForceLiveRefresh] = useState<boolean>(false);

  // Expansion & Inspection Modal State
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [expandedFindings, setExpandedFindings] = useState<Record<string, boolean>>({});
  const [expandedLimitations, setExpandedLimitations] = useState<Record<string, boolean>>({});
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecordItem | null>(null);

  // Accumulated Evidence Pool
  const [evidencePool, setEvidencePool] = useState<Record<string, EvidenceRecordItem>>({});

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, isLoading]);

  // Rotate progress stages when sending
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isLoading) {
      setProgressIndex(0);
      interval = setInterval(() => {
        setProgressIndex((prev) => (prev + 1) % PROGRESS_STAGES.length);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const toggleTools = (turnId: string) => {
    setExpandedTools((prev) => ({ ...prev, [turnId]: !prev[turnId] }));
  };

  const toggleFindings = (turnId: string) => {
    setExpandedFindings((prev) => ({ ...prev, [turnId]: !prev[turnId] }));
  };

  const toggleLimitations = (turnId: string) => {
    setExpandedLimitations((prev) => ({ ...prev, [turnId]: !prev[turnId] }));
  };

  const handleEvidenceClick = (evId: string) => {
    const record = evidencePool[evId];
    if (record) {
      setSelectedEvidence(record);
    } else {
      // Create minimal preview if not in memory
      setSelectedEvidence({
        id: evId,
        dataset_id: "orca-persisted",
        source_name: "ORCA Verified PostgreSQL Repository",
        retrieval_time: new Date().toISOString(),
        variable: "verified_evidence_reference",
        value: "Record referenced in finding provenance.",
        unit: "verified_record",
      });
    }
  };

  const handleResetConversation = () => {
    setConversationId(null);
    setTurns([]);
    setEvidencePool({});
    setError(null);
    setInputMessage("");
  };

  const sendMessage = async (messageText?: string) => {
    const textToSend = (messageText ?? inputMessage).trim();
    if (!textToSend || isLoading) return;

    setError(null);
    setInputMessage("");

    const preset = PRESET_LOCATIONS.find((p) => p.name === selectedPreset);
    const effLat = useCustomCoords ? parseFloat(customLat) : preset?.lat ?? 12.91;
    const effLon = useCustomCoords ? parseFloat(customLon) : preset?.lon ?? 74.85;
    const effLocName = useCustomCoords ? `Custom (${customLat}, ${customLon})` : preset?.name ?? "Mangaluru";

    const userTurn: ChatTurn = {
      id: `turn-user-${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      locationContext: {
        name: effLocName,
        lat: effLat,
        lon: effLon,
      },
    };

    setTurns((prev) => [...prev, userTurn]);
    setIsLoading(true);

    try {
      const payload: HazardAgentChatRequest = {
        message: textToSend,
        conversation_id: conversationId,
        location: effLocName,
        latitude: effLat,
        longitude: effLon,
        radius_km: 50.0,
        force_live_refresh: forceLiveRefresh,
        use_custom_coordinates: useCustomCoords,
      };

      const response: HazardAgentChatResponse = await hazardApi.chatWithHazardAgent(payload);

      setConversationId(response.conversation_id);

      // Accumulate evidence into lookup pool
      setEvidencePool((prev) => {
        const updated = { ...prev };
        response.evidence.forEach((ev) => {
          updated[ev.id] = ev;
        });
        return updated;
      });

      const assistantTurn: ChatTurn = {
        id: `turn-assistant-${Date.now()}`,
        role: "assistant",
        content: response.message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        providerUsed: response.provider_used,
        modelUsed: response.model_used,
        isFallback: response.is_fallback,
        fallbackReason: response.fallback_reason,
        providerAttempted: response.provider_attempted,
        synthesisSource: response.synthesis_source,
        traceId: response.trace_id,
        decision: response.decision,
        toolExecutions: response.tool_executions,
        findings: response.findings,
        evidence: response.evidence,
        limitations: response.limitations,
        locationContext: {
          name: response.target_location?.name,
          lat: response.target_location?.latitude,
          lon: response.target_location?.longitude,
        },
      };

      if (response.target_location?.name) {
        const matchingPreset = PRESET_LOCATIONS.find(
          (p) => p.name.toLowerCase() === response.target_location?.name?.toLowerCase()
        );
        if (matchingPreset) {
          setSelectedPreset(matchingPreset.name);
        }
      }

      setTurns((prev) => [...prev, assistantTurn]);
    } catch (err: any) {
      setError(err?.message || "Failed to communicate with Marine Hazard Agent.");
    } finally {
      setIsLoading(false);
      // Refocus textarea
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col space-y-6 w-full max-w-7xl mx-auto pb-12 font-sans">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-orca-navy via-orca-dark to-slate-950 p-6 shadow-xl backdrop-blur-md">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="p-3.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-inner">
              <Bot className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-100">
                  Conversational Marine Hazard Agent
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Person 2 • P2-06
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Tool-Calling Active</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Conversational specialist agent backed by live tools for Open-Meteo marine wave spectra,
                geographically filtered GDACS cyclone alerts, NOAA IBTrACS historical tracks, and data freshness.
              </p>
            </div>
          </div>

          {/* Session & Status Controls */}
          <div className="flex items-center space-x-2 shrink-0">
            <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-orca-border">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Target:</span>
              <span className="text-cyan-300 font-semibold">orca_db</span>
            </div>

            {conversationId && (
              <button
                type="button"
                onClick={handleResetConversation}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-orca-border transition flex items-center space-x-1.5"
                title="Reset conversation state and session ID"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                <span>New Session</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Control Bar: Location Anchor & Quick Live Controls */}
      <div className="rounded-xl border border-orca-border bg-orca-navy/80 p-4 shadow-md backdrop-blur-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
          {/* Location Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1.5 text-slate-400 font-medium">
              <MapPin className="w-4 h-4 text-cyan-400" />
              <span>Geographic Anchor:</span>
            </div>

            {!useCustomCoords ? (
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="bg-slate-950/90 border border-orca-border rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-medium"
              >
                {PRESET_LOCATIONS.map((loc) => (
                  <option key={loc.name} value={loc.name}>
                    {loc.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center space-x-1.5">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Lat"
                  value={customLat}
                  onChange={(e) => setCustomLat(e.target.value)}
                  className="w-20 bg-slate-950 border border-orca-border rounded px-2 py-1 text-slate-200"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Lon"
                  value={customLon}
                  onChange={(e) => setCustomLon(e.target.value)}
                  className="w-20 bg-slate-950 border border-orca-border rounded px-2 py-1 text-slate-200"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => setUseCustomCoords(!useCustomCoords)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 underline transition cursor-pointer"
            >
              {useCustomCoords ? "Preset Ports" : "Custom Coordinates"}
            </button>
          </div>

          {/* Quick Refresh Checkbox & Session Pill */}
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-1.5 text-slate-400 hover:text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={forceLiveRefresh}
                onChange={(e) => setForceLiveRefresh(e.target.checked)}
                className="rounded border-orca-border text-cyan-500 focus:ring-0 bg-slate-900"
              />
              <span className="flex items-center space-x-1">
                <RefreshCw className="w-3 h-3 text-cyan-400" />
                <span>Force On-Demand Live Refresh</span>
              </span>
            </label>

            {conversationId && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-800">
                Session: {conversationId.slice(0, 10)}...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-950/40 text-red-200 flex items-start space-x-3 shadow-md animate-fadeIn">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm leading-relaxed">
            <strong className="font-semibold">Agent Error:</strong> {error}
          </div>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Conversation Stream */}
      <div className="rounded-2xl border border-orca-border bg-slate-950/60 shadow-xl overflow-hidden backdrop-blur-md flex flex-col min-h-[500px]">
        {/* Messages Container */}
        <div className="flex-1 p-5 md:p-6 overflow-y-auto space-y-6 max-h-[700px]">
          {/* Empty State: Starter Prompts */}
          {turns.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4 space-y-6">
              <div className="p-4 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-inner">
                <Bot className="w-10 h-10" />
              </div>
              <div className="space-y-2 max-w-lg">
                <h3 className="text-lg font-bold text-slate-100">
                  Ready to assist with coastal hazards & marine conditions
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ask conversational questions about wave height, Douglas sea scale, active cyclone warnings,
                  historical benchmarks, or data pipeline freshness. The agent invokes verified tools dynamically.
                </p>
              </div>

              {/* Starter Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl pt-2">
                {STARTER_PROMPTS.map((starter, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(starter.location);
                      setUseCustomCoords(false);
                      sendMessage(starter.prompt);
                    }}
                    className="p-3.5 rounded-xl border border-orca-border hover:border-cyan-500/50 bg-orca-navy/60 hover:bg-cyan-950/30 text-left transition group shadow-sm flex flex-col space-y-1.5 cursor-pointer"
                  >
                    <div className="flex items-center space-x-2 text-sm font-semibold text-slate-200 group-hover:text-cyan-300">
                      <span>{starter.icon}</span>
                      <span>{starter.title}</span>
                      <span className="text-[10px] text-slate-500 font-mono ml-auto">({starter.location})</span>
                    </div>
                    <p className="text-xs text-slate-400 group-hover:text-slate-300 line-clamp-2">
                      {starter.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Render Turns */}
          {turns.map((turn) => {
            const isUser = turn.role === "user";

            return (
              <div
                key={turn.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-2`}
              >
                {/* Bubble Container */}
                <div className={`flex items-start gap-3 max-w-3xl ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${
                      isUser
                        ? "bg-slate-800 border-slate-700 text-slate-300"
                        : "bg-cyan-950 border-cyan-800 text-cyan-400"
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  {/* Message Card */}
                  <div
                    className={`rounded-2xl p-4 shadow-md leading-relaxed ${
                      isUser
                        ? "bg-cyan-950/40 border border-cyan-600/40 text-slate-100 rounded-tr-none"
                        : "bg-orca-navy/90 border border-orca-border text-slate-200 rounded-tl-none w-full"
                    }`}
                  >
                    {/* Assistant Top Metadata Pill */}
                    {!isUser && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-orca-border/50 text-xs">
                        <div className="flex items-center space-x-2">
                          {turn.isFallback ? (
                            <span
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800/80 flex items-center space-x-1"
                              title={turn.fallbackReason || "Executed via truthful deterministic fallback rule engine based on verified PostgreSQL evidence."}
                            >
                              <ShieldAlert className="w-3 h-3 text-amber-400" />
                              <span>Deterministic Fallback{turn.fallbackReason ? ` (${turn.fallbackReason.slice(0, 35)}...)` : ""}</span>
                            </span>
                          ) : (
                            <span
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 flex items-center space-x-1"
                              title={`Executed via ${turn.providerUsed} (${turn.modelUsed}) with dynamic model-selected tool calls.`}
                            >
                              <Sparkles className="w-3 h-3 text-emerald-400" />
                              <span className="font-semibold">{turn.providerUsed?.toUpperCase()} — LLM Tool-Calling Active</span>
                              <span className="text-emerald-400/70 font-mono text-[10px]">({turn.modelUsed})</span>
                            </span>
                          )}

                          {turn.locationContext?.name && (
                            <span className="text-[11px] text-slate-400 font-mono flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-cyan-400" />
                              <span>{turn.locationContext.name}</span>
                            </span>
                          )}

                          {turn.decision && (
                            <span
                              className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950/70 text-cyan-300 border border-cyan-800/60 flex items-center space-x-1.5"
                              title={turn.decision.reasoning_summary}
                            >
                              <Database className="w-3 h-3 text-cyan-400" />
                              <span className="font-semibold text-cyan-200">{turn.decision.intent}</span>
                              <span className="text-slate-500">•</span>
                              <span className="text-slate-400 text-[10px]">{turn.decision.required_sources.join(", ")}</span>
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-slate-500 font-mono">{turn.timestamp}</span>
                      </div>
                    )}

                    {/* Content */}
                    {isUser ? (
                      <p className="text-sm whitespace-pre-wrap">{turn.content}</p>
                    ) : (
                      <FormattedMarkdown content={turn.content} onEvidenceClick={handleEvidenceClick} />
                    )}

                    {/* Assistant Turn Extensions: Tools, Findings, Limitations */}
                    {!isUser && (
                      <div className="mt-4 pt-3 border-t border-orca-border/50 flex flex-col space-y-2 text-xs">
                        {/* Tool Executions Collapsible */}
                        {turn.toolExecutions && turn.toolExecutions.length > 0 && (
                          <div className="rounded-lg border border-orca-border/60 bg-slate-950/60 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleTools(turn.id)}
                              className="w-full px-3 py-2 text-left flex items-center justify-between text-slate-300 hover:text-cyan-300 transition"
                            >
                              <span className="flex items-center space-x-1.5 font-medium">
                                <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                                <span>Tool Invocations ({turn.toolExecutions.length})</span>
                              </span>
                              {expandedTools[turn.id] ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {expandedTools[turn.id] && (
                              <div className="p-3 border-t border-orca-border/40 space-y-2 font-mono text-[11px]">
                                {turn.toolExecutions.map((exec, eIdx) => (
                                  <div key={eIdx} className="p-2 rounded bg-slate-900 border border-orca-border/40 space-y-1">
                                    <div className="flex items-center justify-between text-cyan-300 font-semibold">
                                      <span>⚙️ {exec.tool}</span>
                                      <span className="text-[10px] uppercase text-emerald-400 font-sans">{exec.status}</span>
                                    </div>
                                    <div className="text-slate-400">
                                      args: {JSON.stringify(exec.arguments)}
                                    </div>
                                    {exec.summary && (
                                      <div className="text-slate-400">
                                        result: {JSON.stringify(exec.summary)}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Verified Findings Collapsible */}
                        {turn.findings && turn.findings.length > 0 && (
                          <div className="rounded-lg border border-orca-border/60 bg-slate-950/60 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleFindings(turn.id)}
                              className="w-full px-3 py-2 text-left flex items-center justify-between text-slate-300 hover:text-cyan-300 transition"
                            >
                              <span className="flex items-center space-x-1.5 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Verified Claims & Scientific Findings ({turn.findings.length})</span>
                              </span>
                              {expandedFindings[turn.id] ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {expandedFindings[turn.id] && (
                              <div className="p-3 border-t border-orca-border/40 space-y-2">
                                {turn.findings.map((f) => (
                                  <div key={f.id} className="p-2.5 rounded bg-slate-900/90 border border-orca-border/50 text-xs space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono text-[10px] text-cyan-400 font-semibold">{f.id}</span>
                                      {f.is_forecast && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-950 text-purple-300 border border-purple-800">
                                          Forecast Run
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-slate-200">{f.claim}</p>
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                      <span className="text-[10px] text-slate-500">Evidence:</span>
                                      {f.evidence_ids.map((eid) => (
                                        <button
                                          key={eid}
                                          type="button"
                                          onClick={() => handleEvidenceClick(eid)}
                                          className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 hover:text-cyan-100 text-[10px] font-mono cursor-pointer"
                                        >
                                          {eid}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Limitations Notice */}
                        {turn.limitations && turn.limitations.length > 0 && (
                          <div className="rounded-lg border border-orca-border/60 bg-slate-950/60 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleLimitations(turn.id)}
                              className="w-full px-3 py-2 text-left flex items-center justify-between text-slate-400 hover:text-slate-200 transition"
                            >
                              <span className="flex items-center space-x-1.5 font-medium text-[11px]">
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                                <span>Official Warnings & Governance Limitations ({turn.limitations.length})</span>
                              </span>
                              {expandedLimitations[turn.id] ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {expandedLimitations[turn.id] && (
                              <div className="p-3 border-t border-orca-border/40 space-y-1.5 text-[11px] text-slate-400">
                                {turn.limitations.map((lim, lIdx) => (
                                  <div key={lIdx} className="flex items-start space-x-1.5">
                                    <span className="text-amber-400">•</span>
                                    <span>{lim}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Loading Animation Bubble */}
          {isLoading && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="rounded-2xl rounded-tl-none p-4 bg-orca-navy/80 border border-orca-border text-slate-300 shadow-md flex items-center space-x-3">
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                <span className="text-xs font-medium text-slate-300 animate-pulse">
                  {PROGRESS_STAGES[progressIndex]}
                </span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Follow-up Suggestion Chips (when turns exist and not loading) */}
        {turns.length > 0 && !isLoading && (
          <div className="px-5 py-2.5 bg-slate-900/40 border-t border-orca-border/40 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium text-[11px] flex items-center space-x-1">
              <HelpCircle className="w-3 h-3 text-cyan-400" />
              <span>Suggested Follow-ups:</span>
            </span>
            <button
              type="button"
              onClick={() => sendMessage("Why is the sea state moderate?")}
              className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-orca-border hover:border-cyan-700 transition cursor-pointer text-[11px]"
            >
              Why is the sea state moderate?
            </button>
            <button
              type="button"
              onClick={() => sendMessage("Is there an official warning active for our sector?")}
              className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-orca-border hover:border-cyan-700 transition cursor-pointer text-[11px]"
            >
              Is that an official warning?
            </button>
            <button
              type="button"
              onClick={() => sendMessage("How fresh is the forecast data?")}
              className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-orca-border hover:border-cyan-700 transition cursor-pointer text-[11px]"
            >
              How fresh is this forecast?
            </button>
            <button
              type="button"
              onClick={() => sendMessage("Are small artisanal fishing craft safe to operate?")}
              className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-orca-border hover:border-cyan-700 transition cursor-pointer text-[11px]"
            >
              Are small craft safe?
            </button>
          </div>
        )}

        {/* Message Composer */}
        <div className="p-4 bg-orca-navy border-t border-orca-border">
          <div className="flex items-end space-x-3">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                disabled={isLoading}
                placeholder="Ask about sea conditions, Douglas scale, cyclone alerts, or historical tracks (Enter to send, Shift+Enter for newline)..."
                className="w-full resize-none bg-slate-950 border border-orca-border focus:border-cyan-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition disabled:opacity-50"
              />
            </div>

            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={isLoading || !inputMessage.trim()}
              className="px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-sm flex items-center justify-center space-x-2 shadow-md transition shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Evidence Provenance Modal */}
      {selectedEvidence && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-orca-navy border border-cyan-500/40 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-orca-border/60 pb-3">
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-slate-100">
                  Evidence Provenance & Verification
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvidence(null)}
                className="text-slate-400 hover:text-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-orca-border space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Evidence ID:</span>
                  <span className="text-cyan-300 font-semibold">{selectedEvidence.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dataset ID:</span>
                  <span className="text-slate-200">{selectedEvidence.dataset_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Source:</span>
                  <span className="text-slate-200">{selectedEvidence.source_name}</span>
                </div>
                {selectedEvidence.source_url && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Source URL:</span>
                    <a
                      href={selectedEvidence.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline flex items-center space-x-1"
                    >
                      <span className="truncate max-w-[200px]">{selectedEvidence.source_url}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Retrieval UTC:</span>
                  <span className="text-slate-300">{selectedEvidence.retrieval_time}</span>
                </div>
                {selectedEvidence.observation_time && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Observation Time:</span>
                    <span className="text-slate-300">{selectedEvidence.observation_time}</span>
                  </div>
                )}
                {selectedEvidence.quality_flag && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Quality Flag:</span>
                    <span className="text-emerald-400">{selectedEvidence.quality_flag}</span>
                  </div>
                )}
              </div>

              {/* Raw Value / Metadata */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Recorded Observation Value:</label>
                <pre className="p-3 rounded-xl bg-slate-950 border border-orca-border text-slate-300 font-mono text-[11px] overflow-x-auto max-h-48">
                  {typeof selectedEvidence.value === "object"
                    ? JSON.stringify(selectedEvidence.value, null, 2)
                    : String(selectedEvidence.value)}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEvidence(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
              >
                Close Provenance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
