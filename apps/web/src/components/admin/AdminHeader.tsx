'use client';

import React from 'react';
import { EventStatus, type EventDetailDto } from '@war-konsumsi/shared';

interface AdminHeaderProps {
  event: EventDetailDto | null;
  eventsList: EventDetailDto[];
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
  socketConnected: boolean;
  onLogout: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  event,
  eventsList,
  selectedEventId,
  onSelectEvent,
  socketConnected,
  onLogout,
}) => {
  const getStatusBadge = (status?: EventStatus) => {
    switch (status) {
      case EventStatus.OPEN:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
            OPEN // SELEKSI BUKA
          </span>
        );
      case EventStatus.CLOSED:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-rose-950/80 text-rose-400 border border-rose-800">
            CLOSED // DITUTUP
          </span>
        );
      case EventStatus.WAITING:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-950/80 text-amber-400 border border-amber-800">
            WAITING // HITUNG MUNDUR
          </span>
        );
      case EventStatus.DRAFT:
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
            DRAFT
          </span>
        );
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 sticky top-0 z-30 px-4 py-3 backdrop-blur">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand & Current Event */}
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono tracking-widest text-rose-500 font-bold uppercase">
                WAR KONSUMSI
              </span>
              <span className="text-slate-600 font-mono text-xs">/</span>
              <span className="text-xs font-mono tracking-wider text-slate-400 uppercase">
                PANITIA CONTROL
              </span>
            </div>
            <div className="flex items-center gap-2.5 mt-0.5">
              <h1 className="text-base font-bold text-white tracking-tight">
                {event?.name || 'Memuat Event...'}
              </h1>
              {event && getStatusBadge(event.status)}
            </div>
          </div>
        </div>

        {/* Operational Controls & Status */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs font-mono">
          {/* Event Selector dropdown */}
          {eventsList.length > 1 && (
            <div className="flex items-center gap-1.5">
              <label htmlFor="event-select" className="text-slate-500">
                EVENT:
              </label>
              <select
                id="event-select"
                value={selectedEventId}
                onChange={(e) => onSelectEvent(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-slate-700"
              >
                {eventsList.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Realtime connection indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
            <span
              className={`w-2 h-2 rounded-full ${
                socketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className={socketConnected ? 'text-emerald-400' : 'text-rose-400'}>
              {socketConnected ? 'REALTIME LIVE' : 'SOCKET TERPUTUS'}
            </span>
          </div>

          {/* Logout button */}
          <button
            onClick={onLogout}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
          >
            KELUAR
          </button>
        </div>
      </div>
    </header>
  );
};
