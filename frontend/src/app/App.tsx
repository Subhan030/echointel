import { useState, useCallback, useEffect } from "react";
import { api } from "../api";
import {
  Search, CheckCircle2, AlertCircle, Loader2, FileText,
  ChevronDown, ChevronUp, Play, Zap, Target, Shield, BarChart3, TrendingUp, ExternalLink
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function makeJob(competitorId: string): Job {
  return {
    id: `job_${competitorId}_${Date.now()}`,
    competitorId,
    status: "queued",
    startedAt: new Date().toISOString(),
    steps: [
      { id: "s1", label: "Planner Agent", status: "done" },
      { id: "s2", label: "Researcher Agent", status: "pending" },
      { id: "s3", label: "Analyzer Agent", status: "pending" },
      { id: "s4", label: "Strategist Agent", status: "pending" },
      { id: "s5", label: "Reporter Agent", status: "pending" },
    ],
  };
}

const CAT_ICON: Record<string, React.FC<{ className?: string }>> = {
  Pricing: TrendingUp,
  Product: Zap,
  Marketing: Target,
  Partnerships: Shield,
  Distribution: BarChart3,
};

const SEV = {
  high: { label: "High", cls: "bg-red-50 text-red-700 border-red-200" },
  medium: { label: "Medium", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  low: { label: "Low", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const PRI = {
  urgent: { label: "Urgent", cls: "bg-red-50 text-red-700 border-red-200" },
  high: { label: "High", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  medium: { label: "Medium", cls: "bg-blue-50 text-blue-700 border-blue-200" },
};

const EFF = {
  low: { label: "Low effort", cls: "text-emerald-600" },
  medium: { label: "Med effort", cls: "text-amber-600" },
  high: { label: "High effort", cls: "text-slate-500" },
};

// ─── Components ───────────────────────────────────────────────────────────────

function Header() {
  return (
    <div className="text-center pt-20 pb-12">

      <p className="text-xs font-mono font-bold tracking-[0.2em] text-destructive uppercase mb-4 mt-6">EchoIntel Multi-Agent Network</p>
      <h1 className="text-6xl font-normal tracking-tight mb-8" style={{ fontFamily: "'Lora', serif" }}>
        Echo<span className="text-destructive italic">Intel</span>
      </h1>
      <p className="max-w-2xl mx-auto text-muted-foreground/80 text-sm leading-relaxed">
        Five specialized AI agents collaborate dynamically to plan, research, analyze, strategize, and report
        on any competitor.
      </p>
    </div>
  );
}

function NodePanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-card/40 backdrop-blur-md border border-border/60 rounded-[2rem] p-8 shadow-sm">
      <div className="flex justify-between items-center mb-8 text-xs font-mono text-muted-foreground/60 uppercase tracking-widest">
        <span>{title}</span>
        <span>{subtitle}</span>
      </div>
      {children}
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [reports, setReports] = useState<Record<string, Report[]>>({});
  
  const [inputValue, setInputValue] = useState("");
  const [activeCompetitorId, setActiveCompetitorId] = useState<string | null>(null);

  useEffect(() => {
    // Load competitors on mount
    api.getCompetitors().then(data => {
      const mapped = data.map(c => ({
        id: String(c.id),
        name: c.name,
        website: c.domain,
        addedAt: new Date().toISOString().slice(0, 10),
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
                id: `f_${i}`, category: f.category || "General", title: f.title || f.details || "Finding", body: f.details || "", severity: "medium" as any, source: "Analysis"
              })),
              recommendations: recommendations.map((rec: any, i: number) => ({
                id: `rec_${i}`, title: rec.title || "Recommendation", description: rec.description || "", priority: "high" as any, effort: "medium" as any
              })),
              metadata: { pagesScraped: Array.isArray(r.raw_sources) ? r.raw_sources.length : 0, dataPoints: findings.length + recommendations.length, runDuration: "Completed" }
            };
          });
          mappedReps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setReports(prev => ({ ...prev, [c.id]: mappedReps }));
        });
      });
    });
  }, []);

  const runPipeline = useCallback(async (compIdToRun?: string) => {
    let targetId = compIdToRun;
    
    // If no competitor is selected, create one from input
    if (!targetId && inputValue.trim()) {
      try {
        const created = await api.createCompetitor({ name: inputValue.trim(), domain: inputValue.trim() });
        targetId = String(created.id);
        const newC = { id: targetId, name: created.name, website: created.domain, addedAt: new Date().toISOString().slice(0, 10), status: "idle" as CompetitorStatus };
        setCompetitors((prev) => [...prev, newC]);
        setReports((prev) => ({ ...prev, [targetId!]: [] }));
      } catch (e) {
        console.error("Failed to create competitor", e);
        return;
      }
    }

    if (!targetId) return;

    setActiveCompetitorId(targetId);
    
    try {
      const apiJob = await api.runPipeline(Number(targetId));
      
      const job = makeJob(targetId);
      setJobs((prev) => ({ ...prev, [targetId!]: job }));
      setCompetitors((prev) => prev.map((c) => (c.id === targetId ? { ...c, status: "running" } : c)));

      const setStep = (status: JobStatus, steps: JobStep[]) => {
        setJobs((prev) => ({ ...prev, [targetId!]: { ...prev[targetId!], status, steps } }));
      };

      // Simulated initial progress
      setTimeout(() => setStep("scraping", [
        { id: "s1", label: "Planner Agent", status: "done", detail: "Formulates the research strategy" },
        { id: "s2", label: "Researcher Agent", status: "active", detail: "Gathers and extracts web information" },
        { id: "s3", label: "Analyzer Agent", status: "pending", detail: "Analyzes pricing and product signals" },
        { id: "s4", label: "Strategist Agent", status: "pending", detail: "Formulates strategic recommendations" },
        { id: "s5", label: "Reporter Agent", status: "pending", detail: "Synthesizes the final executive report" },
      ]), 900);

      setTimeout(() => setStep("analyzing", [
        { id: "s1", label: "Planner Agent", status: "done", detail: "Formulates the research strategy" },
        { id: "s2", label: "Researcher Agent", status: "done", detail: "Gathers and extracts web information" },
        { id: "s3", label: "Analyzer Agent", status: "active", detail: "Analyzing pricing and product signals" },
        { id: "s4", label: "Strategist Agent", status: "pending", detail: "Formulates strategic recommendations" },
        { id: "s5", label: "Reporter Agent", status: "pending", detail: "Synthesizes the final executive report" },
      ]), 3800);
      
      // Poll backend for actual completion
      const interval = setInterval(async () => {
        const j = await api.getJob(apiJob.id);
        if (j.status === 'completed' || j.status === 'failed') {
          clearInterval(interval);
          if (j.status === 'completed') {
            setStep("complete", [
              { id: "s1", label: "Planner Agent", status: "done", detail: "Formulated the research strategy" },
              { id: "s2", label: "Researcher Agent", status: "done", detail: "Gathered and extracted web information" },
              { id: "s3", label: "Analyzer Agent", status: "done", detail: "Analyzed pricing and product signals" },
              { id: "s4", label: "Strategist Agent", status: "done", detail: "Formulated strategic recommendations" },
              { id: "s5", label: "Reporter Agent", status: "done", detail: "Synthesized the final executive report" },
            ]);
            setCompetitors((prev) => prev.map((c) => c.id === targetId ? { ...c, status: "complete", lastRunAt: new Date().toISOString().slice(0, 10) } : c));
            
            // fetch new report
            const reps = await api.getReports(Number(targetId));
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
            setReports(prev => ({ ...prev, [targetId!]: mappedReps }));
          } else {
             setStep("error", [
              { id: "s1", label: "Planner Agent", status: "error", detail: "Job failed" },
              { id: "s2", label: "Researcher Agent", status: "pending", detail: "Job failed" },
              { id: "s3", label: "Analyzer Agent", status: "pending", detail: "Job failed" },
              { id: "s4", label: "Strategist Agent", status: "pending", detail: "Job failed" },
              { id: "s5", label: "Reporter Agent", status: "pending", detail: "Job failed" },
             ]);
             setCompetitors((prev) => prev.map((c) => c.id === targetId ? { ...c, status: "error" } : c));
          }
        }
      }, 3000);

    } catch (e) {
      console.error(e);
      setCompetitors((prev) => prev.map((c) => (c.id === targetId ? { ...c, status: "error" } : c)));
    }
  }, [inputValue]);

  const handleSuggestionClick = (c: Competitor) => {
    setInputValue(c.name);
    setActiveCompetitorId(c.id);
  };

  const activeJob = activeCompetitorId ? jobs[activeCompetitorId] : null;
  const isRunning = activeJob?.status !== undefined && activeJob.status !== 'complete' && activeJob.status !== 'error';
  const activeReports = activeCompetitorId ? reports[activeCompetitorId] || [] : [];
  const latestReport = activeReports.length > 0 ? activeReports[0] : null;

  // Render Job Steps identically to the reference stepper
  const renderJobSteps = () => {
    if (!activeJob) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 pt-10">
           <div className="size-16 rounded-full border-2 border-dashed border-border flex items-center justify-center mb-4">
             <span className="text-xs font-mono">00</span>
           </div>
           <p className="text-sm">Awaiting pipeline initialization...</p>
        </div>
      );
    }

    return (
      <div className="relative pl-6 space-y-8 before:absolute before:inset-y-0 before:left-[44px] before:h-full before:w-px before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
        {activeJob.steps.map((step, idx) => {
          const isDone = step.status === 'done';
          const isActive = step.status === 'active';
          
          return (
            <div key={step.id} className="relative flex items-center justify-between group">
              <div className="flex items-center gap-6">
                <div className={`flex items-center justify-center size-10 rounded-full border ${isDone ? 'bg-primary text-primary-foreground border-primary' : isActive ? 'bg-background border-primary text-primary shadow-[0_0_15px_rgba(0,0,0,0.1)]' : 'bg-muted border-border text-muted-foreground/50'} z-10 transition-colors duration-500`}>
                  {isDone ? <CheckCircle2 className="size-5" /> : <span className="text-xs font-mono font-medium">{String(idx + 1).padStart(2, '0')}</span>}
                </div>
                <div>
                  <h4 className={`text-sm font-medium ${isActive ? 'text-primary' : isDone ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</h4>
                  <p className="text-sm text-muted-foreground/70 mt-1">{step.detail}</p>
                </div>
              </div>
              <div className="hidden sm:block">
                <span className={`text-xs font-mono px-2 py-1 rounded-md ${isDone ? 'bg-muted text-muted-foreground' : isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground/40'}`}>
                  {isDone ? 'DONE' : isActive ? 'ACTIVE' : 'WAITING'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="max-w-7xl mx-auto px-6">
        <Header />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* Left Panel: Topic Delegation */}
          <NodePanel title="01 / COMPETITOR DELEGATION" subtitle="INPUT NODE">
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="size-5 text-destructive/60" />
              </div>
              <input 
                type="text" 
                placeholder="e.g. Acme Corp or acme.com" 
                className="w-full bg-background border border-border/60 text-foreground rounded-2xl py-5 pl-12 pr-4 text-base placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isRunning && runPipeline()}
              />
            </div>
            
            <button 
              onClick={() => runPipeline()}
              disabled={isRunning || !inputValue.trim()}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-widest text-sm py-5 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-8 flex justify-center items-center gap-2 shadow-xl shadow-primary/20"
            >
              {isRunning ? <><Loader2 className="size-4 animate-spin" /> PIPELINE RUNNING</> : 'RUN RESEARCH PIPELINE'}
            </button>
            
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest mr-2">Suggestions:</span>
              {competitors.slice(0, 5).map(c => (
                <button 
                  key={c.id}
                  onClick={() => handleSuggestionClick(c)}
                  className={`px-4 py-2 rounded-full border text-sm transition-colors ${activeCompetitorId === c.id ? 'border-primary bg-primary/5 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
                >
                  {c.name}
                </button>
              ))}
              {competitors.length === 0 && <span className="text-xs text-muted-foreground">No competitors yet. Add one above!</span>}
            </div>
          </NodePanel>

          {/* Right Panel: Pipeline Execution */}
          <NodePanel title="02 / PIPELINE EXECUTION" subtitle="STATUS NODE">
            <div className="pt-4 pb-2">
              {renderJobSteps()}
            </div>
          </NodePanel>
        </div>

        {/* Output Nodes */}
        {(latestReport || activeJob?.status === 'complete') && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out">
            <div className="flex items-center gap-4 mb-8">
              <h3 className="text-xs font-mono text-destructive font-bold uppercase tracking-widest">03 / OUTPUT NODES</h3>
              <div className="h-px flex-1 bg-gradient-to-r from-destructive/30 to-transparent"></div>
            </div>

            {latestReport ? (
              <div className="space-y-6">
                <details className="group bg-card/40 backdrop-blur-md border border-border/60 rounded-[2rem] overflow-hidden" open>
                  <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                    <div className="flex items-center gap-3">
                      <div className="size-2 rounded-full bg-destructive" />
                      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">FINAL REPORT</span>
                    </div>
                    <ChevronDown className="size-5 text-muted-foreground group-open:rotate-180 transition-transform duration-300" />
                  </summary>
                  
                  <div className="p-8 pt-0 border-t border-border/40 mt-2">
                    <div className="mb-8 pt-6">
                       <h2 className="text-2xl font-semibold mb-4">{competitors.find(c => c.id === activeCompetitorId)?.name} Intelligence Report</h2>
                       <div className="bg-background/80 border border-border p-6 rounded-xl text-sm leading-relaxed text-muted-foreground shadow-inner">
                         {latestReport.summary}
                       </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Findings */}
                      <div>
                        <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">Key Findings</h4>
                        <div className="space-y-4">
                          {latestReport.findings.map((f, i) => {
                            const Icon = CAT_ICON[f.category] ?? FileText;
                            return (
                              <div key={i} className="bg-background border border-border/60 p-4 rounded-xl flex gap-4 shadow-sm">
                                <div className="mt-1 bg-muted p-2 rounded-lg h-fit"><Icon className="size-4" /></div>
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-mono text-muted-foreground">{f.category}</span>
                                  </div>
                                  <h5 className="text-sm font-medium text-foreground mb-1">{f.title}</h5>
                                  <p className="text-xs text-muted-foreground/80 leading-relaxed">{f.body}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Recommendations */}
                      <div>
                        <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">Strategic Recommendations</h4>
                        <div className="space-y-4">
                          {latestReport.recommendations.map((rec, i) => (
                            <div key={i} className="bg-background border border-border/60 p-4 rounded-xl flex gap-4 shadow-sm">
                              <div className="mt-1 size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-mono font-bold shrink-0">{i + 1}</div>
                              <div>
                                <h5 className="text-sm font-medium text-foreground mb-1">{rec.title}</h5>
                                <p className="text-xs text-muted-foreground/80 leading-relaxed">{rec.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            ) : (
               <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                 <Loader2 className="size-8 animate-spin mb-4 text-muted-foreground/50" />
                 Processing final output nodes...
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
