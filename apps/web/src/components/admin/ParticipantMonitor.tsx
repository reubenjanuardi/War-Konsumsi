'use client';

import React, { useState } from 'react';
import type { AdminParticipantItemDto } from '@war-konsumsi/shared';

interface ParticipantMonitorProps {
  participants: AdminParticipantItemDto[];
  onCancelSelection: (selectionId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export const ParticipantMonitor: React.FC<ParticipantMonitorProps> = ({
  participants,
  onCancelSelection,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'SELECTED' | 'UNSELECTED'>('ALL');
  const [cancelModalItem, setCancelModalItem] = useState<AdminParticipantItemDto | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const filtered = participants.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterType === 'SELECTED') return !!p.selection;
    if (filterType === 'UNSELECTED') return !p.selection;
    return true;
  });

  const handleCancelConfirm = async () => {
    if (!cancelModalItem || !cancelModalItem.selection) return;
    setLoadingAction(cancelModalItem.id);
    try {
      await onCancelSelection(cancelModalItem.selection.id);
      setCancelModalItem(null);
    } finally {
      setLoadingAction(null);
    }
  };

  const formatTimestamp = (isoString?: string | null) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Controls: Search & Filter Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Cari nama peserta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-slate-600 w-full sm:w-64"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-slate-500 hover:text-slate-300 font-mono"
            >
              Reset
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="flex border border-slate-800 rounded overflow-hidden">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1 transition-colors cursor-pointer ${
                filterType === 'ALL'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              Semua ({participants.length})
            </button>
            <button
              onClick={() => setFilterType('SELECTED')}
              className={`px-3 py-1 transition-colors cursor-pointer ${
                filterType === 'SELECTED'
                  ? 'bg-emerald-950 text-emerald-300 font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              Sudah Memilih ({participants.filter((p) => !!p.selection).length})
            </button>
            <button
              onClick={() => setFilterType('UNSELECTED')}
              className={`px-3 py-1 transition-colors cursor-pointer ${
                filterType === 'UNSELECTED'
                  ? 'bg-amber-950 text-amber-300 font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              Belum Memilih ({participants.filter((p) => !p.selection).length})
            </button>
          </div>

          <button
            onClick={onRefresh}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono cursor-pointer"
            title="Muat Ulang Data"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-4 py-3 w-12">No</th>
                <th className="px-4 py-3">Nama Peserta</th>
                <th className="px-4 py-3">Menu Terpilih</th>
                <th className="px-4 py-3 text-center">Waktu Memilih</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada data peserta yang cocok.
                  </td>
                </tr>
              ) : (
                filtered.map((p, idx) => {
                  const hasSelected = !!p.selection;
                  const isLoading = loadingAction === p.id;

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-bold text-slate-200">{p.name}</td>
                      <td className="px-4 py-3 font-medium">
                        {hasSelected ? (
                          <span className="text-emerald-400">{p.selection!.categoryName}</span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-400">
                        {hasSelected ? formatTimestamp(p.selection!.selectedAt) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hasSelected ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                            SUDAH
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            BELUM
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasSelected ? (
                          <button
                            onClick={() => setCancelModalItem(p)}
                            disabled={isLoading}
                            className="px-2.5 py-1 rounded bg-rose-950/50 hover:bg-rose-900/60 border border-rose-900/80 text-rose-300 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Batalkan
                          </button>
                        ) : (
                          <span className="text-slate-600 text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Cancel Selection */}
      {cancelModalItem && cancelModalItem.selection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 border border-rose-800 rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-mono font-bold text-rose-400 uppercase tracking-wider">
              Konfirmasi Pembatalan Pilihan
            </h3>

            <p className="text-xs text-slate-300">
              Apakah Anda yakin ingin membatalkan pilihan konsumsi milik{' '}
              <strong className="text-white">{cancelModalItem.name}</strong> untuk menu{' '}
              <strong className="text-emerald-400">{cancelModalItem.selection.categoryName}</strong>?
            </p>

            <div className="border border-rose-950 bg-rose-950/30 p-2.5 rounded text-[11px] text-rose-300 font-mono">
              Perhatian: Sisa kuota menu akan otomatis bertambah +1 di database secara atomik dan peserta dapat memilih kembali.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalItem(null)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={!!loadingAction}
                className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold cursor-pointer uppercase"
              >
                {loadingAction ? 'Membatalkan...' : 'Ya, Batalkan Pilihan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
