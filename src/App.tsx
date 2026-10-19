import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ProfileSetupModal } from './components/ProfileSetupModal';
import { AdminSetupNotice } from './components/AdminSetupNotice';
import { AuditChat } from './components/AuditChat';
import { MyFindingsPanel } from './components/MyFindingsPanel';
import { SessionHistory } from './components/SessionHistory';
import { AdminBaseline } from './components/AdminBaseline';
import { AdminConsolidatedView } from './components/AdminConsolidatedView';
import { ErrorToast } from './components/ErrorToast';
import { AuditSession } from './types';
import { DEPARTMENTS } from './constants';
import {
  Bot,
  PlusCircle,
  FileCheck2,
  Clock,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Sliders,
  CheckCircle,
} from 'lucide-react';

function MainApp() {
  const {
    user,
    profile,
    isAdmin,
    adminSetupNeeded,
    roleDocPath,
    loading,
    token,
    signInWithGoogle,
    refreshAdminStatus,
  } = useAuth();

  // Navigation State
  const [currentTab, setCurrentTab] = useState<'hub' | 'admin'>('hub');
  const [hubSubTab, setHubSubTab] = useState<'chat' | 'findings' | 'history'>('chat');
  const [adminSubTab, setAdminSubTab] = useState<'consolidated' | 'baseline'>('consolidated');

  // Active Session State
  const [activeSession, setActiveSession] = useState<AuditSession | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);

  // Profile Modal State
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Global Error Toast State (Directive 6: Never fail silently, provide Retry Save)
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCallback, setRetryCallback] = useState<(() => void) | undefined>(undefined);

  const showError = (msg: string, retryFn?: () => void) => {
    setErrorMessage(msg);
    setRetryCallback(() => retryFn);
  };

  // Profile completeness check (must have valid Infosoft department)
  const isDeptValid = Boolean(
    profile?.department && (DEPARTMENTS as readonly string[]).includes(profile.department)
  );
  const profileIncomplete = !profile || !isDeptValid;

  // Start a new audit session
  const handleStartSession = async () => {
    if (profileIncomplete) {
      setProfileModalOpen(true);
      return;
    }
    setIsStartingSession(true);
    try {
      const res = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to start new audit session');
      }

      const sessionData: AuditSession = await res.json();
      setActiveSession(sessionData);
      setHubSubTab('chat');
    } catch (err: any) {
      console.error('Start session error:', err);
      showError(err?.message || 'Failed to start session', handleStartSession);
    } finally {
      setIsStartingSession(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg animate-pulse mb-4">
          <Bot className="w-7 h-7" />
        </div>
        <p className="text-sm font-semibold text-slate-800">Initializing Infosoft Quality Audit...</p>
        <p className="text-xs text-slate-500 mt-1">Connecting to Firestore & Auth services</p>
      </div>
    );
  }

  // Unauthenticated Landing Page
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 flex flex-col justify-between">
        {/* Header */}
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 tracking-tight text-base">Infosoft</span>
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Quality Audit Agent
                </span>
              </div>
            </div>

            <button
              onClick={signInWithGoogle}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
            >
              Sign In with Google
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <main className="max-w-5xl mx-auto px-6 py-12 sm:py-20 text-center space-y-8 flex-1 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mx-auto">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Driven Total Quality Management (TQM)</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Elevating Infosoft Process Quality Through Continuous AI Audits
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            The Audit Agent interviews team members across departments one question at a time, evaluates
            workflows against company quality SOPs, identifies Ishikawa (6M) root causes, and delivers
            executive intelligence to the super administrator.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={signInWithGoogle}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-200 transition-all cursor-pointer"
            >
              <span>Sign In with Google to Begin</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 text-left">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">6-Stage TQM Interview</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Walkthrough daily processes, surface friction, examine customer complaints, probe Ishikawa 6M
                root causes, and brainstorm remedies.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">My Findings Portal</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Employees inspect findings logged by the agent with full autonomy to Confirm, Edit, or Dispute
                each quality gap.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Executive Pareto Intelligence</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Super administrator Pareto analytics (80/20 cutoff), departmental severity heatmaps, and
                Gemini consolidated audit reports.
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
          Infosoft Quality Audit Agent &bull; Powered by Google Cloud Run, Cloud Firestore & Gemini API
        </footer>
      </div>
    );
  }

  // Authenticated View
  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col">
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
        }}
        onOpenProfile={() => setProfileModalOpen(true)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {/* Directive 8: Admin Setup Notice banner if role document missing */}
        {adminSetupNeeded && (
          <AdminSetupNotice
            uid={user.uid}
            roleDocPath={roleDocPath}
            onRefresh={refreshAdminStatus}
          />
        )}

        {/* Tab 1: Employee Audit Hub */}
        {currentTab === 'hub' && (
          <div className="space-y-6">
            {/* Sub-tab navigation */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => setHubSubTab('chat')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    hubSubTab === 'chat'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Audit Interview</span>
                </button>

                <button
                  onClick={() => setHubSubTab('findings')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    hubSubTab === 'findings'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>My Findings</span>
                </button>

                <button
                  onClick={() => setHubSubTab('history')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    hubSubTab === 'history'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>History</span>
                </button>
              </div>

              <button
                onClick={handleStartSession}
                disabled={isStartingSession}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{isStartingSession ? 'Preparing Audit Agent...' : 'New Audit Session'}</span>
              </button>
            </div>

            {/* SubTab Views */}
            {hubSubTab === 'chat' && (
              <div>
                {activeSession ? (
                  <AuditChat
                    session={activeSession}
                    onSessionUpdated={(s) => setActiveSession(s)}
                    onError={showError}
                  />
                ) : (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center max-w-2xl mx-auto space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                      <Bot className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800">
                        Ready for your TQM Process Audit?
                      </h3>
                      <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                        Start a new interview session to have the AI Audit Agent assess your daily workflows,
                        compare them with Infosoft quality standards, and record continuous improvement
                        findings.
                      </p>
                    </div>
                    <button
                      onClick={handleStartSession}
                      disabled={isStartingSession}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>{isStartingSession ? 'Matching Standards...' : 'Start New Audit Session'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {hubSubTab === 'findings' && <MyFindingsPanel onError={showError} />}

            {hubSubTab === 'history' && (
              <SessionHistory
                onSelectSession={(s) => {
                  setActiveSession(s);
                  setHubSubTab('chat');
                }}
              />
            )}
          </div>
        )}

        {/* Tab 2: Super Admin Portal */}
        {currentTab === 'admin' && isAdmin && (
          <div className="space-y-6">
            {/* Admin SubTab Bar */}
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
              <button
                onClick={() => setAdminSubTab('consolidated')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  adminSubTab === 'consolidated'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Consolidated Audit View</span>
              </button>

              <button
                onClick={() => setAdminSubTab('baseline')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  adminSubTab === 'baseline'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Company Baseline & Standards</span>
              </button>
            </div>

            {adminSubTab === 'consolidated' && <AdminConsolidatedView onError={showError} />}

            {adminSubTab === 'baseline' && <AdminBaseline onError={showError} />}
          </div>
        )}
      </main>

      {/* Profile Setup Modal */}
      <ProfileSetupModal
        isOpen={profileModalOpen || profileIncomplete}
        onClose={() => setProfileModalOpen(false)}
        isFirstTime={profileIncomplete}
      />

      {/* Global Error Banner / Toast (Directive 6: Never fail silently, provide Retry Save) */}
      <ErrorToast
        message={errorMessage}
        onRetry={retryCallback}
        onDismiss={() => {
          setErrorMessage(null);
          setRetryCallback(undefined);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
