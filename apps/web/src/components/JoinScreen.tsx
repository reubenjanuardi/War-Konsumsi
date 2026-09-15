'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PARTICIPANT_NAME_MIN_LENGTH, PARTICIPANT_NAME_MAX_LENGTH } from '@war-konsumsi/shared';

interface JoinScreenProps {
  eventName?: string | null;
  onJoin: (name: string) => Promise<void>;
}

export const JoinScreen: React.FC<JoinScreenProps> = ({ eventName, onJoin }) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const trimmed = name.trim();
  const isValid =
    trimmed.length >= PARTICIPANT_NAME_MIN_LENGTH &&
    trimmed.length <= PARTICIPANT_NAME_MAX_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setValidationError(null);

    try {
      await onJoin(trimmed);
    } catch (err: any) {
      setValidationError(err.message || 'Gagal bergabung. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center py-6 px-1 sm:px-0">
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="mb-6">
          <span className="text-[11px] font-mono uppercase tracking-wider text-amber-500 font-semibold">
            {eventName || 'EVENT KONSUMSI'}
          </span>
          <h2 className="text-xl font-bold tracking-tight text-white mt-1">
            Pilih Konsumsi Acara
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Sistem war pemilihan dengan quota terbatas. Masukkan nama lengkap kamu untuk memulai.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="participant-name" className="text-xs font-medium text-slate-300">
                Nama kamu
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {trimmed.length}/{PARTICIPANT_NAME_MAX_LENGTH}
              </span>
            </div>

            <input
              id="participant-name"
              data-testid="join-name-input"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="Contoh: Budi Santoso"
              maxLength={PARTICIPANT_NAME_MAX_LENGTH}
              disabled={isSubmitting}
              className="w-full min-h-[48px] px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700/80 text-white text-base placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors touch-manipulation"
              autoComplete="name"
              autoFocus
            />

            {validationError && (
              <p className="text-[11px] text-rose-400 mt-1.5" role="alert">
                {validationError}
              </p>
            )}

            {!validationError && trimmed.length > 0 && trimmed.length < PARTICIPANT_NAME_MIN_LENGTH && (
              <p className="text-[11px] text-amber-400 mt-1.5">
                Nama minimal 2 karakter.
              </p>
            )}
          </div>

          <button
            data-testid="join-submit-btn"
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full min-h-[50px] px-4 py-3 rounded-lg font-semibold text-sm tracking-wide bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 touch-manipulation shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <span>MULAI PEMILIHAN</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
