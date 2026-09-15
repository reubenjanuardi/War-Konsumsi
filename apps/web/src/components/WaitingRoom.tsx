'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import type { CountdownResult } from '../hooks/useCountdown';

interface WaitingRoomProps {
  participantName?: string | null;
  eventName?: string | null;
  countdown: CountdownResult;
  startsAt?: string | null;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  participantName,
  eventName,
  countdown,
  startsAt,
}) => {
  return (
    <div className="flex-1 flex flex-col justify-center items-center text-center py-6 px-1">
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-sm">
        {/* Waiting Header */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium mb-4">
          <Clock className="w-3.5 h-3.5 animate-pulse" />
          <span>RUANG TUNGGU</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Hai, <span className="text-amber-400">{participantName || 'Peserta'}</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          {eventName || 'Pemilihan Konsumsi'} belum dimulai.
        </p>

        {/* Countdown Display */}
        <div className="my-8 py-6 px-4 bg-slate-950 border border-slate-800/80 rounded-lg">
          <span className="text-[11px] font-mono uppercase tracking-widest text-slate-500 block mb-2">
            PEMILIHAN DIMULAI DALAM
          </span>

          <div
            data-testid="countdown-display"
            className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white flex items-center justify-center gap-2 tabular-nums"
          >
            <div className="flex flex-col items-center">
              <span>{countdown.hours}</span>
              <span className="text-[9px] font-sans font-normal text-slate-500 uppercase tracking-normal">
                Jam
              </span>
            </div>
            <span className="text-slate-600 -mt-4">:</span>
            <div className="flex flex-col items-center">
              <span>{countdown.minutes}</span>
              <span className="text-[9px] font-sans font-normal text-slate-500 uppercase tracking-normal">
                Menit
              </span>
            </div>
            <span className="text-slate-600 -mt-4">:</span>
            <div className="flex flex-col items-center">
              <span className="text-amber-400">{countdown.seconds}</span>
              <span className="text-[9px] font-sans font-normal text-slate-500 uppercase tracking-normal">
                Detik
              </span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3.5 text-left">
          <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>Petunjuk War Konsumsi:</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Jangan tutup atau refresh halaman ini. Ketika countdown selesai, sistem akan secara otomatis membuka daftar menu dan mengaktifkan tombol pemilihan.
          </p>
          {startsAt && (
            <p className="text-[10px] text-slate-500 mt-2 font-mono">
              Jadwal mulai: {new Date(startsAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
