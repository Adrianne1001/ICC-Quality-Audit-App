import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  AuditSession,
  ChatInteraction,
  InterviewStage,
  AuditFinding,
} from '../types';
import {
  Send,
  Bot,
  User,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ChevronRight,
  StopCircle,
  Sparkles,
  Info,
} from 'lucide-react';
import { Modal } from './Modal';
import { SafeMarkdown } from './SafeMarkdown';
import { doc, onSnapshot, collection, query, orderBy, setDoc } from 'firebase/firestore';
import { db, stripUndefined } from '../firebase';

interface AuditChatProps {
  session: AuditSession;
  onSessionUpdated: (session: AuditSession) => void;
  onError: (errorMsg: string, retryFn?: () => void, hasInputIntact?: boolean) => void;
}

const STAGES: { key: InterviewStage; label: string; desc: string }[] = [
  { key: 'ProcessWalkthrough', label: 'Process Walkthrough', desc: 'Map standard workflows' },
  { key: 'Difficulties', label: 'Difficulties', desc: 'Identify bottlenecks & friction' },
  { key: 'Complaints', label: 'Complaints', desc: 'Examine customer & internal friction' },
  { key: 'RootCauses', label: 'Root Causes', desc: 'Ishikawa 6M causal analysis' },
  { key: 'Suggestions', label: 'Suggestions', desc: 'Brainstorm preventative remedies' },
  { key: 'Recap', label: 'Recap', desc: 'Consolidated audit synthesis' },
];

export const AuditChat: React.FC<AuditChatProps> = ({ session, onSessionUpdated, onError }) => {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<ChatInteraction[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [confirmEndModal, setConfirmEndModal] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [newFindingsAlert, setNewFindingsAlert] = useState<AuditFinding[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Subscribe to interactions for this session from Firestore
  useEffect(() => {
    if (!user || !session.sessionId) return;

    const interactionsRef = collection(db, 'users', user.uid, 'interactions');
    const unsub = onSnapshot(
      interactionsRef,
      (snapshot) => {
        const items = snapshot.docs
          .map((d) => d.data() as ChatInteraction)
          .filter((i) => i.sessionId === session.sessionId)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setMessages(items);
      },
      (err) => {
        console.error('Chat snapshot error:', err);
      }
    );

    // Subscribe to session doc updates (stage, status, summary)
    const sessionDocRef = doc(db, 'users', user.uid, 'sessions', session.sessionId);
    const unsubSession = onSnapshot(
      sessionDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onSessionUpdated(snapshot.data() as AuditSession);
        }
      },
      (err) => {
        console.error('Session listener error:', err);
      }
    );

    return () => {
      unsub();
      unsubSession();
    };
  }, [user, session.sessionId]);

  // UUID generator for idempotent clientMessageId
  const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // If newly created session has no messages, prompt initial agent greeting
  useEffect(() => {
    if (messages.length === 0 && !isSending && session.status === 'active' && token) {
      sendMessage('');
    }
  }, [session.sessionId]);

  const sendMessage = async (customText?: string, existingClientMessageId?: string) => {
    const isCustom = customText !== undefined;
    const textToSend = isCustom ? customText : inputMessage.trim();

    if (textToSend.length > 2000) {
      onError('Message exceeds 2,000 character limit.', undefined, true);
      return;
    }

    if (!isCustom && !textToSend) return;

    // Requirement 2: clientMessageId (crypto.randomUUID()) once per user message, reused on Retry
    const clientMessageId = existingClientMessageId || generateUUID();

    // Clear user typed input upon sending
    if (!isCustom) {
      setInputMessage('');
    }

    setIsSending(true);
    setNewFindingsAlert([]);

    const attemptSend = async () => {
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: session.sessionId,
            message: textToSend,
            clientMessageId,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error('Chat endpoint error response details:', res.status, errData);

          const isBusy =
            res.status === 503 ||
            res.status === 429 ||
            errData?.isBusy ||
            String(errData?.error || '').includes('busy') ||
            String(errData?.error || '').includes('503') ||
            String(errData?.error || '').includes('429');

          if (isBusy) {
            const busyErr = new Error('The AI service is busy right now. Your message is saved. Click Retry in a few seconds.');
            (busyErr as any).isBusy = true;
            (busyErr as any).details = errData;
            throw busyErr;
          }

          const rawError = errData?.error;
          const cleanMsg = typeof rawError === 'string' && !rawError.trim().startsWith('{')
            ? rawError
            : `Server responded with ${res.status}`;
          throw new Error(cleanMsg);
        }

        const data = await res.json();
        if (data.newFindings && data.newFindings.length > 0) {
          setNewFindingsAlert(data.newFindings);
        }
      } catch (err: any) {
        console.error('Failed to send message:', err);

        const isBusy =
          err?.isBusy ||
          err?.message?.includes('busy right now') ||
          err?.message?.includes('503') ||
          err?.message?.includes('429');

        const toastMsg = isBusy
          ? 'The AI service is busy right now. Your message is saved. Click Retry in a few seconds.'
          : (err?.message || 'Audit Agent communication failure');

        // Only say "your input remains intact" when the input box really still has the text.
        // If the user's input was sent, inputMessage is cleared and the message is saved on server, so inputActuallyHasText is false.
        const inputActuallyHasText = Boolean(inputMessage.trim().length > 0);

        onError(
          toastMsg,
          () => sendMessage(textToSend, clientMessageId),
          inputActuallyHasText
        );
      } finally {
        setIsSending(false);
      }
    };

    await attemptSend();
  };

  const handleEndSession = async () => {
    setEndingSession(true);
    try {
      const res = await fetch('/api/sessions/end', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });

      if (!res.ok) {
        throw new Error('Failed to end session');
      }

      setConfirmEndModal(false);
    } catch (err: any) {
      console.error('Failed to conclude session:', err);
      onError(err?.message || 'Failed to conclude session', handleEndSession);
    } finally {
      setEndingSession(false);
    }
  };

  const currentStageIndex = STAGES.findIndex((s) => s.key === session.stage);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-5xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Active Audit Areas Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-700">
          <FileCheck className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="font-semibold">Active Baseline Audit Areas:</span>
          {session.selectedAuditAreaNames && session.selectedAuditAreaNames.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 ml-1">
              {session.selectedAuditAreaNames.map((name, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-medium"
                >
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-slate-400 italic">General Company Processes</span>
          )}
        </div>

        {session.status === 'active' && (
          <button
            onClick={() => setConfirmEndModal(true)}
            className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg border border-red-200 transition-colors text-xs"
          >
            <StopCircle className="w-3.5 h-3.5" />
            End Session
          </button>
        )}
      </div>

      {/* TQM Interview Stage Progress Indicator */}
      <div className="bg-slate-100/70 border-b border-slate-200 px-4 py-2 overflow-x-auto">
        <div className="flex items-center min-w-max justify-between gap-2">
          {STAGES.map((s, idx) => {
            const isCompleted = idx < currentStageIndex || session.status === 'completed';
            const isCurrent = idx === currentStageIndex && session.status !== 'completed';

            return (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors ${
                    isCurrent
                      ? 'bg-indigo-600 text-white font-semibold shadow-xs ring-2 ring-indigo-200'
                      : isCompleted
                      ? 'bg-emerald-100 text-emerald-800 font-medium'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full bg-current/20 flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                  )}
                  <span>{s.label}</span>
                </div>
                {idx < STAGES.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* New Findings Notification Banner: shows every finding saved in that turn (Requirement 4) */}
      {newFindingsAlert.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-xs text-amber-950 animate-in slide-in-from-top-2 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-900">
                    {newFindingsAlert.length === 1
                      ? 'Finding Recorded in this turn:'
                      : `${newFindingsAlert.length} Findings Recorded in this turn:`}
                  </span>
                  <span className="text-[11px] text-amber-800">
                    Saved with status Pending in My Findings
                  </span>
                </div>
                <div className="space-y-1.5 mt-1">
                  {newFindingsAlert.map((f, idx) => (
                    <div
                      key={f.findingId || idx}
                      className="bg-white/90 border border-amber-200/90 rounded-lg p-2.5 text-slate-800 flex flex-col sm:flex-row sm:items-baseline gap-2 text-[11px] shadow-2xs"
                    >
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        {f.relatedStandard && f.relatedStandard !== 'No matching standard' ? (
                          <span className="font-mono font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px]">
                            {f.relatedStandard}
                          </span>
                        ) : (
                          <span className="font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px]">
                            No matching standard
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 font-semibold rounded text-[10px]">
                          {f.ishikawaCategory}
                        </span>
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-medium rounded text-[10px]">
                          {f.severity}
                        </span>
                        <span className="text-slate-500 font-medium">[{f.processArea}]</span>
                      </div>
                      <div className="text-slate-700 flex-1 min-w-0 leading-snug">
                        {f.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => setNewFindingsAlert([])}
              className="text-amber-800 hover:text-amber-950 font-medium text-xs underline shrink-0 ml-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/40">
        {messages.map((msg) => {
          const isAgent = msg.role === 'agent';
          return (
            <div
              key={msg.interactionId}
              className={`flex gap-3 max-w-3xl ${isAgent ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
            >
              <div
                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
                  isAgent
                    ? 'bg-gradient-to-tr from-indigo-700 to-indigo-500 text-white shadow-xs'
                    : 'bg-slate-700 text-white'
                }`}
              >
                {isAgent ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div
                className={`p-4 rounded-2xl shadow-xs text-sm leading-relaxed ${
                  isAgent
                    ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                    : 'bg-indigo-600 text-white rounded-tr-none'
                }`}
              >
                {isAgent ? (
                  <SafeMarkdown content={msg.content} className="text-slate-800 text-sm" />
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}

                <div
                  className={`mt-2 flex items-center justify-between text-[10px] ${
                    isAgent ? 'text-slate-400' : 'text-indigo-200'
                  }`}
                >
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isAgent && msg.modelUsed && (
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono text-[9px] border border-slate-200">
                      {msg.modelUsed}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex gap-3 max-w-xl mr-auto items-center">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none text-xs text-slate-500 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              <span>Audit Agent analyzing processes and cross-referencing standards...</span>
            </div>
          </div>
        )}

        {session.status === 'completed' && session.summary && (
          <div className="mt-6 p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-slate-800">
            <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Audit Session Complete &bull; Consolidated Summary</span>
            </div>
            <div className="bg-white/70 p-4 rounded-xl border border-emerald-100">
              <SafeMarkdown content={session.summary} className="text-xs text-slate-700 leading-relaxed" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      {session.status === 'active' ? (
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex flex-col gap-1.5"
          >
            <div className="relative">
              <textarea
                ref={textareaRef}
                rows={2}
                maxLength={2000}
                placeholder="Walk through your process, describe bottlenecks, or answer the agent's question..."
                value={inputMessage}
                disabled={isSending}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="w-full px-4 py-3 pr-24 text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none disabled:bg-slate-50 disabled:text-slate-400"
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <span className="text-[10px] text-slate-400 select-none">
                  {inputMessage.length}/2000
                </span>
                <button
                  type="submit"
                  disabled={isSending || !inputMessage.trim()}
                  className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-indigo-600"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <div className="p-4 bg-slate-100 text-center text-xs text-slate-500 border-t border-slate-200">
          This audit session has been concluded and archived. You can review all findings in the "My
          Findings" panel.
        </div>
      )}

      {/* End Session Confirmation In-App Modal */}
      <Modal
        isOpen={confirmEndModal}
        onClose={() => setConfirmEndModal(false)}
        title="Conclude Audit Session?"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 text-amber-900 rounded-xl border border-amber-200 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p>
              Are you sure you want to end this session? The AI Audit Agent will synthesize your interview,
              generate your final session summary, and mark the stage as <strong>Recap</strong>.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setConfirmEndModal(false)}
              disabled={endingSession}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEndSession}
              disabled={endingSession}
              className="px-4 py-2 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {endingSession ? 'Generating Summary...' : 'Yes, Conclude Session'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
