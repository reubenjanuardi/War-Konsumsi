'use client';

import React from 'react';
import { CategoryStatus, type AdminDashboardDto } from '@war-konsumsi/shared';

interface DashboardOverviewProps {
  data: AdminDashboardDto;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ data }) => {
  const percentSelected =
    data.totalParticipants > 0
      ? Math.round((data.selectedParticipants / data.totalParticipants) * 100)
      : 0;

  const percentQuotaConsumed =
    data.totalQuota > 0
      ? Math.round(((data.totalQuota - data.totalRemainingQuota) / data.totalQuota) * 100)
      : 0;

  const getCategoryStatusBadge = (status: CategoryStatus, remaining: number) => {
    if (remaining <= 0 || status === CategoryStatus.SOLD_OUT) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-950/80 text-rose-400 border border-rose-800">
          HABIS
        </span>
      );
    }
    if (remaining === 1 || status === CategoryStatus.LAST_ONE) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-950/80 text-amber-400 border border-amber-800">
          SISA 1
        </span>
      );
    }
    if (status === CategoryStatus.LIMITED) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-yellow-950/80 text-yellow-400 border border-yellow-800">
          TERBATAS
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
        TERSEDIA
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Peserta */}
        <div className="bg-slate-900 border border-slate-800 rounded p-4 flex flex-col justify-between">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Total Peserta
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-white tracking-tight">
            {data.totalParticipants}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-mono">Terdaftar</div>
        </div>

        {/* Sudah Memilih */}
        <div className="bg-slate-900 border border-slate-800 rounded p-4 flex flex-col justify-between">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Sudah Memilih
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-emerald-400 tracking-tight">
            {data.selectedParticipants}
          </div>
          <div className="mt-1 text-[11px] text-emerald-500/80 font-mono">
            {percentSelected}% dari peserta
          </div>
        </div>

        {/* Belum Memilih */}
        <div className="bg-slate-900 border border-slate-800 rounded p-4 flex flex-col justify-between">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Belum Memilih
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-amber-400 tracking-tight">
            {data.unselectedParticipants}
          </div>
          <div className="mt-1 text-[11px] text-amber-500/80 font-mono">Menunggu aksi</div>
        </div>

        {/* Total Kuota */}
        <div className="bg-slate-900 border border-slate-800 rounded p-4 flex flex-col justify-between">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Kapasitas Kuota
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-white tracking-tight">
            {data.totalQuota}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-mono">Semua kategori</div>
        </div>

        {/* Kuota Tersisa */}
        <div className="bg-slate-900 border border-slate-800 rounded p-4 flex flex-col justify-between">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Kuota Tersisa
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-cyan-400 tracking-tight">
            {data.totalRemainingQuota}
          </div>
          <div className="mt-1 text-[11px] text-cyan-500/80 font-mono">
            {100 - percentQuotaConsumed}% tersedia
          </div>
        </div>

        {/* Kategori Habis */}
        <div className="bg-slate-900 border border-slate-800 rounded p-4 flex flex-col justify-between">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Kategori Habis
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-rose-400 tracking-tight">
            {data.soldOutCategoriesCount}
          </div>
          <div className="mt-1 text-[11px] text-rose-500/80 font-mono">
            dari {data.categories.length} menu
          </div>
        </div>
      </div>

      {/* Live Quota Distribution Bars */}
      <div className="bg-slate-900 border border-slate-800 rounded p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
              Distribusi Kuota Menu Realtime
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Data tersinkronisasi otomatis dengan PostgreSQL saat war berlangsung.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Terpakai: <span className="text-white font-bold">{data.totalQuota - data.totalRemainingQuota}</span> / {data.totalQuota}
          </div>
        </div>

        <div className="space-y-4">
          {data.categories.map((cat) => {
            const consumed = cat.quota - cat.remainingQuota;
            const pct = cat.quota > 0 ? Math.round((consumed / cat.quota) * 100) : 0;
            const isSoldOut = cat.remainingQuota <= 0;

            return (
              <div key={cat.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200">{cat.name}</span>
                    {!cat.isActive && (
                      <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                        NONAKTIF
                      </span>
                    )}
                    {getCategoryStatusBadge(cat.status, cat.remainingQuota)}
                  </div>
                  <div className="text-slate-400">
                    <span className="text-white font-bold">{consumed}</span> / {cat.quota}{' '}
                    <span className="text-slate-500">
                      ({cat.remainingQuota} tersisa)
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isSoldOut
                        ? 'bg-rose-500'
                        : pct > 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
