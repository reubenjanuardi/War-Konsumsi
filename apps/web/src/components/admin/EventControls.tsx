'use client';

import React, { useState } from 'react';
import { EventStatus, type EventDetailDto } from '@war-konsumsi/shared';

interface EventControlsProps {
  event: EventDetailDto;
  onOpenEvent: () => Promise<void>;
  onCloseEvent: () => Promise<void>;
  onForceCloseEvent: () => Promise<void>;
  onUpdateEvent: (data: {
    name?: string;
    selectionStartsAt?: string;
    selectionEndsAt?: string | null;
  }) => Promise<void>;
}

export const EventControls: React.FC<EventControlsProps> = ({
  event,
  onOpenEvent,
  onCloseEvent,
  onForceCloseEvent,
  onUpdateEvent,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showForceCloseModal, setShowForceCloseModal] = useState(false);

  // Form states for timing edit
  const [name, setName] = useState(event.name);
  const [startsAt, setStartsAt] = useState(() => {
    try {
      const d = new Date(event.selectionStartsAt);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  });
  const [endsAt, setEndsAt] = useState(() => {
    if (!event.selectionEndsAt) return '';
    try {
      const d = new Date(event.selectionEndsAt);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleAction = async (actionName: string, fn: () => Promise<void>) => {
    setLoadingAction(actionName);
    try {
      await fn();
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction('save');
    setSaveSuccess(false);

    try {
      await onUpdateEvent({
        name,
        selectionStartsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        selectionEndsAt: endsAt ? new Date(endsAt).toISOString() : null,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setLoadingAction(null);
    }
  };

  const isOpen = event.status === EventStatus.OPEN;
  const isClosed = event.status === EventStatus.CLOSED;

  return (
    <div className="space-y-6">
      {/* Quick Action Buttons Card */}
      <div className="bg-slate-900 border border-slate-800 rounded p-5">
        <h2 className="text-sm font-bold text-white tracking-wide uppercase font-mono mb-1">
          Kontrol Status Event
        </h2>
        <p className="text-xs text-slate-400 mb-4 font-sans">
          Mengubah status event akan langsung dipropagasikan ke seluruh peserta yang sedang membuka web.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Buka Pemilihan */}
          <button
            onClick={() => handleAction('open', onOpenEvent)}
            disabled={isOpen || !!loadingAction}
            className="flex flex-col items-center justify-center p-4 rounded border border-emerald-800/80 bg-emerald-950/40 hover:bg-emerald-900/50 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 font-mono transition-colors cursor-pointer"
          >
            <span className="text-sm font-bold tracking-wider">BUKA PEMILIHAN</span>
            <span className="text-[11px] text-emerald-400/70 mt-1">Status: OPEN (War Aktif)</span>
          </button>

          {/* Tutup Pemilihan */}
          <button
            onClick={() => handleAction('close', onCloseEvent)}
            disabled={isClosed || !!loadingAction}
            className="flex flex-col items-center justify-center p-4 rounded border border-amber-800/80 bg-amber-950/40 hover:bg-amber-900/50 disabled:opacity-40 disabled:cursor-not-allowed text-amber-300 font-mono transition-colors cursor-pointer"
          >
            <span className="text-sm font-bold tracking-wider">TUTUP PEMILIHAN</span>
            <span className="text-[11px] text-amber-400/70 mt-1">Status: CLOSED (Normal)</span>
          </button>

          {/* Force Close */}
          <button
            onClick={() => setShowForceCloseModal(true)}
            disabled={isClosed || !!loadingAction}
            className="flex flex-col items-center justify-center p-4 rounded border border-rose-800/80 bg-rose-950/40 hover:bg-rose-900/50 disabled:opacity-40 disabled:cursor-not-allowed text-rose-300 font-mono transition-colors cursor-pointer"
          >
            <span className="text-sm font-bold tracking-wider">PAKSA TUTUP (EMERGENCY)</span>
            <span className="text-[11px] text-rose-400/70 mt-1">Hentikan seketika</span>
          </button>
        </div>
      </div>

      {/* Event Configuration Form */}
      <div className="bg-slate-900 border border-slate-800 rounded p-5">
        <h2 className="text-sm font-bold text-white tracking-wide uppercase font-mono mb-1">
          Konfigurasi & Jadwal Waktu
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Waktu mulai dan selesai diatur berdasarkan waktu server. Peserta sinkron dengan server.
        </p>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 uppercase mb-1">
              Nama Event
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-slate-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 uppercase mb-1">
                Waktu Mulai Pemilihan (Starts At)
              </label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 uppercase mb-1">
                Waktu Selesai Pemilihan (Ends At - Opsional)
              </label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-slate-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loadingAction === 'save'}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono font-bold rounded uppercase tracking-wider transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {loadingAction === 'save' ? 'Menyimpan...' : 'Simpan Perubahan Jadwal'}
            </button>
            {saveSuccess && (
              <span className="text-xs font-mono text-emerald-400">
                Pengaturan event berhasil diperbarui.
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Confirmation Modal for Force Close */}
      {showForceCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 border border-rose-800 rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-500 font-mono text-sm font-bold uppercase">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Konfirmasi Tindakan Darurat
            </div>
            <p className="text-sm text-slate-300">
              Apakah Anda yakin ingin melakukan <strong>FORCE CLOSE</strong> pada event ini?
              Seluruh peserta yang sedang memilih akan langsung dihentikan dan pemilihan ditutup seketika.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowForceCloseModal(false)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  setShowForceCloseModal(false);
                  await handleAction('force-close', onForceCloseEvent);
                }}
                className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold cursor-pointer uppercase"
              >
                Ya, Paksa Tutup Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
