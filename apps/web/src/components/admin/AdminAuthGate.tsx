'use client';

import React, { useState } from 'react';
import { adminApi, adminStorage } from '../../lib/admin-api';

interface AdminAuthGateProps {
  onAuthenticated: (secret: string) => void;
}

export const AdminAuthGate: React.FC<AdminAuthGateProps> = ({ onAuthenticated }) => {
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = secret.trim();
    if (!trimmed) {
      setError('Masukkan kunci rahasia admin.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isValid = await adminApi.verifySecret(trimmed);
      if (isValid) {
        onAuthenticated(trimmed);
      } else {
        setError('Kunci rahasia admin tidak valid atau ditolak oleh server (401).');
      }
    } catch {
      setError('Gagal menghubungi server untuk verifikasi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100 font-sans">
      <div className="w-full max-w-md border border-slate-800 bg-slate-900/90 rounded-lg p-6 sm:p-8 shadow-2xl">
        <div className="border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-mono tracking-widest uppercase text-slate-400">
              SISTEM OTORISASI ADMIN
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            War Konsumsi — Portal Panitia
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Akses ke endpoint administratif dilindungi otorisasi server-side.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="admin-secret"
              className="block text-xs font-mono font-medium text-slate-300 uppercase tracking-wider mb-2"
            >
              Admin Secret Key
            </label>
            <input
              id="admin-secret"
              type="password"
              value={secret}
              onChange={(e) => {
                setSecret(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Masukkan secret key..."
              disabled={loading}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2.5 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
            />
          </div>

          {error && (
            <div className="border border-rose-900/60 bg-rose-950/40 text-rose-300 px-3 py-2 rounded text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !secret.trim()}
            className="w-full bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-sm py-2.5 px-4 rounded transition-colors uppercase tracking-wider font-mono cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? 'Memverifikasi...' : 'Buka Dashboard Admin'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono">
          Strict Security: Server menolak segala modifikasi kuota tanpa header kredensial valid.
        </div>
      </div>
    </main>
  );
};
