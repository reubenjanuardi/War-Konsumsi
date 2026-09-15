'use client';

import React from 'react';
import { ConnectionIndicator } from './ConnectionIndicator';
import type { SocketStatus } from '../hooks/useSocket';

interface HeaderProps {
  eventName?: string | null;
  participantName?: string | null;
  connectionStatus: SocketStatus;
  onResetSession?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  eventName,
  participantName,
  connectionStatus,
  onResetSession,
}) => {
  return (
    <header className="w-full pb-4 mb-4 border-b border-slate-800/80 flex items-center justify-between gap-2">
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
          WAR KONSUMSI
        </span>
        <h1 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
          {eventName || 'Pemilihan Konsumsi'}
        </h1>
        {participantName && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-300 truncate">
              Peserta: <strong className="text-amber-400 font-semibold">{participantName}</strong>
            </span>
            {onResetSession && (
              <button
                type="button"
                onClick={onResetSession}
                className="text-[11px] text-slate-400 hover:text-slate-300 underline underline-offset-2 touch-manipulation"
                title="Ganti akun"
              >
                Ganti
              </button>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <ConnectionIndicator status={connectionStatus} />
      </div>
    </header>
  );
};
