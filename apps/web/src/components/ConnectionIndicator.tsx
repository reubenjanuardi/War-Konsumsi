'use client';

import React from 'react';
import type { SocketStatus } from '../hooks/useSocket';

interface ConnectionIndicatorProps {
  status: SocketStatus;
}

export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({ status }) => {
  if (status === 'CONNECTED') {
    return (
      <div
        data-testid="connection-status"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        <span>LIVE</span>
      </div>
    );
  }

  if (status === 'RECONNECTING') {
    return (
      <div
        data-testid="connection-status"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
        <span>MENGHUBUNGKAN...</span>
      </div>
    );
  }

  return (
    <div
      data-testid="connection-status"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-wide bg-rose-500/10 text-rose-400 border border-rose-500/20"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
      <span>TERPUTUS</span>
    </div>
  );
};
