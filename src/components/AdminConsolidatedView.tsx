import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  AuditFinding,
  AuditSession,
  ChatInteraction,
  AuditReport,
  IshikawaCategory,
  SeverityLevel,
} from '../types';
import { collection, collectionGroup, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  BarChart2,
  TrendingUp,
  FileSpreadsheet,
  FileText,
  Download,
  Copy,
  Check,
  AlertTriangle,
  Sparkles,
  Eye,
  Calendar,
  Users,
  Building2,
  Bot,
  User,
} from 'lucide-react';
import { Modal } from './Modal';
import { SafeMarkdown } from './SafeMarkdown';

interface AdminConsolidatedViewProps {
  onError: (msg: string, retryFn?: () => void) => void;
}

const ISHIKAWA_CATEGORIES: IshikawaCategory[] = [
  'Man',
  'Machine',
  'Method',
  'Material',
  'Measurement',
  'Environment',
];

const SEVERITIES: SeverityLevel[] = ['Low', 'Medium', 'High', 'Critical'];

export const AdminConsolidatedView: React.FC<AdminConsolidatedViewProps> = ({ onError }) => {
  const { user, token } = useAuth();

  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [interactions, setInteractions] = useState<ChatInteraction[]>([]);
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [auditAreas, setAuditAreas] = useState<any[]>([]);

  // Track independent query errors separately
  const [queryErrors, setQueryErrors] = useState<Record<string, string>>({});

  // Report generation state
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [activeReportModal, setActiveReportModal] = useState<AuditReport | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  // Session read-only inspection modal
  const [inspectingSession, setInspectingSession] = useState<AuditSession | null>(null);

  // Load each admin query separately per Directive 8 requirement
  useEffect(() => {
    if (!user) return;

    // 1. Load collection group: findings
    let unsubFindings: () => void;
    try {
      const q = collectionGroup(db, 'findings');
      unsubFindings = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => d.data() as AuditFinding);
          setFindings(items);
          setQueryErrors((prev) => {
            const next = { ...prev };
            delete next.findings;
            return next;
          });
        },
        (err) => {
          console.error('Admin query failed for collection group: findings', err);
          setQueryErrors((prev) => ({
            ...prev,
            findings: `Collection group 'findings' failed: ${err.message}`,
          }));
        }
      );
    } catch (e: any) {
      setQueryErrors((prev) => ({
        ...prev,
        findings: `Collection group 'findings' exception: ${e.message}`,
      }));
    }

    // 2. Load collection group: sessions
    let unsubSessions: () => void;
    try {
      const q = collectionGroup(db, 'sessions');
      unsubSessions = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => d.data() as AuditSession);
          items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setSessions(items);
          setQueryErrors((prev) => {
            const next = { ...prev };
            delete next.sessions;
            return next;
          });
        },
        (err) => {
          console.error('Admin query failed for collection group: sessions', err);
          setQueryErrors((prev) => ({
            ...prev,
            sessions: `Collection group 'sessions' failed: ${err.message}`,
          }));
        }
      );
    } catch (e: any) {
      setQueryErrors((prev) => ({
        ...prev,
        sessions: `Collection group 'sessions' exception: ${e.message}`,
      }));
    }

    // 3. Load collection group: interactions
    let unsubInteractions: () => void;
    try {
      const q = collectionGroup(db, 'interactions');
      unsubInteractions = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => d.data() as ChatInteraction);
          setInteractions(items);
          setQueryErrors((prev) => {
            const next = { ...prev };
            delete next.interactions;
            return next;
          });
        },
        (err) => {
          console.error('Admin query failed for collection group: interactions', err);
          setQueryErrors((prev) => ({
            ...prev,
            interactions: `Collection group 'interactions' failed: ${err.message}`,
          }));
        }
      );
    } catch (e: any) {
      setQueryErrors((prev) => ({
        ...prev,
        interactions: `Collection group 'interactions' exception: ${e.message}`,
      }));
    }

    // 4. Load collection: auditReports
    let unsubReports: () => void;
    try {
      const q = collection(db, 'auditReports');
      unsubReports = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => d.data() as AuditReport);
          items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setReports(items);
          setQueryErrors((prev) => {
            const next = { ...prev };
            delete next.auditReports;
            return next;
          });
        },
        (err) => {
          console.error('Admin query failed for collection: auditReports', err);
          setQueryErrors((prev) => ({
            ...prev,
            auditReports: `Collection 'auditReports' failed: ${err.message}`,
          }));
        }
      );
    } catch (e: any) {
      setQueryErrors((prev) => ({
        ...prev,
        auditReports: `Collection 'auditReports' exception: ${e.message}`,
      }));
    }

    // 5. Load collection: auditAreas
    let unsubAreas: () => void;
    try {
      const q = collection(db, 'auditAreas');
      unsubAreas = onSnapshot(q, (snapshot) => {
        setAuditAreas(snapshot.docs.map((d) => d.data()));
      });
    } catch (e) {
      // ignore
    }

    return () => {
      unsubFindings?.();
      unsubSessions?.();
      unsubInteractions?.();
      unsubReports?.();
      unsubAreas?.();
    };
  }, [user]);

  // Generate Consolidated Report via Gemini API
  const handleGenerateReport = async () => {
    if (findings.length === 0) {
      onError('Cannot generate consolidated report: No audit findings exist across employees.');
      return;
    }

    setIsGeneratingReport(true);
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Report synthesis failed');
      }

      const data = await res.json();
      if (data.report) {
        setActiveReportModal(data.report);
      }
    } catch (err: any) {
      console.error('Report generation error:', err);
      onError(err?.message || 'Failed to generate consolidated report', handleGenerateReport);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const copyMarkdown = (markdown: string) => {
    navigator.clipboard.writeText(markdown);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const downloadMarkdown = (report: AuditReport) => {
    const blob = new Blob([report.fullMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.title.replace(/\s+/g, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Pareto Chart Data Preparation
  // 1. Count findings per Ishikawa category
  const categoryCounts: Record<IshikawaCategory, number> = {
    Man: 0,
    Machine: 0,
    Method: 0,
    Material: 0,
    Measurement: 0,
    Environment: 0,
  };
  findings.forEach((f) => {
    if (categoryCounts[f.ishikawaCategory] !== undefined) {
      categoryCounts[f.ishikawaCategory]++;
    }
  });

  // 2. Sort descending
  const paretoData = Object.entries(categoryCounts)
    .map(([cat, count]) => ({ category: cat as IshikawaCategory, count }))
    .sort((a, b) => b.count - a.count);

  const totalFindings = findings.length || 1;
  let cumulativeCount = 0;
  const paretoWithCumulative = paretoData.map((item) => {
    cumulativeCount += item.count;
    return {
      ...item,
      cumulativePercent: Math.round((cumulativeCount / totalFindings) * 100),
    };
  });

  const maxCount = Math.max(...paretoData.map((d) => d.count), 5);

  // Department x Severity Matrix Preparation
  const departments = Array.from(new Set(findings.map((f) => f.department || 'Company-wide'))).sort();
  const matrix: Record<string, Record<SeverityLevel, number>> = {};
  departments.forEach((dept) => {
    matrix[dept] = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  });

  findings.forEach((f) => {
    const dept = f.department || 'Company-wide';
    if (!matrix[dept]) {
      matrix[dept] = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    }
    if (matrix[dept][f.severity] !== undefined) {
      matrix[dept][f.severity]++;
    }
  });

  // Severity Totals
  const severityTotals: Record<SeverityLevel, number> = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  findings.forEach((f) => {
    if (severityTotals[f.severity] !== undefined) severityTotals[f.severity]++;
  });

  // Filter interactions & findings for inspect modal
  const sessionInteractions = inspectingSession
    ? interactions
        .filter((i) => i.sessionId === inspectingSession.sessionId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : [];

  const sessionFindings = inspectingSession
    ? findings.filter((f) => f.sessionId === inspectingSession.sessionId)
    : [];

  return (
    <div className="space-y-8">
      {/* Query Errors Display (Directive 8: show which collection failed) */}
      {Object.keys(queryErrors).length > 0 && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl space-y-1">
          <div className="flex items-center gap-2 text-red-900 font-semibold text-xs">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>Administrative Collection Query Error</span>
          </div>
          {Object.entries(queryErrors).map(([col, err]) => (
            <p key={col} className="text-xs text-red-800">
              <strong>[{col}]:</strong> {err}
            </p>
          ))}
        </div>
      )}

      {/* Overview Cards & Report Generation Button */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            Consolidated Quality Audit Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Super Administrator cross-user analytics, Ishikawa (6M) Pareto distribution, departmental risk
            matrices, and AI executive synthesis.
          </p>
        </div>

        <button
          onClick={handleGenerateReport}
          disabled={isGeneratingReport || findings.length === 0}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-semibold rounded-xl shadow-md transition-all disabled:opacity-50 shrink-0"
        >
          <Sparkles className={`w-4 h-4 ${isGeneratingReport ? 'animate-spin' : ''}`} />
          <span>{isGeneratingReport ? 'Synthesizing with Gemini...' : 'Generate Consolidated Audit Report'}</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total Findings Logged</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{findings.length}</div>
          <span className="text-[10px] text-slate-400">Across all Infosoft employees</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Critical / High Severity</span>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {severityTotals.Critical + severityTotals.High}
          </div>
          <span className="text-[10px] text-slate-400">Immediate CAPA priority</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total Audit Interviews</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{sessions.length}</div>
          <span className="text-[10px] text-slate-400">
            {sessions.filter((s) => s.status === 'completed').length} completed
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Executive Reports</span>
          <div className="text-2xl font-bold text-indigo-600 mt-1">{reports.length}</div>
          <span className="text-[10px] text-slate-400">AI Synthesized & Archived</span>
        </div>
      </div>

      {/* 1. Pareto Chart: Ishikawa (6M) Category Analysis */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-600" />
              Ishikawa (6M) Pareto Analysis
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Categories sorted in descending order of frequency. The secondary axis plots cumulative % with
              an 80% Pareto threshold marker.
            </p>
          </div>
          <div className="text-xs flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-3 bg-indigo-600 rounded-xs inline-block" /> Bars: Finding Count
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-3 h-0.5 bg-amber-500 inline-block border-t-2 border-amber-500" /> Line:
              Cumulative %
            </span>
          </div>
        </div>

        {findings.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-400">
            No findings recorded yet to render Pareto analysis.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div className="min-w-[600px] h-72 relative">
              <svg className="w-full h-full" viewBox="0 0 650 260">
                {/* Horizontal Grid lines */}
                {[0, 25, 50, 75, 100].map((pct) => {
                  const y = 220 - (pct / 100) * 180;
                  return (
                    <g key={pct}>
                      <line x1="60" y1={y} x2="580" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                      <text x="45" y={y + 4} fontSize="10" fill="#94a3b8" textAnchor="end">
                        {Math.round((pct / 100) * maxCount)}
                      </text>
                      <text x="590" y={y + 4} fontSize="10" fill="#f59e0b" textAnchor="start">
                        {pct}%
                      </text>
                    </g>
                  );
                })}

                {/* 80% Pareto Reference Line */}
                <line
                  x1="60"
                  y1={220 - 0.8 * 180}
                  x2="580"
                  y2={220 - 0.8 * 180}
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <text x="540" y={220 - 0.8 * 180 - 4} fontSize="9" fill="#ef4444" fontWeight="bold">
                  80% Pareto Cutoff
                </text>

                {/* Bars & Points */}
                {paretoWithCumulative.map((item, idx) => {
                  const barWidth = 48;
                  const x = 85 + idx * 80;
                  const barHeight = (item.count / maxCount) * 180;
                  const barY = 220 - barHeight;

                  return (
                    <g key={item.category} className="group cursor-pointer">
                      {/* Bar */}
                      <rect
                        x={x}
                        y={barY}
                        width={barWidth}
                        height={barHeight}
                        rx="4"
                        className="fill-indigo-600 hover:fill-indigo-700 transition-colors"
                      />
                      <text
                        x={x + barWidth / 2}
                        y={barY - 6}
                        fontSize="11"
                        fontWeight="bold"
                        fill="#1e293b"
                        textAnchor="middle"
                      >
                        {item.count}
                      </text>

                      {/* Category Label */}
                      <text
                        x={x + barWidth / 2}
                        y="242"
                        fontSize="11"
                        fontWeight="600"
                        fill="#475569"
                        textAnchor="middle"
                      >
                        {item.category}
                      </text>
                    </g>
                  );
                })}

                {/* Cumulative Percentage Polyline */}
                {(() => {
                  const points = paretoWithCumulative
                    .map((item, idx) => {
                      const x = 85 + idx * 80 + 24;
                      const y = 220 - (item.cumulativePercent / 100) * 180;
                      return `${x},${y}`;
                    })
                    .join(' ');

                  return (
                    <>
                      <polyline
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        points={points}
                      />
                      {paretoWithCumulative.map((item, idx) => {
                        const x = 85 + idx * 80 + 24;
                        const y = 220 - (item.cumulativePercent / 100) * 180;
                        return (
                          <g key={idx}>
                            <circle cx={x} cy={y} r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                            <text
                              x={x}
                              y={y - 8}
                              fontSize="10"
                              fontWeight="bold"
                              fill="#b45309"
                              textAnchor="middle"
                            >
                              {item.cumulativePercent}%
                            </text>
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* 2. Department x Severity Risk Matrix */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              Findings by Department & Severity Matrix
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Heatmap breakdown of quality bottlenecks across organizational units.
            </p>
          </div>
        </div>

        {departments.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No departmental findings recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                  <th className="py-2.5 px-4">Department</th>
                  <th className="py-2.5 px-3 text-center text-slate-600">Low</th>
                  <th className="py-2.5 px-3 text-center text-blue-700">Medium</th>
                  <th className="py-2.5 px-3 text-center text-orange-700">High</th>
                  <th className="py-2.5 px-3 text-center text-red-700">Critical</th>
                  <th className="py-2.5 px-4 text-right font-bold text-slate-900">Total Findings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {departments.map((dept) => {
                  const row = matrix[dept] || { Low: 0, Medium: 0, High: 0, Critical: 0 };
                  const rowTotal = row.Low + row.Medium + row.High + row.Critical;

                  return (
                    <tr key={dept} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-medium flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{dept}</span>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-600 font-mono">
                        {row.Low > 0 ? (
                          <span className="px-2 py-0.5 bg-slate-100 rounded-md">{row.Low}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-3 text-center text-blue-700 font-mono">
                        {row.Medium > 0 ? (
                          <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 rounded-md font-semibold">
                            {row.Medium}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-3 text-center text-orange-700 font-mono">
                        {row.High > 0 ? (
                          <span className="px-2 py-0.5 bg-orange-50 border border-orange-200 rounded-md font-bold">
                            {row.High}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-3 text-center text-red-700 font-mono">
                        {row.Critical > 0 ? (
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 border border-red-300 rounded-md font-bold">
                            {row.Critical}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold font-mono text-slate-900">
                        {rowTotal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                  <td className="py-2.5 px-4">All Departments Combined</td>
                  <td className="py-2.5 px-3 text-center font-mono">{severityTotals.Low}</td>
                  <td className="py-2.5 px-3 text-center text-blue-700 font-mono">
                    {severityTotals.Medium}
                  </td>
                  <td className="py-2.5 px-3 text-center text-orange-700 font-mono">
                    {severityTotals.High}
                  </td>
                  <td className="py-2.5 px-3 text-center text-red-700 font-mono">
                    {severityTotals.Critical}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono">{findings.length}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 3. Users' Audit Sessions List (with read-only inspection) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Employee Audit Interviews ({sessions.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any interview to inspect its read-only transcript, executive summary, and logged process
            findings.
          </p>
        </div>

        {sessions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No sessions recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                  <th className="py-2.5 px-4">Employee</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Interview Date</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {sessions.map((s) => (
                  <tr key={s.sessionId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {s.userDisplayName || 'Infosoft Employee'}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{s.userDepartment || '-'}</td>
                    <td className="py-3 px-3 text-slate-600">{s.userRole || '-'}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          s.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                      >
                        {s.status === 'completed' ? 'Completed' : 'In Progress'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {new Date(s.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setInspectingSession(s)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium text-[11px] transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect Audit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Generated Consolidated Reports Archive */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Archived TQM Consolidated Reports ({reports.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Previous executive audit reports synthesized by Gemini. Exportable as Markdown.
          </p>
        </div>

        {reports.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No consolidated reports generated yet. Click "Generate Consolidated Audit Report" above.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {reports.map((rep) => (
              <div
                key={rep.reportId}
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-sm">{rep.title}</h4>
                  <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(rep.createdAt).toLocaleString()}
                    </span>
                    <span>&bull;</span>
                    <span>Analyzed {rep.totalFindingsAnalyzed} employee findings</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setActiveReportModal(rep)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg border border-indigo-200 transition-colors"
                  >
                    View Report
                  </button>
                  <button
                    onClick={() => downloadMarkdown(rep)}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors"
                    title="Export Markdown File"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report Modal Viewer */}
      <Modal
        isOpen={Boolean(activeReportModal)}
        onClose={() => setActiveReportModal(null)}
        title={activeReportModal?.title || 'TQM Consolidated Audit Report'}
        maxWidth="max-w-4xl"
      >
        {activeReportModal && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500">
                Generated: {new Date(activeReportModal.createdAt).toLocaleString()} &bull; Total Findings:{' '}
                {activeReportModal.totalFindingsAnalyzed}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyMarkdown(activeReportModal.fullMarkdown)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-md font-medium text-slate-700 transition-colors"
                >
                  {copiedReport ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedReport ? 'Copied' : 'Copy Markdown'}
                </button>
                <button
                  onClick={() => downloadMarkdown(activeReportModal)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .md
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 max-h-[60vh] overflow-y-auto text-xs sm:text-sm font-sans leading-relaxed text-slate-800 space-y-4">
              <div className="whitespace-pre-wrap font-mono text-xs bg-slate-50/50 p-4 rounded-lg border border-slate-100">
                {activeReportModal.fullMarkdown}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Read-Only Session Inspector Modal */}
      <Modal
        isOpen={Boolean(inspectingSession)}
        onClose={() => setInspectingSession(null)}
        title={`Audit Session Inspection: ${inspectingSession?.userDisplayName || 'Employee'}`}
        maxWidth="max-w-4xl"
      >
        {inspectingSession && (
          <div className="space-y-6 text-xs">
            {/* Metadata Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px]">Employee</span>
                <span className="font-semibold text-slate-900">{inspectingSession.userDisplayName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Department</span>
                <span className="font-semibold text-slate-900">{inspectingSession.userDepartment}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Role</span>
                <span className="font-semibold text-slate-900">{inspectingSession.userRole}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Interview Stage</span>
                <span className="font-semibold text-indigo-700">{inspectingSession.stage}</span>
              </div>
            </div>

            {/* Summary */}
            {inspectingSession.summary && (
              <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl">
                <h4 className="font-bold text-emerald-900 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Session Summary
                </h4>
                <div className="bg-white/70 p-3 rounded-lg border border-emerald-100">
                  <SafeMarkdown content={inspectingSession.summary} className="text-xs text-slate-700 leading-relaxed" />
                </div>
              </div>
            )}

            {/* Session Findings */}
            <div>
              <h4 className="font-bold text-slate-800 mb-2">Findings Identified ({sessionFindings.length})</h4>
              {sessionFindings.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-slate-400 text-center">
                  No findings logged in this session.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sessionFindings.map((f) => (
                    <div
                      key={f.findingId}
                      className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{f.ishikawaCategory} (6M)</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                          {f.severity}
                        </span>
                      </div>
                      <p className="text-slate-700 line-clamp-2">{f.description}</p>
                      {f.suggestedImprovement && (
                        <p className="text-emerald-700 text-[11px]">
                          <strong>Remedy:</strong> {f.suggestedImprovement}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Transcript */}
            <div>
              <h4 className="font-bold text-slate-800 mb-2">
                Interview Transcript ({sessionInteractions.length} Messages)
              </h4>
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-80 overflow-y-auto">
                {sessionInteractions.map((msg) => {
                  const isAgent = msg.role === 'agent';
                  return (
                    <div
                      key={msg.interactionId}
                      className={`flex gap-3 leading-relaxed ${
                        isAgent ? 'mr-auto' : 'ml-auto flex-row-reverse'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center font-bold text-[10px] ${
                          isAgent ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-white'
                        }`}
                      >
                        {isAgent ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                      </div>
                      <div
                        className={`p-3 rounded-xl max-w-lg ${
                          isAgent
                            ? 'bg-white border border-slate-200 text-slate-800'
                            : 'bg-indigo-600 text-white'
                        }`}
                      >
                        {isAgent ? (
                          <SafeMarkdown content={msg.content} className="text-slate-800 text-xs" />
                        ) : (
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        )}
                        <div
                          className={`mt-1 text-[9px] ${
                            isAgent ? 'text-slate-400' : 'text-indigo-200'
                          }`}
                        >
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
