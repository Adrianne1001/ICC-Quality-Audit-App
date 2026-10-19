import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuditFinding, FindingStatus, IshikawaCategory, SeverityLevel } from '../types';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, stripUndefined } from '../firebase';
import {
  CheckCircle,
  Edit3,
  XCircle,
  Clock,
  Filter,
  AlertCircle,
  Tag,
  Quote,
  Lightbulb,
  BookOpen,
} from 'lucide-react';
import { Modal } from './Modal';

interface MyFindingsPanelProps {
  onError: (msg: string, retryFn?: () => void) => void;
}

const CATEGORY_COLORS: Record<IshikawaCategory, string> = {
  Man: 'bg-purple-100 text-purple-800 border-purple-200',
  Machine: 'bg-blue-100 text-blue-800 border-blue-200',
  Method: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Material: 'bg-amber-100 text-amber-800 border-amber-200',
  Measurement: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  Environment: 'bg-rose-100 text-rose-800 border-rose-200',
};

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  Low: 'bg-slate-100 text-slate-700 border-slate-200',
  Medium: 'bg-blue-100 text-blue-800 border-blue-200',
  High: 'bg-orange-100 text-orange-800 border-orange-200',
  Critical: 'bg-red-100 text-red-800 border-red-200 font-bold',
};

const STATUS_BADGES: Record<FindingStatus, { color: string; label: string }> = {
  Pending: { color: 'bg-amber-50 text-amber-800 border-amber-300', label: 'Pending Review' },
  Confirmed: { color: 'bg-emerald-50 text-emerald-800 border-emerald-300', label: 'Confirmed' },
  Edited: { color: 'bg-blue-50 text-blue-800 border-blue-300', label: 'Edited by Employee' },
  Disputed: { color: 'bg-red-50 text-red-800 border-red-300', label: 'Disputed' },
};

export const MyFindingsPanel: React.FC<MyFindingsPanelProps> = ({ onError }) => {
  const { user } = useAuth();
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Edit Modal State
  const [editingFinding, setEditingFinding] = useState<AuditFinding | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editRemedy, setEditRemedy] = useState('');
  const [editNote, setEditNote] = useState('');

  // Dispute Modal State
  const [disputingFinding, setDisputingFinding] = useState<AuditFinding | null>(null);
  const [disputeReason, setDisputeReason] = useState('');

  useEffect(() => {
    if (!user) return;
    const colRef = collection(db, 'users', user.uid, 'findings');
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        const items = snapshot.docs
          .map((d) => d.data() as AuditFinding)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setFindings(items);
      },
      (err) => {
        console.error('Findings listener error:', err);
      }
    );
    return () => unsub();
  }, [user]);

  const handleConfirm = async (finding: AuditFinding) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'findings', finding.findingId);
      await updateDoc(
        docRef,
        stripUndefined({
          status: 'Confirmed' as FindingStatus,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (err: any) {
      console.error('Failed to confirm finding:', err);
      onError(err?.message || 'Failed to confirm finding', () => handleConfirm(finding));
    }
  };

  const openEditModal = (finding: AuditFinding) => {
    setEditingFinding(finding);
    setEditDesc(finding.description);
    setEditRemedy(finding.suggestedImprovement);
    setEditNote(finding.userEditNote || '');
  };

  const handleSaveEdit = async () => {
    if (!user || !editingFinding) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'findings', editingFinding.findingId);
      await updateDoc(
        docRef,
        stripUndefined({
          description: editDesc.trim(),
          suggestedImprovement: editRemedy.trim(),
          userEditNote: editNote.trim(),
          status: 'Edited' as FindingStatus,
          updatedAt: new Date().toISOString(),
        })
      );
      setEditingFinding(null);
    } catch (err: any) {
      console.error('Failed to save edited finding:', err);
      onError(err?.message || 'Failed to update finding', handleSaveEdit);
    }
  };

  const openDisputeModal = (finding: AuditFinding) => {
    setDisputingFinding(finding);
    setDisputeReason(finding.userDisputeReason || '');
  };

  const handleSaveDispute = async () => {
    if (!user || !disputingFinding) return;
    if (!disputeReason.trim()) {
      onError('Please provide a reason for disputing this finding.');
      return;
    }
    try {
      const docRef = doc(db, 'users', user.uid, 'findings', disputingFinding.findingId);
      await updateDoc(
        docRef,
        stripUndefined({
          userDisputeReason: disputeReason.trim(),
          status: 'Disputed' as FindingStatus,
          updatedAt: new Date().toISOString(),
        })
      );
      setDisputingFinding(null);
    } catch (err: any) {
      console.error('Failed to dispute finding:', err);
      onError(err?.message || 'Failed to dispute finding', handleSaveDispute);
    }
  };

  // Filter findings
  const filtered = findings.filter((f) => {
    const matchStatus = statusFilter === 'All' || f.status === statusFilter;
    const matchCat = categoryFilter === 'All' || f.ishikawaCategory === categoryFilter;
    return matchStatus && matchCat;
  });

  return (
    <div className="space-y-6">
      {/* Header and Filter Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">My Audit Findings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Process gaps, bottlenecks, and observations recorded by the AI Audit Agent during your
            interviews.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
            >
              <option value="All">All ({findings.length})</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Edited">Edited</option>
              <option value="Disputed">Disputed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
            >
              <option value="All">All Categories</option>
              <option value="Man">Man</option>
              <option value="Machine">Machine</option>
              <option value="Method">Method</option>
              <option value="Material">Material</option>
              <option value="Measurement">Measurement</option>
              <option value="Environment">Environment</option>
            </select>
          </div>
        </div>
      </div>

      {/* Findings List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-700">No Findings Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {findings.length === 0
              ? 'No findings have been recorded yet. Start a new audit interview session to walkthrough your workflows!'
              : 'No findings match the current filter selection.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((f) => {
            const statusConfig = STATUS_BADGES[f.status] || STATUS_BADGES.Pending;

            return (
              <div
                key={f.findingId}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
              >
                {/* Badges Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        CATEGORY_COLORS[f.ishikawaCategory] || 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {f.ishikawaCategory} (6M)
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                        SEVERITY_COLORS[f.severity] || 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      Severity: {f.severity}
                    </span>

                    <span className="text-xs text-slate-600 font-semibold px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-md">
                      Area: {f.processArea}
                    </span>

                    {f.relatedStandard && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md">
                        <BookOpen className="w-3 h-3" />
                        {f.relatedStandard}
                      </span>
                    )}
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig.color}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>

                {/* Description & Quotes */}
                <div className="space-y-2 text-sm text-slate-800 leading-relaxed">
                  <div>
                    <h4 className="font-semibold text-slate-900">{f.description}</h4>
                  </div>

                  {f.userQuote && (
                    <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-700 italic">
                      <Quote className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>"{f.userQuote}"</span>
                    </div>
                  )}

                  {f.suggestedImprovement && (
                    <div className="flex items-start gap-2 bg-emerald-50/60 p-3 rounded-xl border border-emerald-100 text-xs text-emerald-950">
                      <Lightbulb className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-emerald-900 font-semibold">
                          Suggested Remediation / Action:{' '}
                        </strong>
                        <span>{f.suggestedImprovement}</span>
                      </div>
                    </div>
                  )}

                  {f.userEditNote && (
                    <div className="text-xs text-blue-800 bg-blue-50 p-2.5 rounded-lg border border-blue-200">
                      <strong>Your Edit Note:</strong> {f.userEditNote}
                    </div>
                  )}

                  {f.userDisputeReason && (
                    <div className="text-xs text-red-800 bg-red-50 p-2.5 rounded-lg border border-red-200">
                      <strong>Dispute Rationale:</strong> {f.userDisputeReason}
                    </div>
                  )}
                </div>

                {/* Actions & Timestamp Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <Clock className="w-3.5 h-3.5" />
                    Recorded on {new Date(f.createdAt).toLocaleString()}
                  </span>

                  <div className="flex items-center gap-2">
                    {f.status !== 'Confirmed' && (
                      <button
                        onClick={() => handleConfirm(f)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium rounded-lg border border-emerald-200 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Confirm
                      </button>
                    )}

                    <button
                      onClick={() => openEditModal(f)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg border border-blue-200 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>

                    {f.status !== 'Disputed' && (
                      <button
                        onClick={() => openDisputeModal(f)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg border border-red-200 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Dispute
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Finding Modal */}
      <Modal
        isOpen={Boolean(editingFinding)}
        onClose={() => setEditingFinding(null)}
        title="Edit Audit Finding"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Finding Description
            </label>
            <textarea
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Suggested Improvement / Preventative Remedy
            </label>
            <textarea
              rows={3}
              value={editRemedy}
              onChange={(e) => setEditRemedy(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Note on your modification
            </label>
            <input
              type="text"
              placeholder="e.g. Clarified the exact step in deployment where delay occurs"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              onClick={() => setEditingFinding(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs"
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>

      {/* Dispute Finding Modal */}
      <Modal
        isOpen={Boolean(disputingFinding)}
        onClose={() => setDisputingFinding(null)}
        title="Dispute Audit Finding"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Please explain why this finding does not accurately reflect your process, is not a quality
            concern, or represents an isolated one-off anomaly.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Dispute Rationale
            </label>
            <textarea
              required
              rows={4}
              placeholder="State your reasons and relevant context..."
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              onClick={() => setDisputingFinding(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDispute}
              className="px-4 py-2 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs"
            >
              Confirm Dispute
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
