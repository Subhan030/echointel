/// <reference types="vite/client" />
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Competitor {
  id: number;
  name: string;
  domain: string;
  industry: string | null;
  tracked_keywords: string[];
  last_scraped_at: string | null;
}

export interface Job {
  id: number;
  competitor_id: number;
  status: string;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  report_id: number | null;
}

export interface Report {
  id: number;
  competitor_id: number;
  generated_at: string;
  summary: string | null;
  findings: any;
  raw_sources: string[];
  status: string;
}

export const api = {
  getCompetitors: async (): Promise<Competitor[]> => {
    const res = await fetch(`${API_BASE}/competitors`);
    if (!res.ok) throw new Error('Failed to fetch competitors');
    return res.json();
  },
  
  getCompetitor: async (id: number): Promise<Competitor> => {
    const res = await fetch(`${API_BASE}/competitors/${id}`);
    if (!res.ok) throw new Error('Failed to fetch competitor');
    return res.json();
  },
  
  createCompetitor: async (data: {name: string, domain: string, industry?: string}): Promise<Competitor> => {
    const res = await fetch(`${API_BASE}/competitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create competitor');
    return res.json();
  },
  
  deleteCompetitor: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/competitors/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete competitor');
  },
  
  runPipeline: async (id: number): Promise<Job> => {
    const res = await fetch(`${API_BASE}/competitors/${id}/run`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to trigger run');
    return res.json();
  },
  
  getJob: async (id: number): Promise<Job> => {
    const res = await fetch(`${API_BASE}/jobs/${id}`);
    if (!res.ok) throw new Error('Failed to fetch job');
    return res.json();
  },
  
  getReports: async (competitorId: number): Promise<Report[]> => {
    const res = await fetch(`${API_BASE}/competitors/${competitorId}/reports`);
    if (!res.ok) throw new Error('Failed to fetch reports');
    return res.json();
  },

  getReport: async (id: number): Promise<Report> => {
    const res = await fetch(`${API_BASE}/reports/${id}`);
    if (!res.ok) throw new Error('Failed to fetch report');
    return res.json();
  }
};
