import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

interface ErrorToastProps {
  message: string | null;
  onRetry?: () => void;
  onDismiss: () => void;
  inputIntact?: boolean;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({ message, onRetry, onDismiss, inputIntact }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-red-900/95 text-white p-4 rounded-xl shadow-2xl border border-red-700 backdrop-blur-sm animate-in slide-in-from-bottom-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
        <div className="flex-1 text-sm leading-relaxed">
          <p className="font-semibold text-red-100">Operation / Save Failed</p>
          <p className="text-red-200 mt-1">{message}</p>
          {inputIntact && (
            <p className="text-xs text-red-300 mt-1">Your unsaved input remains intact.</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-red-300 hover:text-white p-1 rounded transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {onRetry && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-900 font-medium text-xs rounded-lg shadow-xs hover:bg-red-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Save
          </button>
        </div>
      )}
    </div>
  );
};
