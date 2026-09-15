'use client';

import React, { useState } from 'react';
import type { AdminDashboardDto } from '@war-konsumsi/shared';

interface ExportSectionProps {
  data: AdminDashboardDto;
  onExportCsv: () => Promise<void>;
}

export const ExportSection: React.FC<ExportSectionProps> = ({ data, onExportCsv }) => {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await onExportCsv();
    } catch {
      setError('Gagal mengunduh file CSV. Pastikan koneksi dan kredensial valid.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded p-6 space-y-5">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
          Ekspor Rekapitulasi Pemilihan Konsumsi
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Unduh data lengkap untuk keperluan distribusi makanan, verifikasi panitia, atau pelaporan konsumsi katering.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
        <div className="bg-slate-950 p-3 rounded border border-slate-800">
          <div className="text-slate-500">FORMAT BERKAS</div>
          <div className="text-white font-bold mt-1">CSV (UTF-8 with BOM)</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Kompatibel dengan Microsoft Excel</div>
        </div>

        <div className="bg-slate-950 p-3 rounded border border-slate-800">
          <div className="text-slate-500">TOTAL REKOR</div>
          <div className="text-emerald-400 font-bold mt-1">
            {data.totalParticipants} Peserta
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {data.selectedParticipants} terverifikasi memilih
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded border border-slate-800">
          <div className="text-slate-500">TIMESTAMP AUDIT</div>
          <div className="text-cyan-400 font-bold mt-1">Presisi Waktu PostgreSQL</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Mencegah sengketa pilihan peserta</div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-900 text-rose-300 text-xs rounded font-mono">
          {error}
        </div>
      )}

      <div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-mono font-bold rounded uppercase tracking-wider transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
        >
          {downloading ? (
            <>
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Menyiapkan Unduhan CSV...
            </>
          ) : (
            <>
              <span>⬇</span>
              Unduh Rekap Konsumsi (.CSV)
            </>
          )}
        </button>
      </div>
    </div>
  );
};
