import { useState, useCallback, useEffect } from "react";
import { api } from "../api";
import {
  Search, CheckCircle2, AlertCircle, Loader2, FileText,
  ChevronDown, ChevronUp, Play, Zap, Target, Shield, BarChart3, TrendingUp, ExternalLink, X,
  Brain, Globe, Check
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
  logs?: string[];
  metrics?: Record<string, string>;
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

const AGENT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  "Planner Agent": Brain,
  "Researcher Agent": Globe,
  "Analyzer Agent": BarChart3,
  "Strategist Agent": Target,
  "Reporter Agent": FileText,
};

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

      <p className="text-xs font-mono font-bold tracking-[0.2em] text-[#A259FF] uppercase mb-4 mt-6">EchoIntel Multi-Agent Network</p>
      <h1 className="text-6xl font-normal tracking-tight mb-8" style={{ fontFamily: "'Lora', serif" }}>
        Echo<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F24E1E] via-[#A259FF] to-[#1ABCFE] italic font-bold">Intel</span>
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
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const toggleStep = (id: string) => setExpandedSteps(prev => ({ ...prev, [id]: !prev[id] }));

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

  const handleDeleteCompetitor = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.deleteCompetitor(Number(id));
      setCompetitors(prev => prev.filter(c => c.id !== id));
      if (activeCompetitorId === id) {
        setActiveCompetitorId(null);
        setInputValue("");
      }
    } catch (err) {
      console.error("Failed to delete competitor:", err);
    }
  };

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

      const step1Done = { id: "s1", label: "Planner Agent", status: "done" as StepStatus, detail: "Formulated the research strategy", logs: ["✓ Identified core business model", "✓ Mapped out competitor landscape", "✓ Defined primary research vectors"], metrics: { "Research Goal": "Comprehensive competitive analysis", "Duration": "1.2s" } };
      
      const step2Active = { id: "s2", label: "Researcher Agent", status: "active" as StepStatus, detail: "Gathering and extracting web information", logs: ["✓ Website indexed", "✓ Pricing page crawled", "✓ API docs discovered", "Currently extracting product features..."], metrics: { "Websites visited": "12", "Pages crawled": "48" } };
      const step2Done = { id: "s2", label: "Researcher Agent", status: "done" as StepStatus, detail: "Gathered and extracted web information", logs: ["✓ Website indexed", "✓ Pricing page crawled", "✓ API docs discovered", "✓ Extracted product features", "✓ Analyzed customer reviews"], metrics: { "Websites visited": "14", "Pages crawled": "62", "Duration": "4.5s" } };

      const step3Active = { id: "s3", label: "Analyzer Agent", status: "active" as StepStatus, detail: "Comparing pricing models and market differentiation", logs: ["✓ Processed 62 pages", "✓ Identified 4 pricing tiers", "Currently comparing feature matrices..."], metrics: { "Signals extracted": "143", "Features mapped": "45" } };
      const step3Done = { id: "s3", label: "Analyzer Agent", status: "done" as StepStatus, detail: "Analyzed pricing and product signals", logs: ["✓ Processed 62 pages", "✓ Identified 4 pricing tiers", "✓ Compared feature matrices"], metrics: { "Signals extracted": "156", "Features mapped": "48", "Duration": "3.1s" } };

      const step4Done = { id: "s4", label: "Strategist Agent", status: "done" as StepStatus, detail: "Formulated strategic recommendations", logs: ["✓ Identified 3 key weaknesses", "✓ Mapped market opportunities"], metrics: { "Strategies formed": "5", "Duration": "2.0s" } };
      const step5Done = { id: "s5", label: "Reporter Agent", status: "done" as StepStatus, detail: "Generating an executive-ready competitor intelligence report", logs: ["✓ Synthesizing insights", "✓ Formatting executive summary"], metrics: { "Sections": "4", "Duration": "1.8s" } };

      setTimeout(() => setStep("scraping", [step1Done, step2Active, { id: "s3", label: "Analyzer Agent", status: "pending", detail: "Pending..." }, { id: "s4", label: "Strategist Agent", status: "pending", detail: "Pending..." }, { id: "s5", label: "Reporter Agent", status: "pending", detail: "Pending..." }]), 1500);

      setTimeout(() => setStep("analyzing", [step1Done, step2Done, step3Active, { id: "s4", label: "Strategist Agent", status: "pending", detail: "Pending..." }, { id: "s5", label: "Reporter Agent", status: "pending", detail: "Pending..." }]), 4500);
      
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
    if (!activeJob) return null;

    const total = activeJob.steps.length;
    const completed = activeJob.steps.filter(s => s.status === 'done').length;
    const running = activeJob.steps.filter(s => s.status === 'active').length;
    const progress = Math.round((completed / total) * 100);

    return (
      <div className="w-full">
         <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
               <span className="text-sm font-semibold text-[#111827]">Pipeline Execution</span>
               <div className="hidden sm:block h-4 w-px bg-[#E5E7EB]"></div>
               <span className="text-sm text-[#6B7280]">{total} AI Agents</span>
               <span className="text-sm text-[#6B7280]">&bull;</span>
               <span className="text-sm text-[#6B7280]">{completed} Completed</span>
               <span className="text-sm text-[#6B7280]">&bull;</span>
               <span className="text-sm text-[#3B82F6] font-medium">{running} Running</span>
            </div>
            <div className="flex items-center gap-3">
               <div className="w-24 sm:w-32 h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                  <div className="h-full bg-[#3B82F6] transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
               </div>
               <span className="text-sm font-mono font-medium text-[#111827]">{progress}%</span>
            </div>
         </div>

         <div className="relative">
           {/* Vertical Timeline Line */}
           <div className="absolute left-7 top-7 bottom-7 w-px bg-gradient-to-b from-[#E5E7EB] via-[#E5E7EB] to-transparent"></div>

           <div className="space-y-4 relative z-10">
             {activeJob.steps.map((step, idx) => {
               const isDone = step.status === 'done';
               const isActive = step.status === 'active';
               const Icon = AGENT_ICONS[step.label] || CheckCircle2;

               return (
                 <div key={step.id} className="relative group">
                   <div 
                     className={`flex items-start gap-4 sm:gap-5 p-4 rounded-xl border transition-all duration-200 ${isActive ? 'bg-white border-[#3B82F6]/30 shadow-sm ring-1 ring-[#3B82F6]/10' : 'bg-white border-transparent'}`}
                   >
                     {/* Icon */}
                     <div className={`shrink-0 flex items-center justify-center size-10 rounded-full border-2 transition-colors duration-500 bg-white ${isDone ? 'border-[#059669] text-[#059669]' : isActive ? 'border-[#3B82F6] text-[#3B82F6] shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'border-[#E5E7EB] text-[#9CA3AF]'}`}>
                       <Icon className={`size-4.5 ${isActive ? 'animate-pulse' : ''}`} />
                     </div>

                     {/* Main Content */}
                     <div className="flex-1 min-w-0 pt-0.5">
                       <div className="flex items-center justify-between mb-1">
                          <h4 className={`text-base font-semibold ${isActive ? 'text-[#3B82F6]' : isDone ? 'text-[#111827]' : 'text-[#6B7280]'}`}>{step.label}</h4>
                          <div className="flex items-center gap-3">
                             <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isDone ? 'bg-[#059669]/10 text-[#059669]' : isActive ? 'bg-[#3B82F6]/10 text-[#3B82F6]' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}>
                               {isDone ? 'DONE' : isActive ? 'ACTIVE' : 'WAITING'}
                             </span>
                          </div>
                       </div>
                       
                       <p className={`text-sm ${isActive ? 'text-[#111827]' : 'text-[#6B7280]'} mb-3`}>{step.detail}</p>
                     </div>
                   </div>
                 </div>
               );
             })}
           </div>
         </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FAFAFA] text-[#111827] font-sans relative">
      {/* Background Grid - Very low opacity */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(to right, #E5E7EB 1px, transparent 1px), linear-gradient(to bottom, #E5E7EB 1px, transparent 1px)', backgroundSize: '64px 64px', maskImage: 'radial-gradient(circle at center top, black, transparent 80%)' }} />
      
      {/* Subtle Radial Gradient behind Hero */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,_#eff6ff_0%,_transparent_70%)] pointer-events-none opacity-60 mix-blend-multiply" />

      {/* Header */}
      <header className="relative z-20 px-8 py-6 flex items-center justify-between max-w-7xl mx-auto w-full">
         <div className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight text-[#111827]">EchoIntel</span>
         </div>
         {competitors.length > 0 && (
           <button 
             onClick={() => { setActiveCompetitorId(null); setInputValue(""); }}
             className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-[#111827] text-sm font-medium hover:bg-[#F9FAFB] hover:shadow-sm hover:-translate-y-[1px] transition-all duration-200 shadow-sm"
           >
             <Search className="size-4" /> New Scan
           </button>
         )}
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10 w-full">
         <div className="max-w-5xl mx-auto px-6 pb-24">
            
            {!activeCompetitorId && !isRunning ? (
               <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
                  {/* Hero Section */}
                  <div className="max-w-[750px] mx-auto mt-16 md:mt-24 text-center">
                     <h1 className="text-5xl md:text-[64px] leading-tight font-bold tracking-tight text-[#111827] mb-4">
                        EchoIntel
                     </h1>
                     <h2 className="text-2xl md:text-4xl font-semibold text-[#111827] mb-6">
                        AI-powered Competitive Intelligence
                     </h2>
                     <p className="text-lg text-[#6B7280] leading-relaxed max-w-[650px] mx-auto mb-12">
                        Enter a competitor name or domain to generate an AI-powered analysis covering positioning, pricing, product strategy, messaging, strengths, weaknesses, and market opportunities.
                     </p>
                     
                     {/* Search Bar Group */}
                     <div className="max-w-[650px] mx-auto">
                        <div className="flex flex-col sm:flex-row items-stretch gap-3">
                           <div className="relative flex-1 group">
                             <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-[22px] text-[#6B7280] group-focus-within:text-[#3B82F6] transition-colors duration-200" />
                             <input 
                               type="text" 
                               placeholder="Enter a company name or website" 
                               className="flex h-[60px] w-full rounded-[14px] border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-2 pl-[56px] text-base shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition-all duration-200 placeholder:text-[#9CA3AF] text-[#111827]"
                               value={inputValue}
                               onChange={(e) => setInputValue(e.target.value)}
                               onKeyDown={(e) => e.key === 'Enter' && inputValue.trim() && runPipeline()}
                               autoComplete="off"
                               autoFocus
                             />
                           </div>
                           <button 
                             onClick={() => runPipeline()}
                             disabled={!inputValue.trim()}
                             className="inline-flex items-center justify-center whitespace-nowrap rounded-[14px] text-base font-medium shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-[1px] hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-[#3B82F6] text-white h-[60px] px-8 sm:w-auto w-full"
                           >
                             Run Analysis <span className="ml-2 font-serif text-xl leading-none">→</span>
                           </button>
                        </div>
                        
                        {/* Example Prompts */}
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                           <span className="text-sm font-medium text-[#6B7280] mr-2">Try:</span>
                           {['OpenAI', 'Stripe', 'Anthropic', 'Cursor', 'Notion'].map((prompt) => (
                              <button
                                 key={prompt}
                                 onClick={() => setInputValue(prompt)}
                                 className="px-4 py-1.5 rounded-full bg-[#F3F4F6] text-[#4B5563] text-sm font-medium hover:bg-[#E5E7EB] hover:text-[#111827] transition-colors"
                              >
                                 {prompt}
                              </button>
                           ))}
                        </div>
                     </div>
                  </div>

               </div>
            ) : (
               <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto mt-4">
                  {/* Enhanced Header */}
                  <div className="border-b border-[#E5E7EB] pb-8">
                     <div className="flex items-start justify-between">
                        <div>
                           <h2 className="text-4xl font-bold tracking-tight text-[#111827] mb-2">
                              {competitors.find(c => c.id === activeCompetitorId)?.name || inputValue}
                           </h2>
                           <p className="text-base text-[#6B7280] font-medium">Competitor Intelligence Report</p>
                        </div>
                        {isRunning && (
                           <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 shadow-sm animate-pulse">
                              <Loader2 className="size-4 animate-spin" />
                              <span className="text-sm font-semibold tracking-wide">ANALYZING</span>
                           </div>
                        )}
                        {activeJob?.status === 'complete' && (
                           <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#059669]/10 text-[#059669] border border-[#059669]/20 shadow-sm">
                              <CheckCircle2 className="size-4" />
                              <span className="text-sm font-semibold tracking-wide">COMPLETED</span>
                           </div>
                        )}
                     </div>

                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mt-8">
                        <div>
                           <div className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5">Website</div>
                           <div className="text-sm font-medium text-[#111827] truncate">
                             {competitors.find(c => c.id === activeCompetitorId)?.website || (inputValue.includes('.') ? inputValue : `${inputValue.toLowerCase().replace(/\s/g, '')}.com`)}
                           </div>
                        </div>
                        <div>
                           <div className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5">Started</div>
                           <div className="text-sm font-medium text-[#111827]">{fmtDateTime(activeJob?.startedAt || new Date().toISOString())}</div>
                        </div>
                        <div>
                           <div className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5">Status</div>
                           <div className="text-sm font-medium text-[#111827] truncate">
                             {isRunning ? activeJob?.steps.find(s => s.status === 'active')?.detail || 'Running...' : 'Complete'}
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-8">
                     {/* Pipeline Card */}
                     <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-sm">
                        {renderJobSteps()}
                     </div>

                     {/* Output */}
                     {(latestReport || activeJob?.status === 'complete') && (
                     <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {latestReport ? (
                           <>
                             <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-sm hover:shadow-md transition-shadow duration-200">
                               <h3 className="text-sm font-semibold uppercase tracking-wider text-[#6B7280] mb-4">Executive Summary</h3>
                               <p className="text-base text-[#374151] leading-relaxed">{latestReport.summary}</p>
                             </div>

                             <div className="space-y-4">
                                <h3 className="text-xl font-bold tracking-tight text-[#111827]">Key Findings</h3>
                                <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden bg-white shadow-sm">
                                   <table className="w-full text-sm text-left">
                                      <thead className="bg-[#F9FAFB] text-[#6B7280] text-xs uppercase font-semibold tracking-wider border-b border-[#E5E7EB]">
                                         <tr>
                                            <th className="px-6 py-4 w-40">Category</th>
                                            <th className="px-6 py-4">Finding Detail</th>
                                         </tr>
                                      </thead>
                                      <tbody className="divide-y divide-[#E5E7EB]">
                                         {latestReport.findings.map((f, i) => (
                                            <tr key={i} className="hover:bg-[#F9FAFB] transition-colors group">
                                               <td className="px-6 py-5 font-medium text-[#4B5563] align-top">{f.category}</td>
                                               <td className="px-6 py-5">
                                                  <div className="font-semibold text-[#111827] text-base mb-2">{f.title}</div>
                                                  <div className="text-[#6B7280] leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">{f.body}</div>
                                               </td>
                                            </tr>
                                         ))}
                                      </tbody>
                                   </table>
                                </div>
                             </div>

                             <div className="space-y-4">
                                <h3 className="text-xl font-bold tracking-tight text-[#111827]">Strategic Recommendations</h3>
                                <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden bg-white shadow-sm">
                                   <table className="w-full text-sm text-left">
                                      <thead className="bg-[#F9FAFB] text-[#6B7280] text-xs uppercase font-semibold tracking-wider border-b border-[#E5E7EB]">
                                         <tr>
                                            <th className="px-6 py-4 w-16 text-center">#</th>
                                            <th className="px-6 py-4">Action Item</th>
                                         </tr>
                                      </thead>
                                      <tbody className="divide-y divide-[#E5E7EB]">
                                         {latestReport.recommendations.map((rec, i) => (
                                            <tr key={i} className="hover:bg-[#F9FAFB] transition-colors">
                                               <td className="px-6 py-5 text-center text-[#9CA3AF] font-mono font-medium align-top">{i + 1}</td>
                                               <td className="px-6 py-5">
                                                  <div className="font-semibold text-[#111827] text-base mb-2">{rec.title}</div>
                                                  <div className="text-[#6B7280] leading-relaxed">{rec.description}</div>
                                               </td>
                                            </tr>
                                         ))}
                                      </tbody>
                                   </table>
                                </div>
                             </div>
                           </>
                        ) : (
                           <div className="flex flex-col items-center justify-center py-24 text-[#6B7280] bg-white rounded-2xl border border-[#E5E7EB] shadow-sm">
                             <Loader2 className="size-6 animate-spin mb-4 text-[#3B82F6]" /> 
                             <span className="text-sm font-medium">Synthesizing final report...</span>
                           </div>
                        )}
                     </div>
                  )}
                  </div>
               </div>
            )}
         </div>
      </main>
    </div>
  );
}
