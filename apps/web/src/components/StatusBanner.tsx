'use client';

import React from 'react';
import { AlertCircle, WifiOff, X } from 'lucide-react';
import type { SocketStatus } from '../hooks/useSocket';

interface StatusBannerProps {
  connectionStatus: SocketStatus;
  errorMessage: string | null;
  onDismissError?: () => void;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({
  connectionStatus,
  errorMessage,
  onDismissError,
}) => {
  return (
    <div className="w-full space-y-2 mb-4">
      {/* Connection Lost / Reconnecting Banner */}
      {connectionStatus !== 'CONNECTED' && (
        <div
          data-testid="reconnecting-banner"
          className="w-full px-3.5 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300"
        >
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span>Koneksi terputus. Mencoba menghubungkan kembali...</span>
          </div>
        </div>
      )}

      {/* Error Message Toast / Banner */}
      {errorMessage && (
        <div
          data-testid="error-banner"
          role="alert"
          className="w-full px-3.5 py-2.5 rounded-md bg-rose-500/10 border border-rose-500/30 flex items-start justify-between text-xs text-rose-200"
        >
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed break-words">{errorMessage}</span>
          </div>
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              className="p-1 -mr-1 text-rose-300 hover:text-white rounded touch-manipulation"
              aria-label="Tutup pesan"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
