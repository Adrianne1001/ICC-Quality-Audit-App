import React, { useState } from 'react';
import { ShieldAlert, Copy, Check, RefreshCw } from 'lucide-react';

interface AdminSetupNoticeProps {
  uid: string;
  roleDocPath: string;
  onRefresh: () => Promise<void>;
}

export const AdminSetupNotice: React.FC<AdminSetupNoticeProps> = ({ uid, roleDocPath, onRefresh }) => {
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const copyPath = () => {
    navigator.clipboard.writeText(roleDocPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-r-xl shadow-xs mb-6">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-base font-semibold text-amber-900">
            Super Administrator Setup Required
          </h4>
          <p className="text-sm text-amber-800 mt-1 leading-relaxed">
            Your authenticated Google email matches the designated super administrator email. To finalize
            your administrative permissions per security directives, please create your role document in the
            Firebase Console.
          </p>

          <div className="mt-3 bg-white border border-amber-200 rounded-lg p-3 font-mono text-xs text-slate-800 flex items-center justify-between">
            <div className="truncate mr-2">
              <span className="text-slate-500 select-none">Target Document Path: </span>
              <strong className="text-amber-900">{roleDocPath}</strong>
            </div>
            <button
              onClick={copyPath}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-sans text-xs rounded transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Path'}
            </button>
          </div>

          <div className="mt-2 text-xs text-amber-800">
            <strong>Firebase Console Instructions:</strong> Go to Firestore Database &rarr; Start Collection{' '}
            <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900">admins</code> &rarr; Document ID:{' '}
            <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900">{uid}</code> &rarr; Add field{' '}
            <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900">role: "superadmin"</code>.
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Re-verify Admin Status
            </button>
            <span className="text-xs text-amber-700">
              You can also use the normal employee flow below for testing!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
