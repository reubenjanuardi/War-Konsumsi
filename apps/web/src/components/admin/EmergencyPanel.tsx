'use client';

import React, { useState } from 'react';
import type { CategoryDto } from '@war-konsumsi/shared';

interface EmergencyPanelProps {
  categories: CategoryDto[];
  onForceCloseEvent: () => Promise<void>;
  onResetQuota: (categoryId: string, remainingQuota?: number) => Promise<void>;
  onCheckConsistency?: () => Promise<any>;
}

export const EmergencyPanel: React.FC<EmergencyPanelProps> = ({
  categories,
  onForceCloseEvent,
  onResetQuota,
  onCheckConsistency,
}) => {
  const [showForceCloseModal, setShowForceCloseModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consistencyResult, setConsistencyResult] = useState<{
    isConsistent: boolean;
    issues?: string[];
  } | null>(null);

  return (
    <div className="space-y-6">
      <div className="border border-rose-900/60 bg-rose-950/20 rounded p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
          <h2 className="text-sm font-bold text-rose-400 font-mono tracking-wide uppercase">
            Panel Kontrol Darurat (Emergency Operations)
          </h2>
        </div>
        <p className="text-xs text-slate-300">
          Operasi di bawah ini dirancang untuk situasi kritis selama event berjalan (misalnya insiden katering atau pembatalan acara). Seluruh tindakan dieksekusi secara aman di PostgreSQL dan mematuhi aturan integritas data.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Force Close */}
          <div className="border border-rose-900/40 bg-slate-900/80 rounded p-4 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono font-bold text-white uppercase">
                1. Force Close Event
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Menghentikan pemilihan seketika bagi seluruh peserta. Peserta yang sedang membuka aplikasi tidak akan bisa mengirim permintaan pemilihan lagi.
              </p>
            </div>
            <button
              onClick={() => setShowForceCloseModal(true)}
              className="mt-4 w-full py-2 px-3 bg-rose-900/40 hover:bg-rose-900/70 border border-rose-800 text-rose-200 text-xs font-mono font-bold rounded uppercase cursor-pointer"
            >
              Hentikan Event Sekarang (Force Close)
            </button>
          </div>

          {/* Sold Out Category Emergency Top-up */}
          <div className="border border-slate-800 bg-slate-900/80 rounded p-4 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono font-bold text-white uppercase">
                2. Pemulihan Kuota Cepat (Quick Reset)
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Kembalikan sisa kuota kategori yang habis kembali penuh ke kapasitas awal dalam satu klik.
              </p>
            </div>
            <div className="mt-4 space-y-2">
              {categories
                .filter((c) => c.remainingQuota <= 0)
                .map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between text-xs font-mono bg-slate-950 p-2 rounded border border-slate-800"
                  >
                    <span className="text-slate-300 truncate max-w-[150px]">{cat.name}</span>
                    <button
                      onClick={async () => {
                        setLoading(true);
                        try {
                          await onResetQuota(cat.id, cat.quota);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      className="px-2 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded text-[11px] cursor-pointer"
                    >
                      Reset ({cat.quota})
                    </button>
                  </div>
                ))}
              {categories.filter((c) => c.remainingQuota <= 0).length === 0 && (
                <div className="text-[11px] text-slate-500 font-mono py-2 text-center">
                  Tidak ada kategori yang berstatus habis saat ini.
                </div>
              )}
            </div>
          </div>

          {/* Database Consistency Audit */}
          <div className="border border-cyan-900/40 bg-slate-900/80 rounded p-4 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono font-bold text-cyan-400 uppercase">
                3. Audit Diagnostik Konsistensi
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Audit matematis live di PostgreSQL: memverifikasi bahwa initial_quota - selection_count = remaining_quota dan 0 duplikat.
              </p>
            </div>
            <div className="mt-4">
              {consistencyResult && (
                <div className={`p-2 rounded text-[11px] font-mono mb-2 border ${consistencyResult.isConsistent ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' : 'bg-rose-950/60 border-rose-800 text-rose-300'}`}>
                  {consistencyResult.isConsistent ? '✔ STATUS: 100% KONSISTEN' : `✘ DITEMUKAN ${consistencyResult.issues?.length} MASALAH`}
                </div>
              )}
              <button
                onClick={async () => {
                  if (!onCheckConsistency) return;
                  setLoading(true);
                  try {
                    const res = await onCheckConsistency();
                    setConsistencyResult(res);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || !onCheckConsistency}
                className="w-full py-2 px-3 bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-800 text-cyan-300 text-xs font-mono font-bold rounded uppercase cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Mengaudit PostgreSQL...' : 'Jalankan Audit Konsistensi'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showForceCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 border border-rose-800 rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-mono font-bold text-rose-400 uppercase tracking-wider">
              Konfirmasi Tindakan Darurat
            </h3>
            <p className="text-xs text-slate-300">
              Yakin ingin menutup pemilihan seketika? Tindakan ini akan mengubah status event menjadi CLOSED dan menyiarkannya ke seluruh browser peserta.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowForceCloseModal(false)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs font-mono cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  setShowForceCloseModal(false);
                  await onForceCloseEvent();
                }}
                className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold cursor-pointer uppercase"
              >
                Eksekusi Force Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
