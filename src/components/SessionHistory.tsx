import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuditSession, ChatInteraction, AuditFinding } from '../types';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Calendar,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Bot,
  User,
} from 'lucide-react';
import { Modal } from './Modal';
import { SafeMarkdown } from './SafeMarkdown';

interface SessionHistoryProps {
  onSelectSession: (session: AuditSession) => void;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({ onSelectSession }) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [allInteractions, setAllInteractions] = useState<ChatInteraction[]>([]);
  const [allFindings, setAllFindings] = useState<AuditFinding[]>([]);
  const [inspectingSession, setInspectingSession] = useState<AuditSession | null>(null);

  useEffect(() => {
    if (!user) return;

    // Load sessions
    const sessionsRef = collection(db, 'users', user.uid, 'sessions');
    const unsubSessions = onSnapshot(sessionsRef, (snapshot) => {
      const items = snapshot.docs
        .map((d) => d.data() as AuditSession)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSessions(items);
    });

    // Load interactions
    const interactionsRef = collection(db, 'users', user.uid, 'interactions');
    const unsubInteractions = onSnapshot(interactionsRef, (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as ChatInteraction);
      setAllInteractions(items);
    });

    // Load findings
    const findingsRef = collection(db, 'users', user.uid, 'findings');
    const unsubFindings = onSnapshot(findingsRef, (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as AuditFinding);
      setAllFindings(items);
    });

    return () => {
      unsubSessions();
      unsubInteractions();
      unsubFindings();
    };
  }, [user]);

  const inspectInteractions = inspectingSession
    ? allInteractions
        .filter((i) => i.sessionId === inspectingSession.sessionId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    : [];

  const inspectFindings = inspectingSession
    ? allFindings.filter((f) => f.sessionId === inspectingSession.sessionId)
    : [];

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900">Audit Session History</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Review your previous quality audit interviews, transcripts, summaries, and identified process
          findings.
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-700">No Past Sessions</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            You haven't conducted any audit sessions yet. Click "New Audit Session" to start your first
            interview!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sessions.map((s) => {
            const sessionFindings = allFindings.filter((f) => f.sessionId === s.sessionId);
            const isCompleted = s.status === 'completed';

            return (
              <div
                key={s.sessionId}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                    >
                      {isCompleted ? 'Completed' : 'In Progress'}
                    </span>

                    <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                      Stage: {s.stage}
                    </span>

                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(s.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  {s.selectedAuditAreaNames && s.selectedAuditAreaNames.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <span className="text-slate-500 font-medium">Audit Areas:</span>
                      {s.selectedAuditAreaNames.map((name, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-md text-[11px]"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}

                  {s.summary ? (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <strong>Executive Summary:</strong> {s.summary}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Interview in progress.</p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-semibold text-slate-800">
                      {sessionFindings.length} Finding{sessionFindings.length === 1 ? '' : 's'}
                    </div>
                    <div className="text-[11px] text-slate-400">Recorded</div>
                  </div>

                  {s.status === 'active' ? (
                    <button
                      onClick={() => onSelectSession(s)}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
                    >
                      Resume Interview
                    </button>
                  ) : (
                    <button
                      onClick={() => setInspectingSession(s)}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors border border-slate-200 flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      View Transcript
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Transcript & Summary Modal */}
      <Modal
        isOpen={Boolean(inspectingSession)}
        onClose={() => setInspectingSession(null)}
        title="Session Details & Transcript"
        maxWidth="max-w-4xl"
      >
        {inspectingSession && (
          <div className="space-y-6">
            {/* Summary Block */}
            {inspectingSession.summary && (
              <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl text-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Consolidated Session Summary
                </h4>
                <div className="bg-white/70 p-3.5 rounded-lg border border-emerald-100">
                  <SafeMarkdown content={inspectingSession.summary} className="text-xs text-slate-700 leading-relaxed" />
                </div>
              </div>
            )}

            {/* Session Findings */}
            {inspectFindings.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Findings Logged in this Session ({inspectFindings.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {inspectFindings.map((f) => (
                    <div
                      key={f.findingId}
                      className="bg-white border border-slate-200 p-3 rounded-xl text-xs space-y-1.5 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{f.ishikawaCategory} (6M)</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
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
              </div>
            )}

            {/* Transcript Log */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Interview Transcript ({inspectInteractions.length} Messages)
              </h4>
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-96 overflow-y-auto">
                {inspectInteractions.map((msg) => {
                  const isAgent = msg.role === 'agent';
                  return (
                    <div
                      key={msg.interactionId}
                      className={`flex gap-3 text-xs leading-relaxed ${
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
