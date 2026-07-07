import { useState, useCallback, useEffect } from "react";
import { api } from "../api";
import {
  Plus, Search, ChevronRight, ExternalLink, Play, ArrowLeft,
  BarChart3, FileText, History, X, CheckCircle2, AlertCircle,
  Loader2, TrendingUp, Shield, Zap, Target, Clock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CompetitorStatus = "idle" | "running" | "complete" | "error";
type JobStatus = "queued" | "scraping" | "analyzing" | "synthesizing" | "complete" | "error";
type StepStatus = "pending" | "active" | "done" | "error";

interface JobStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

interface Competitor {
  id: string;
  name: string;
  website: string;
  addedAt: string;
  lastRunAt?: string;
  status: CompetitorStatus;
}

interface Job {
  id: string;
  competitorId: string;
  status: JobStatus;
  startedAt: string;
  steps: JobStep[];
}

interface Finding {
  id: string;
  category: string;
  title: string;
  body: string;
  severity: "high" | "medium" | "low";
  source?: string;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: "urgent" | "high" | "medium";
  effort: "low" | "medium" | "high";
}

interface Report {
  id: string;
  competitorId: string;
  createdAt: string;
  summary: string;
  findings: Finding[];
  recommendations: Recommendation[];
  metadata: { pagesScraped: number; dataPoints: number; runDuration: string };
}

type View =
  | { type: "list" }
  | { type: "detail"; id: string }
  | { type: "report"; competitorId: string; reportId: string };

// ─── Seed data ────────────────────────────────────────────────────────────────


// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtRelative(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return fmtDate(iso);
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const SEV = {
  high:   { label: "High",   cls: "bg-red-50 text-red-700 border border-red-200" },
  medium: { label: "Medium", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  low:    { label: "Low",    cls: "bg-slate-100 text-slate-500 border border-slate-200" },
} as const;

const PRI = {
  urgent: { label: "Urgent", cls: "bg-red-50 text-red-700 border border-red-200" },
  high:   { label: "High",   cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  medium: { label: "Medium", cls: "bg-blue-50 text-blue-700 border border-blue-200" },
} as const;

const EFF = {
  low:    { label: "Low effort",  cls: "text-emerald-600" },
  medium: { label: "Med effort",  cls: "text-amber-600" },
  high:   { label: "High effort", cls: "text-slate-500" },
} as const;

const CAT_ICON: Record<string, React.FC<{ className?: string }>> = {
  Pricing: TrendingUp,
  Product: Zap,
  Marketing: Target,
  Partnerships: Shield,
  Distribution: BarChart3,
};

function makeJob(competitorId: string): Job {
  return {
    id: `job_${competitorId}_${Date.now()}`,
    competitorId,
    status: "queued",
    startedAt: new Date().toISOString(),
    steps: [
      { id: "s1", label: "Job queued", status: "done" },
      { id: "s2", label: "Scrape website & socials", status: "pending" },
      { id: "s3", label: "Analyze pricing & product signals", status: "pending" },
      { id: "s4", label: "Synthesize report", status: "pending" },
    ],
  };
}



// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CompetitorStatus }) {
  const map = {
    idle:     { label: "Idle",     cls: "bg-slate-100 text-slate-500" },
    running:  { label: "Running",  cls: "bg-indigo-50 text-indigo-600" },
    complete: { label: "Complete", cls: "bg-emerald-50 text-emerald-700" },
    error:    { label: "Error",    cls: "bg-red-50 text-red-600" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono ${cls}`}>
      {status === "running" && (
        <span className="relative flex size-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
          <span className="relative inline-flex rounded-full size-1.5 bg-indigo-500" />
        </span>
      )}
      {status === "complete" && <CheckCircle2 className="size-3" />}
      {status === "error"    && <AlertCircle  className="size-3" />}
      {label}
    </span>
  );
}

// ─── JobProgressPanel ─────────────────────────────────────────────────────────

const JOB_LABEL: Record<JobStatus, string> = {
  queued:      "Queued",
  scraping:    "Scraping",
  analyzing:   "Analyzing",
  synthesizing:"Synthesizing",
  complete:    "Complete",
  error:       "Failed",
};

const PROGRESS: Record<JobStatus, number> = {
  queued: 6, scraping: 34, analyzing: 62, synthesizing: 84, complete: 100, error: 0,
};

function JobProgressPanel({ job }: { job: Job }) {
  const isDone  = job.status === "complete";
  const isError = job.status === "error";

  return (
    <div className="border border-border rounded-xl p-5 bg-card">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-medium text-foreground">Research job</p>
          <p className="text-xs font-mono text-muted-foreground mt-0.5 select-all">{job.id}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-md font-mono ${
          isDone    ? "bg-emerald-50 text-emerald-700" :
          isError   ? "bg-red-50 text-red-700" :
                      "bg-indigo-50 text-indigo-600"
        }`}>
          {JOB_LABEL[job.status]}
        </span>
      </div>

      <div className="space-y-3.5 mb-5">
        {job.steps.map((step) => (
          <div key={step.id} className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0 size-4">
              {step.status === "done"    && <CheckCircle2 className="size-4 text-emerald-500" />}
              {step.status === "active"  && <Loader2      className="size-4 text-indigo-500 animate-spin" />}
              {step.status === "error"   && <AlertCircle  className="size-4 text-red-500" />}
              {step.status === "pending" && (
                <div className="size-4 rounded-full border-2 border-slate-200" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${step.status === "pending" ? "text-muted-foreground" : "text-foreground"}`}>
                {step.label}
              </p>
              {step.detail && step.status === "active" && (
                <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">{step.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!isError && (
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-700"
            style={{ width: `${PROGRESS[job.status]}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── AddCompetitorModal ───────────────────────────────────────────────────────


function AddCompetitorModal({ onAdd, onClose }: { onAdd: (c: Competitor) => void; onClose: () => void }) {
  const [name, setName]       = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError]     = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim())    { setError("Company name is required."); return; }
    if (!website.trim()) { setError("Website is required."); return; }
    onAdd({
      id: `c_${Date.now()}`,
      name: name.trim(),
      website: website.trim().replace(/^https?:\/\//, ""),
      addedAt: new Date().toISOString().slice(0, 10),
      status: "idle",
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/25 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Add competitor</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
              <AlertCircle className="size-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground uppercase tracking-wider">Company name</label>
            <input
              type="text"
              placeholder="e.g. OpenAI"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              autoFocus
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground uppercase tracking-wider">Website</label>
            <input
              type="text"
              placeholder="e.g. openai.com"
              value={website}
              onChange={(e) => { setWebsite(e.target.value); setError(""); }}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 transition-all"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-accent rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-opacity shadow-sm"
            >
              Add competitor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── CompetitorListView ───────────────────────────────────────────────────────

function CompetitorListView({
  competitors,
  onSelect,
  onAdd,
}: {
  competitors: Competitor[];
  onSelect: (c: Competitor) => void;
  onAdd: (c: Competitor) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch]       = useState("");

  const filtered = competitors.filter((c) =>
    [c.name, c.website].some((s) => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-8">
        {/* Page header */}
        <div className="text-center mb-12 mt-4">
          <h1 
            className="text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-500 mb-3 pb-2" 
            style={{ fontFamily: "'Dancing Script', cursive", filter: "drop-shadow(0 2px 4px rgba(79, 70, 229, 0.2))" }}
          >
            EchoIntel
          </h1>
          <p className="text-sm text-muted-foreground">
            {competitors.length} competitors tracked &mdash; research runs on demand
          </p>
        </div>

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground tracking-tight">Competitors</h2>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:scale-[1.02] hover:shadow-md hover:shadow-indigo-500/30 active:scale-95 transition-all"
          >
            <Plus className="size-4" />
            Add competitor
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or website…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 transition-all"
          />
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Last run</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-14 text-center text-sm text-muted-foreground">
                    {search ? `No competitors matching "${search}"` : "No competitors yet — add your first one above."}
                  </td>
                </tr>
              ) : (
                filtered.map((c, i) => (
                    <tr
                      key={c.id}
                      className={`group hover:bg-white/80 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-indigo-500/5 hover:z-10 relative ${i < filtered.length - 1 ? "border-b border-border" : ""}`}
                      onClick={() => onSelect(c)}
                    >
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-foreground">{c.name}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{c.website}</p>
                    </td>

                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                        <Clock className="size-3" />
                        {c.lastRunAt ? fmtRelative(c.lastRunAt) : "Never"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <AddCompetitorModal
          onAdd={(c) => { onAdd(c); setShowModal(false); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// ─── CompetitorDetailView ─────────────────────────────────────────────────────

function CompetitorDetailView({
  competitor,
  activeJob,
  reports,
  onBack,
  onRunResearch,
  onViewReport,
}: {
  competitor: Competitor;
  activeJob: Job | null;
  reports: Report[];
  onBack: () => void;
  onRunResearch: () => void;
  onViewReport: (r: Report) => void;
}) {
  const canRun = !activeJob || activeJob.status === "complete" || activeJob.status === "error";

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-4" />
          All competitors
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">{competitor.name}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <a
                href={`https://${competitor.website}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-indigo-600 transition-colors"
              >
                {competitor.website}
                <ExternalLink className="size-3" />
              </a>
              <StatusBadge status={competitor.status} />
            </div>
          </div>
          <button
            onClick={onRunResearch}
            disabled={!canRun}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:scale-[1.02] hover:shadow-md hover:shadow-indigo-500/30 active:scale-95 disabled:hover:scale-100 disabled:hover:shadow-none disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {!canRun ? (
              <><Loader2 className="size-4 animate-spin" /> Running…</>
            ) : (
              <><Play className="size-4" /> Run research</>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Sidebar: job + stats */}
          <div className="lg:col-span-2 space-y-4">
            {activeJob ? (
              <JobProgressPanel job={activeJob} />
            ) : (
              <div className="border border-dashed border-border rounded-xl p-5 bg-card">
                <p className="text-sm font-medium text-foreground mb-1">No active job</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Click "Run research" to start a fresh analysis.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="border border-border rounded-xl p-4 bg-card">
                <p className="text-xs text-muted-foreground mb-1">Reports</p>
                <p className="text-2xl font-semibold font-mono text-foreground">{reports.length}</p>
              </div>
              <div className="border border-border rounded-xl p-4 bg-card">
                <p className="text-xs text-muted-foreground mb-1">Added</p>
                <p className="text-xs font-mono text-foreground mt-1">{fmtDate(competitor.addedAt)}</p>
              </div>
            </div>
          </div>

          {/* Report history */}
          <div className="lg:col-span-3">
            <div className="flex items-center gap-2 mb-4">
              <History className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Report history</h2>
            </div>

            {reports.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-10 text-center">
                <FileText className="size-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No reports yet</p>
                <p className="text-xs text-muted-foreground mt-1">Run a research job to generate your first report.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onViewReport(r)}
                    className="w-full text-left border border-border rounded-xl p-5 bg-card hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-mono text-muted-foreground">{fmtDateTime(r.createdAt)}</span>
                          <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-md font-mono">
                            Complete
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed line-clamp-2">{r.summary}</p>
                        <div className="flex items-center gap-4 mt-3">
                          <span className="text-xs font-mono text-muted-foreground">{r.findings.length} findings</span>
                          <span className="text-xs font-mono text-muted-foreground">{r.recommendations.length} recs</span>
                          <span className="text-xs font-mono text-muted-foreground">{r.metadata.pagesScraped} pages</span>
                          <span className="text-xs font-mono text-muted-foreground">{r.metadata.runDuration}</span>
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground group-hover:text-indigo-500 transition-colors flex-shrink-0 mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ReportView ───────────────────────────────────────────────────────────────

function ReportView({
  report,
  competitor,
  onBack,
}: {
  report: Report;
  competitor: Competitor;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"findings" | "recommendations">("findings");
  const highCount  = report.findings.filter((f) => f.severity === "high").length;
  const urgentCount = report.recommendations.filter((r) => r.priority === "urgent").length;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-4" />
          {competitor.name}
        </button>

        {/* Report header */}
        <div className="mb-7">
          <h1 className="text-xl font-semibold text-foreground tracking-tight mb-2">{competitor.name} — Research Report</h1>
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-muted-foreground">
            <span>{fmtDateTime(report.createdAt)}</span>
            <span className="text-border">·</span>
            <span>{report.metadata.pagesScraped} pages</span>
            <span className="text-border">·</span>
            <span>{report.metadata.dataPoints} data points</span>
            <span className="text-border">·</span>
            <span>{report.metadata.runDuration}</span>
          </div>
        </div>

        {/* Executive summary */}
        <div className="bg-accent border border-indigo-200 rounded-xl p-6 mb-6">
          <p className="text-xs font-mono text-indigo-500 uppercase tracking-wider mb-2.5">Executive Summary</p>
          <p className="text-sm text-foreground leading-relaxed">{report.summary}</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-7">
          <div className="border border-border rounded-xl p-4 bg-card text-center">
            <p className="text-2xl font-semibold font-mono text-foreground">{report.findings.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Findings</p>
          </div>
          <div className={`border rounded-xl p-4 text-center ${highCount > 0 ? "border-red-200 bg-red-50" : "border-border bg-card"}`}>
            <p className={`text-2xl font-semibold font-mono ${highCount > 0 ? "text-red-700" : "text-foreground"}`}>{highCount}</p>
            <p className={`text-xs mt-1 ${highCount > 0 ? "text-red-500" : "text-muted-foreground"}`}>High severity</p>
          </div>
          <div className={`border rounded-xl p-4 text-center ${urgentCount > 0 ? "border-amber-200 bg-amber-50" : "border-border bg-card"}`}>
            <p className={`text-2xl font-semibold font-mono ${urgentCount > 0 ? "text-amber-700" : "text-foreground"}`}>{report.recommendations.length}</p>
            <p className={`text-xs mt-1 ${urgentCount > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
              {urgentCount > 0 ? `${urgentCount} urgent` : "Recommendations"}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-6">
          {(["findings", "recommendations"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Findings */}
        {tab === "findings" && (
          <div className="space-y-3">
            {report.findings.map((f) => {
              const Icon = CAT_ICON[f.category] ?? FileText;
              const sev  = SEV[f.severity];
              return (
                <div key={f.id} className="border border-border rounded-xl bg-card p-5">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-muted rounded-lg flex-shrink-0">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-xs font-mono text-muted-foreground">{f.category}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${sev.cls}`}>{sev.label}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1.5">{f.title}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                      {f.source && (
                        <p className="text-xs font-mono text-muted-foreground/60 mt-3">↗ {f.source}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recommendations */}
        {tab === "recommendations" && (
          <div className="space-y-3">
            {report.recommendations.map((rec, i) => {
              const pri = PRI[rec.priority];
              const eff = EFF[rec.effort];
              return (
                <div key={rec.id} className="border border-border rounded-xl bg-card p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-mono font-semibold">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-md font-mono ${pri.cls}`}>{pri.label}</span>
                        <span className={`text-xs font-mono ${eff.cls}`}>{eff.label}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1.5">{rec.title}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{rec.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────


export default function App() {
  const [view, setView]             = useState<View>({ type: "list" });
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [jobs, setJobs]             = useState<Record<string, Job>>({});
  const [reports, setReports]       = useState<Record<string, Report[]>>({});


  useEffect(() => {
    // Load competitors on mount
    api.getCompetitors().then(data => {
      const mapped = data.map(c => ({
        id: String(c.id),
        name: c.name,
        website: c.domain,
        category: c.industry || "Uncategorized",
        addedAt: new Date().toISOString().slice(0,10),
        status: "idle" as CompetitorStatus
      }));
      setCompetitors(mapped);
      
      // Load reports for all
      data.forEach(c => {
        api.getReports(c.id).then(reps => {
          const mappedReps = reps.map(r => {
            const findings = Array.isArray(r.findings?.insights) ? r.findings.insights : [];
            const recommendations = Array.isArray(r.findings?.recommendations) ? r.findings.recommendations : [];
            const timestamp = (r.generated_at || "").endsWith("Z") ? r.generated_at : (r.generated_at + "Z");
            return {
              id: String(r.id),
              competitorId: String(r.competitor_id),
              createdAt: timestamp,
              summary: r.summary || "",
              findings: findings.map((f: any, i: number) => ({
                id: `f_${i}`,
                category: f.category || "General",
                title: f.title || f.details || "Finding",
                body: f.details || "",
                severity: "medium" as any,
                source: "Analysis"
              })),
              recommendations: recommendations.map((rec: any, i: number) => ({
                id: `rec_${i}`,
                title: rec.title || "Recommendation",
                description: rec.description || "",
                priority: "high" as any,
                effort: "medium" as any
              })),
              metadata: { pagesScraped: Array.isArray(r.raw_sources) ? r.raw_sources.length : 0, dataPoints: findings.length + recommendations.length, runDuration: "Completed" }
            }
          });
          mappedReps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setReports(prev => ({ ...prev, [c.id]: mappedReps }));
        });
      });
    });
  }, []);

  const runResearch = useCallback(async (competitorId: string) => {
    try {
      const apiJob = await api.runPipeline(Number(competitorId));
      
      const job = makeJob(competitorId);
      setJobs((prev) => ({ ...prev, [competitorId]: job }));
      setCompetitors((prev) => prev.map((c) => (c.id === competitorId ? { ...c, status: "running" } : c)));

      const setStep = (status: JobStatus, steps: JobStep[]) => {
        setJobs((prev) => ({ ...prev, [competitorId]: { ...prev[competitorId], status, steps } }));
      };

      // Start simulated progress but gate completion on actual API
      setTimeout(() => setStep("scraping", [
        { id: "s1", label: "Job queued",                     status: "done" },
        { id: "s2", label: "Scrape website & socials",       status: "active", detail: "Fetching sitemap, pricing, changelog…" },
        { id: "s3", label: "Analyze pricing & product signals", status: "pending" },
        { id: "s4", label: "Synthesize report",              status: "pending" },
      ]), 900);

      setTimeout(() => setStep("analyzing", [
        { id: "s1", label: "Job queued",                     status: "done" },
        { id: "s2", label: "Scrape website & socials",       status: "done" },
        { id: "s3", label: "Analyze pricing & product signals", status: "active", detail: "Cross-referencing pricing tiers, product pages…" },
        { id: "s4", label: "Synthesize report",              status: "pending" },
      ]), 3800);
      
      // Poll backend
      const interval = setInterval(async () => {
        const j = await api.getJob(apiJob.id);
        if (j.status === 'completed' || j.status === 'failed') {
          clearInterval(interval);
          if (j.status === 'completed') {
            setStep("complete", [
              { id: "s1", label: "Job queued",                     status: "done" },
              { id: "s2", label: "Scrape website & socials",       status: "done" },
              { id: "s3", label: "Analyze pricing & product signals", status: "done" },
              { id: "s4", label: "Synthesize report",              status: "done" },
            ]);
            setCompetitors((prev) => prev.map((c) => c.id === competitorId ? { ...c, status: "complete", lastRunAt: new Date().toISOString().slice(0, 10) } : c));
            
            // fetch new report
            const reps = await api.getReports(Number(competitorId));
            const mappedReps = reps.map(r => {
               const findings = Array.isArray(r.findings?.insights) ? r.findings.insights : [];
               const recommendations = Array.isArray(r.findings?.recommendations) ? r.findings.recommendations : [];
               const timestamp = (r.generated_at || "").endsWith("Z") ? r.generated_at : (r.generated_at + "Z");
               return {
                 id: String(r.id),
                 competitorId: String(r.competitor_id),
                 createdAt: timestamp,
                 summary: r.summary || "",
                 findings: findings.map((f: any, i: number) => ({
                   id: `f_${i}`, category: f.category || "General", title: f.title || f.details || "Finding", body: f.details || "", severity: "medium" as any, source: "Analysis"
                 })),
                 recommendations: recommendations.map((rec: any, i: number) => ({
                   id: `rec_${i}`, title: rec.title || "Recommendation", description: rec.description || "", priority: "high" as any, effort: "medium" as any
                 })),
                 metadata: { pagesScraped: Array.isArray(r.raw_sources) ? r.raw_sources.length : 0, dataPoints: findings.length + recommendations.length, runDuration: "Completed" }
               };
            });
            mappedReps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setReports(prev => ({ ...prev, [competitorId]: mappedReps }));
          } else {
             setStep("error", []);
             setCompetitors((prev) => prev.map((c) => c.id === competitorId ? { ...c, status: "error" } : c));
          }
        }
      }, 3000);

    } catch (e) {
      console.error(e);
      setCompetitors((prev) => prev.map((c) => (c.id === competitorId ? { ...c, status: "error" } : c)));
    }
  }, []);

  const viewCompetitorId =
    view.type === "detail" ? view.id :
    view.type === "report" ? view.competitorId :
    null;

  const selectedCompetitor = viewCompetitorId
    ? competitors.find((c) => c.id === viewCompetitorId) ?? null
    : null;

  const activeJob   = selectedCompetitor ? (jobs[selectedCompetitor.id] ?? null) : null;
  const compReports = selectedCompetitor ? (reports[selectedCompetitor.id] ?? []) : [];
  const selectedReport =
    view.type === "report"
      ? compReports.find((r) => r.id === view.reportId) ?? null
      : null;

  const runningCount = competitors.filter((c) => c.status === "running").length;

  return (
    <div className="h-screen flex flex-col bg-background" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <nav className="flex items-center justify-between px-6 py-3 border-b border-border bg-card flex-shrink-0">
        <button
          onClick={() => setView({ type: "list" })}
          className="flex items-center gap-2 hover:opacity-75 transition-opacity"
        >
          <div className="flex items-center gap-3">
            <div className="size-6 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs" style={{ fontFamily: "'Dancing Script', cursive", fontSize: '1rem' }}>E</span>
            </div>
          </div>
        </button>

        {view.type !== "list" && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <button
              onClick={() => setView({ type: "list" })}
              className="hover:text-foreground transition-colors px-1"
            >
              Competitors
            </button>
            {selectedCompetitor && (
              <>
                <ChevronRight className="size-3.5 flex-shrink-0" />
                <button
                  onClick={() => setView({ type: "detail", id: selectedCompetitor.id })}
                  className={`hover:text-foreground transition-colors px-1 ${view.type === "detail" ? "text-foreground font-medium" : ""}`}
                >
                  {selectedCompetitor.name}
                </button>
              </>
            )}
            {view.type === "report" && (
              <>
                <ChevronRight className="size-3.5 flex-shrink-0" />
                <span className="text-foreground font-medium px-1">Report</span>
              </>
            )}
          </div>
        )}

        <div className="w-28 flex justify-end">
          {runningCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-mono text-indigo-600">
              <span className="relative flex size-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-1.5 bg-indigo-500" />
              </span>
              {runningCount} running
            </span>
          )}
        </div>
      </nav>

      <div className="flex-1 overflow-hidden flex">
        {view.type === "list" && (
          <CompetitorListView
            competitors={competitors}
            onSelect={(c) => setView({ type: "detail", id: c.id })}
            onAdd={async (c) => {
              try {
                const created = await api.createCompetitor({ name: c.name, domain: c.website });
                const newC = { ...c, id: String(created.id) };
                setCompetitors((prev) => [...prev, newC]);
                setReports((prev) => ({ ...prev, [newC.id]: [] }));
                setView({ type: "detail", id: newC.id });
              } catch (e) { console.error(e); }
            }}
          />
        )}

        {view.type === "detail" && selectedCompetitor && (
          <CompetitorDetailView
            competitor={selectedCompetitor}
            activeJob={activeJob}
            reports={compReports}
            onBack={() => setView({ type: "list" })}
            onRunResearch={() => runResearch(selectedCompetitor.id)}
            onViewReport={(r) =>
              setView({ type: "report", competitorId: selectedCompetitor.id, reportId: r.id })
            }
          />
        )}

        {view.type === "report" && selectedReport && selectedCompetitor && (
          <ReportView
            report={selectedReport}
            competitor={selectedCompetitor}
            onBack={() => setView({ type: "detail", id: selectedCompetitor.id })}
          />
        )}
      </div>
    </div>
  );
}
