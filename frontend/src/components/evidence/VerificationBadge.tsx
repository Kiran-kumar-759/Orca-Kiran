import React from "react";
import { CheckCircle2, AlertCircle, HelpCircle, XCircle } from "lucide-react";
import { VerificationState } from "../../types";

interface Props {
  state?: VerificationState;
  className?: string;
}

export const VerificationBadge: React.FC<Props> = ({ state = "unverified", className = "" }) => {
  switch (state) {
    case "verified":
      return (
        <span
          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 ${className}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Scientifically Verified</span>
        </span>
      );
    case "needs_review":
      return (
        <span
          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-700/60 ${className}`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>Needs Review</span>
        </span>
      );
    case "conflicting":
      return (
        <span
          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-950/80 text-rose-300 border border-rose-700/60 ${className}`}
        >
          <XCircle className="w-3.5 h-3.5 text-rose-400" />
          <span>Conflicting Evidence</span>
        </span>
      );
    case "insufficient_evidence":
      return (
        <span
          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-950/80 text-purple-300 border border-purple-700/60 ${className}`}
        >
          <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
          <span>Insufficient Evidence</span>
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 ${className}`}
        >
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>Unverified</span>
        </span>
      );
  }
};
