import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuditArea } from '../types';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, stripUndefined } from '../firebase';
import {
  Upload,
  FileText,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Edit2,
  Trash2,
  Sparkles,
  BookOpen,
  CheckCheck,
  AlertCircle,
  Layers,
  FileCode,
} from 'lucide-react';
import { Modal } from './Modal';
import { DEPARTMENTS, COMPANY_WIDE_DEPARTMENT } from '../constants';

interface AdminBaselineProps {
  onError: (msg: string, retryFn?: () => void) => void;
}

export const AdminBaseline: React.FC<AdminBaselineProps> = ({ onError }) => {
  const { user, token } = useAuth();
  const [auditAreas, setAuditAreas] = useState<AuditArea[]>([]);
  const [uploadTab, setUploadTab] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractSuccess, setExtractSuccess] = useState<string | null>(null);

  // Edit Area Modal State
  const [editingArea, setEditingArea] = useState<AuditArea | null>(null);
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStandardsText, setEditStandardsText] = useState('');
  const [editKpisText, setEditKpisText] = useState('');

  // Delete Drafts Modal State (admin only)
  const [showDeleteDraftsModal, setShowDeleteDraftsModal] = useState(false);
  const [isDeletingDrafts, setIsDeletingDrafts] = useState(false);

  // Subscribe to all audit areas (Admin has read permission for all areas)
  useEffect(() => {
    if (!user) return;
    const areasRef = collection(db, 'auditAreas');
    const unsub = onSnapshot(
      areasRef,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })) as AuditArea[];
        // Sort draft first, then by date descending
        items.sort((a, b) => {
          if (a.isActive === b.isActive) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
          return a.isActive ? 1 : -1;
        });
        setAuditAreas(items);
      },
      (err) => {
        console.error('Audit areas listener error:', err);
      }
    );
    return () => unsub();
  }, [user]);

  // Extract text from PDF file
  const extractPdfText = async (file: File): Promise<string> => {
    try {
      const pdfjs = await import('pdfjs-dist');
      // Set worker source
      if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
      }
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
      }
      return fullText;
    } catch (e) {
      console.warn('PDF.js parse failed, reading as binary fallback text', e);
      return await file.text();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      onError('Upload rejected: File size exceeds maximum limit of 5 MB.');
      e.target.value = '';
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'txt', 'md'].includes(ext || '')) {
      onError('Upload rejected: Only PDF, TXT, and MD files are supported.');
      e.target.value = '';
      return;
    }

    setIsExtracting(true);
    setExtractSuccess(null);

    try {
      let textContent = '';
      if (ext === 'pdf') {
        textContent = await extractPdfText(file);
      } else {
        textContent = await file.text();
      }

      if (!textContent.trim()) {
        throw new Error('Extracted document text was empty.');
      }

      await runExtraction(file.name, textContent);
    } catch (err: any) {
      console.error('File extraction error:', err);
      onError(err?.message || 'Failed to extract document', () => {
        handleFileUpload(e);
      });
    } finally {
      setIsExtracting(false);
      e.target.value = '';
    }
  };

  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedText.trim()) return;

    if (pastedText.length > 5 * 1024 * 1024) {
      onError('Text exceeds 5 MB limit.');
      return;
    }

    setIsExtracting(true);
    setExtractSuccess(null);
    try {
      await runExtraction(docTitle.trim() || 'Infosoft Quality Documentation', pastedText.trim());
      setPastedText('');
      setDocTitle('');
    } catch (err: any) {
      console.error('Paste extraction error:', err);
      onError(err?.message || 'Failed to process pasted baseline', () => handlePasteSubmit(e));
    } finally {
      setIsExtracting(false);
    }
  };

  const runExtraction = async (sourceName: string, textContent: string) => {
    const res = await fetch('/api/baseline/extract', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: sourceName,
        sourceName,
        textContent,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Server failed to extract audit areas');
    }

    const result = await res.json();
    setExtractSuccess(
      `Successfully extracted and chunked baseline documentation into ${result.totalChunks} storage chunks. Generated ${result.extractedCount} new Draft Audit Areas using ${result.modelUsed}!`
    );
  };

  const toggleAreaStatus = async (area: AuditArea) => {
    try {
      const areaId = area.id || area.areaId;
      await updateDoc(
        doc(db, 'auditAreas', areaId),
        stripUndefined({
          isActive: !area.isActive,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (err: any) {
      console.error('Failed to toggle status:', err);
      onError(err?.message || 'Failed to update audit area status', () => toggleAreaStatus(area));
    }
  };

  const activateAllAreas = async () => {
    try {
      const inactives = auditAreas.filter((a) => !a.isActive);
      for (const area of inactives) {
        const areaId = area.id || area.areaId;
        await updateDoc(
          doc(db, 'auditAreas', areaId),
          stripUndefined({
            isActive: true,
            updatedAt: new Date().toISOString(),
          })
        );
      }
      setExtractSuccess(`Activated all ${inactives.length} draft audit areas successfully!`);
    } catch (err: any) {
      console.error('Failed to activate all areas:', err);
      onError(err?.message || 'Failed to activate all audit areas', activateAllAreas);
    }
  };

  const handleDeleteAllDrafts = async () => {
    setIsDeletingDrafts(true);
    try {
      if (token) {
        const res = await fetch('/api/baseline/drafts', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to delete drafts on server');
        }
        const data = await res.json();
        setExtractSuccess(`Deleted ${data.deletedCount ?? 0} draft audit areas successfully.`);
      } else {
        const drafts = auditAreas.filter((a) => !a.isActive);
        for (const area of drafts) {
          const areaId = area.id || area.areaId;
          await deleteDoc(doc(db, 'auditAreas', areaId));
        }
        setExtractSuccess(`Deleted ${drafts.length} draft audit areas successfully.`);
      }
      setShowDeleteDraftsModal(false);
    } catch (err: any) {
      console.error('Failed to delete all drafts:', err);
      onError(err?.message || 'Failed to delete all drafts', handleDeleteAllDrafts);
    } finally {
      setIsDeletingDrafts(false);
    }
  };

  const handleDeleteArea = async (area: AuditArea) => {
    try {
      const areaId = area.id || area.areaId;
      await deleteDoc(doc(db, 'auditAreas', areaId));
    } catch (err: any) {
      console.error('Failed to delete area:', err);
      onError(err?.message || 'Failed to delete audit area');
    }
  };

  const openEditModal = (area: AuditArea) => {
    setEditingArea(area);
    setEditName(area.name);
    setEditDept(area.department);
    setEditDesc(area.description);
    setEditStandardsText((area.standards || []).join('\n'));
    setEditKpisText((area.kpis || []).join('\n'));
  };

  const handleSaveEdit = async () => {
    if (!editingArea) return;
    try {
      const areaId = editingArea.id || editingArea.areaId;
      const standards = editStandardsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const kpis = editKpisText
        .split('\n')
        .map((k) => k.trim())
        .filter(Boolean);

      await updateDoc(
        doc(db, 'auditAreas', areaId),
        stripUndefined({
          name: editName.trim(),
          department: editDept.trim(),
          description: editDesc.trim(),
          standards,
          kpis,
          updatedAt: new Date().toISOString(),
        })
      );
      setEditingArea(null);
    } catch (err: any) {
      console.error('Failed to update area:', err);
      onError(err?.message || 'Failed to update audit area', handleSaveEdit);
    }
  };

  const activeCount = auditAreas.filter((a) => a.isActive).length;
  const draftCount = auditAreas.filter((a) => !a.isActive).length;

  return (
    <div className="space-y-6">
      {/* Upload and Extraction Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Infosoft Company Baseline & Quality Standards
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Upload company profiles, departmental SOPs, quality policies, and KPI benchmarks (PDF, TXT, MD,
            or pasted text). Text is safely chunked under 1 MiB in Firestore. Gemini extracts structured Audit
            Areas as Drafts for administrative review.
          </p>
        </div>

        {extractSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{extractSuccess}</span>
          </div>
        )}

        {/* Tab Switcher: File or Paste */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setUploadTab('file')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              uploadTab === 'file'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Upload Document (PDF, TXT, MD)
          </button>
          <button
            onClick={() => setUploadTab('paste')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              uploadTab === 'paste'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Paste Text Directly
          </button>
        </div>

        {uploadTab === 'file' ? (
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-indigo-400 transition-colors bg-slate-50/50">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-700">
              Click to select or drag and drop Infosoft quality documentation
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Supports .pdf, .txt, .md (Max file size: 5 MB)
            </p>
            <label className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors shadow-xs">
              <FileCode className="w-4 h-4" />
              <span>Choose Document</span>
              <input
                type="file"
                accept=".pdf,.txt,.md"
                disabled={isExtracting}
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <form onSubmit={handlePasteSubmit} className="space-y-3">
            <div>
              <input
                type="text"
                placeholder="Document / SOP Title (e.g. Engineering Code Quality Policy)"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <textarea
                required
                rows={5}
                placeholder="Paste company standards, process workflows, KPIs, and quality expectations..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isExtracting || !pastedText.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Extract Audit Areas with Gemini</span>
              </button>
            </div>
          </form>
        )}

        {isExtracting && (
          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 text-xs text-indigo-900 flex items-center gap-3">
            <span className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin shrink-0" />
            <div>
              <p className="font-semibold">Gemini TQM Pipeline in Progress</p>
              <p className="text-[11px] text-indigo-700">
                Chunking baseline into Firestore & synthesizing structured Audit Areas...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Audit Areas Management List */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Configured Audit Areas</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Only <strong>Active</strong> Audit Areas are used by the Audit Agent during employee interviews.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-medium border border-emerald-200">
                Active: {activeCount}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-medium border border-amber-200">
                Draft: {draftCount}
              </span>
            </div>

            {draftCount > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDeleteDraftsModal(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium rounded-lg transition-colors shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete all Drafts
                </button>
                <button
                  onClick={activateAllAreas}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors shadow-xs"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Activate All
                </button>
              </div>
            )}
          </div>
        </div>

        {auditAreas.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No Audit Areas configured yet. Upload your first company document above to automatically extract
            audit areas.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {auditAreas.map((area) => (
              <div
                key={area.id || area.areaId}
                className={`p-5 rounded-xl border transition-all space-y-3 ${
                  area.isActive
                    ? 'bg-white border-slate-200 shadow-xs'
                    : 'bg-amber-50/30 border-amber-200/80'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        area.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {area.isActive ? 'Active' : 'Draft'}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{area.name}</h4>
                    <span className="text-xs text-slate-500 font-medium px-2 py-0.5 bg-slate-100 rounded-md">
                      {area.department}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAreaStatus(area)}
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                        area.isActive
                          ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {area.isActive ? (
                        <>
                          <ToggleLeft className="w-3.5 h-3.5" /> Deactivate
                        </>
                      ) : (
                        <>
                          <ToggleRight className="w-3.5 h-3.5" /> Activate
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => openEditModal(area)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit Area"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteArea(area)}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Area"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">{area.description}</p>

                {/* Standards & KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 block mb-1">
                      Standards & SOP Rules ({area.standards?.length || 0}):
                    </span>
                    <ul className="space-y-1 text-slate-600 list-disc list-inside">
                      {(area.standards || []).map((std, i) => (
                        <li key={i} className="line-clamp-2">
                          <code className="text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded text-[11px]">
                            {std}
                          </code>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-800 block mb-1">
                      Key Performance Indicators / SLAs ({area.kpis?.length || 0}):
                    </span>
                    <ul className="space-y-1 text-slate-600 list-disc list-inside">
                      {(area.kpis || []).map((kpi, i) => (
                        <li key={i} className="line-clamp-2 text-[11px]">
                          {kpi}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {area.sourceExcerpt && (
                  <div className="text-[11px] text-slate-400 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                    Source Excerpt: "{area.sourceExcerpt}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Audit Area Modal */}
      <Modal
        isOpen={Boolean(editingArea)}
        onClose={() => setEditingArea(null)}
        title="Edit Audit Area"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Area Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Department
              </label>
              <select
                value={editDept}
                onChange={(e) => setEditDept(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value={COMPANY_WIDE_DEPARTMENT}>{COMPANY_WIDE_DEPARTMENT}</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Quality Standards (one per line, preserve codes like ENG-4.3)
            </label>
            <textarea
              rows={4}
              value={editStandardsText}
              onChange={(e) => setEditStandardsText(e.target.value)}
              className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              KPIs / SLAs (one per line)
            </label>
            <textarea
              rows={3}
              value={editKpisText}
              onChange={(e) => setEditKpisText(e.target.value)}
              className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              onClick={() => setEditingArea(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs"
            >
              Save Audit Area
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete All Drafts Confirmation Modal (Requirement 3: in-app modal, no window.confirm) */}
      <Modal
        isOpen={showDeleteDraftsModal}
        onClose={() => setShowDeleteDraftsModal(false)}
        title="Delete All Draft Audit Areas"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Confirm Draft Deletion</p>
              <p className="mt-0.5 text-rose-800">
                Are you sure you want to delete all <strong>{draftCount}</strong> draft audit areas? This action cannot be undone. Active audit areas will not be affected.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isDeletingDrafts}
              onClick={() => setShowDeleteDraftsModal(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeletingDrafts}
              onClick={handleDeleteAllDrafts}
              className="px-4 py-2 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isDeletingDrafts ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin shrink-0" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete {draftCount} Drafts</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
