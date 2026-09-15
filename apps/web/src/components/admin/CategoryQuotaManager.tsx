'use client';

import React, { useState } from 'react';
import { CategoryStatus, type CategoryDto, type CreateCategoryDto, type UpdateCategoryDto } from '@war-konsumsi/shared';

interface CategoryQuotaManagerProps {
  categories: CategoryDto[];
  onCreateCategory: (data: CreateCategoryDto) => Promise<void>;
  onUpdateCategory: (categoryId: string, data: UpdateCategoryDto) => Promise<void>;
  onResetQuota: (categoryId: string, remainingQuota?: number) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
}

export const CategoryQuotaManager: React.FC<CategoryQuotaManagerProps> = ({
  categories,
  onCreateCategory,
  onUpdateCategory,
  onResetQuota,
  onDeleteCategory,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [resetModalCat, setResetModalCat] = useState<CategoryDto | null>(null);
  const [deleteModalCat, setDeleteModalCat] = useState<CategoryDto | null>(null);
  const [resetValue, setResetValue] = useState<string>('');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // New Category Form
  const [newName, setNewName] = useState('');
  const [newQuota, setNewQuota] = useState<number>(20);
  const [newDesc, setNewDesc] = useState('');

  const handleToggleActive = async (cat: CategoryDto) => {
    setLoadingId(cat.id);
    try {
      await onUpdateCategory(cat.id, { isActive: !cat.isActive });
    } finally {
      setLoadingId(null);
    }
  };

  const handleQuickAdjustQuota = async (cat: CategoryDto, delta: number) => {
    const newQuotaValue = Math.max(1, cat.quota + delta);
    setLoadingId(cat.id);
    try {
      await onUpdateCategory(cat.id, { quota: newQuotaValue });
    } finally {
      setLoadingId(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newQuota <= 0) return;
    setLoadingId('new');
    try {
      await onCreateCategory({
        name: newName.trim(),
        quota: Number(newQuota),
        description: newDesc.trim() || undefined,
      });
      setShowAddModal(false);
      setNewName('');
      setNewQuota(20);
      setNewDesc('');
    } finally {
      setLoadingId(null);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalCat) return;
    setLoadingId(resetModalCat.id);
    try {
      const parsed = resetValue.trim() !== '' ? Number(resetValue) : undefined;
      await onResetQuota(resetModalCat.id, parsed);
      setResetModalCat(null);
      setResetValue('');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModalCat) return;
    setLoadingId(deleteModalCat.id);
    try {
      await onDeleteCategory(deleteModalCat.id);
      setDeleteModalCat(null);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-900 border border-slate-800 rounded p-4">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
            Manajemen Kategori & Kuota Konsumsi
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Perubahan kuota langsung dipropagasikan realtime ke layar peserta via Socket.IO.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold rounded uppercase tracking-wider transition-colors cursor-pointer self-start sm:self-auto"
        >
          + Tambah Menu Konsumsi
        </button>
      </div>

      {/* Categories Table */}
      <div className="bg-slate-900 border border-slate-800 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Nama Menu</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Kapasitas</th>
                <th className="px-4 py-3 text-right">Tersisa</th>
                <th className="px-4 py-3 text-center">Aktif</th>
                <th className="px-4 py-3 text-right">Aksi & Kuota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {categories.map((cat) => {
                const isSoldOut = cat.remainingQuota <= 0;
                const isLoading = loadingId === cat.id;

                return (
                  <tr key={cat.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-200">
                      <div>{cat.name}</div>
                      {cat.description && (
                        <div className="text-[11px] text-slate-500 font-sans mt-0.5 line-clamp-1">
                          {cat.description}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {isSoldOut ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-400 border border-rose-800">
                          HABIS
                        </span>
                      ) : cat.remainingQuota === 1 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-400 border border-amber-800">
                          SISA 1
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                          TERSEDIA
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-bold text-slate-300">
                      {cat.quota}
                    </td>

                    <td className="px-4 py-3 text-right font-bold">
                      <span className={isSoldOut ? 'text-rose-400' : 'text-cyan-400'}>
                        {cat.remainingQuota}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(cat)}
                        disabled={isLoading}
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border transition-colors cursor-pointer ${
                          cat.isActive
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                            : 'bg-slate-800 text-slate-500 border-slate-700'
                        }`}
                      >
                        {cat.isActive ? 'AKTIF' : 'NONAKTIF'}
                      </button>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick Adjust +1 */}
                        <button
                          title="Tambah Kapasitas Kuota +1"
                          onClick={() => handleQuickAdjustQuota(cat, 1)}
                          disabled={isLoading}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer"
                        >
                          +1
                        </button>

                        {/* Quick Adjust -1 */}
                        <button
                          title="Kurangi Kapasitas Kuota -1"
                          onClick={() => handleQuickAdjustQuota(cat, -1)}
                          disabled={isLoading || cat.quota <= 1}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer disabled:opacity-40"
                        >
                          -1
                        </button>

                        {/* Reset Quota */}
                        <button
                          onClick={() => {
                            setResetModalCat(cat);
                            setResetValue(String(cat.quota));
                          }}
                          disabled={isLoading}
                          className="px-2 py-1 rounded bg-rose-950/40 hover:bg-rose-900/50 border border-rose-900/60 text-rose-300 text-[11px] cursor-pointer"
                        >
                          Reset Kuota
                        </button>

                        {/* Hapus Menu */}
                        <button
                          title={`Hapus Menu ${cat.name}`}
                          onClick={() => setDeleteModalCat(cat)}
                          disabled={isLoading}
                          className="px-2 py-1 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Category */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
              Tambah Kategori Konsumsi Baru
            </h3>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Nama Menu Konsumsi
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Nasi Liwet Komplit"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Kapasitas Kuota
                </label>
                <input
                  type="number"
                  min={1}
                  value={newQuota}
                  onChange={(e) => setNewQuota(Number(e.target.value))}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Deskripsi Menu (Opsional)
                </label>
                <textarea
                  placeholder="Rincian lauk, porsi, atau catatan khusus..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-slate-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loadingId === 'new'}
                  className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold cursor-pointer uppercase"
                >
                  {loadingId === 'new' ? 'Menyimpan...' : 'Simpan Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reset Quota */}
      {resetModalCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 border border-rose-800 rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-mono font-bold text-rose-400 uppercase tracking-wider">
              Reset Kuota Menu: {resetModalCat.name}
            </h3>

            <p className="text-xs text-slate-300">
              Tindakan ini akan langsung memperbarui sisa kuota kategori pada database dan mempublikasikan kuota baru ke seluruh peserta secara realtime.
            </p>

            <form onSubmit={handleResetSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Sisa Kuota Baru (Maksimal {resetModalCat.quota})
                </label>
                <input
                  type="number"
                  min={0}
                  max={resetModalCat.quota}
                  value={resetValue}
                  onChange={(e) => setResetValue(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setResetModalCat(null)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold cursor-pointer uppercase"
                >
                  Terapkan Kuota Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Delete Category */}
      {deleteModalCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 border border-rose-800 rounded-lg p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-mono font-bold text-rose-400 uppercase tracking-wider">
              Konfirmasi Hapus Menu Konsumsi
            </h3>

            <p className="text-xs text-slate-300">
              Apakah Anda yakin ingin menghapus menu <strong className="text-white">{deleteModalCat.name}</strong>?
            </p>

            <div className="border border-rose-950 bg-rose-950/40 p-2.5 rounded text-[11px] text-rose-300 font-mono">
              Perhatian: Menu ini akan dihapus permanen dari daftar pemilihan konsumsi.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalCat(null)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={loadingId === deleteModalCat.id}
                className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold cursor-pointer uppercase"
              >
                {loadingId === deleteModalCat.id ? 'Menghapus...' : 'Ya, Hapus Menu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
