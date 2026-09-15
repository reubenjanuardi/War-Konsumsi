'use client';

import React from 'react';
import { CategoryCard } from './CategoryCard';
import type { CategoryDto } from '@war-konsumsi/shared';

interface SelectionScreenProps {
  categories: CategoryDto[];
  processingCategoryId: string | null;
  onSelect: (categoryId: string) => void;
}

export const SelectionScreen: React.FC<SelectionScreenProps> = ({
  categories,
  processingCategoryId,
  onSelect,
}) => {
  const availableCount = categories.filter((c) => c.remainingQuota > 0 && c.isActive).length;

  return (
    <div className="flex-1 flex flex-col py-2">
      {/* Sub-header instruction */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Pilih Menu Konsumsi
          </h2>
          <span className="text-[11px] font-mono font-medium text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
            {availableCount} menu tersedia
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Pilih salah satu menu di bawah. Quota berkurang secara real time seiring pilihan peserta lain.
        </p>
      </div>

      {/* Categories List */}
      <div className="space-y-3 pb-8">
        {categories.map((cat) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            isProcessingThis={processingCategoryId === cat.id}
            isAnyProcessing={processingCategoryId !== null}
            onSelect={onSelect}
          />
        ))}

        {categories.length === 0 && (
          <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800 text-slate-500 text-xs">
            Belum ada kategori konsumsi yang tersedia.
          </div>
        )}
      </div>
    </div>
  );
};
