'use client';

import React from 'react';
import { CheckCircle2, Ticket } from 'lucide-react';
import type { SelectionDto } from '@war-konsumsi/shared';

interface ConfirmationTicketProps {
  participantName?: string | null;
  eventName?: string | null;
  selection: SelectionDto | null;
}

export const ConfirmationTicket: React.FC<ConfirmationTicketProps> = ({
  participantName,
  eventName,
  selection,
}) => {
  if (!selection) return null;

  const formattedDate = new Date(selection.selectedAt).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="flex-1 flex flex-col justify-center py-6 px-1">
      {/* Success Badge */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 text-emerald-400">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Pilihan Konsumsi Berhasil!
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Quota berhasil dialokasikan untuk kamu.
        </p>
      </div>

      {/* Ticket Card */}
      <div
        data-testid="confirmation-ticket"
        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-lg"
      >
        {/* Top Ticket Header */}
        <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              TIKET KONSUMSI
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-medium px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
            TERVERIFIKASI
          </span>
        </div>

        {/* Ticket Details */}
        <div className="p-6 space-y-4">
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
              Menu Terpilih
            </span>
            <div
              data-testid="ticket-category-name"
              className="text-lg sm:text-xl font-black text-amber-400 tracking-tight mt-0.5"
            >
              {selection.categoryName || 'Menu Konsumsi'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div>
              <span className="text-[11px] text-slate-400 block">Nama Peserta</span>
              <span
                data-testid="ticket-participant-name"
                className="text-sm font-semibold text-white block mt-0.5 truncate"
              >
                {participantName || 'Peserta'}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block">Waktu Memilih</span>
              <span className="text-xs font-mono text-slate-300 block mt-0.5">
                {formattedDate} WIB
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <span className="text-[11px] text-slate-400 block">Event</span>
            <span className="text-xs font-medium text-slate-300 block mt-0.5">
              {eventName || 'War Konsumsi Gathering'}
            </span>
          </div>
        </div>

        {/* Ticket Barcode / ID Footer */}
        <div className="bg-slate-950/80 px-6 py-3 border-t border-dashed border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>KODE TIKET</span>
          <span data-testid="ticket-id" className="text-slate-300">
            {selection.id.slice(0, 8).toUpperCase()} - {selection.id.slice(-4).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Lock Notice */}
      <p className="text-[11px] text-slate-400 text-center mt-6 leading-relaxed">
        Pilihan kamu telah tersimpan secara permanen di database. Tunjukkan tiket ini kepada panitia saat pengambilan konsumsi di lokasi acara.
      </p>
    </div>
  );
};
