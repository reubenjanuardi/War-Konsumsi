'use client';

import React from 'react';
import { Loader2, Flame, AlertTriangle } from 'lucide-react';
import type { CategoryDto } from '@war-konsumsi/shared';
import { CategoryStatus } from '@war-konsumsi/shared';

interface CategoryCardProps {
  category: CategoryDto;
  isProcessingThis: boolean;
  isAnyProcessing: boolean;
  onSelect: (categoryId: string) => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  isProcessingThis,
  isAnyProcessing,
  onSelect,
}) => {
  const isSoldOut = category.remainingQuota <= 0 || category.status === CategoryStatus.SOLD_OUT;
  const isLastOne = category.remainingQuota === 1 || category.status === CategoryStatus.LAST_ONE;
  const isLimited = category.status === CategoryStatus.LIMITED;

  return (
    <div
      data-testid={`category-card-${category.id}`}
      className={`w-full rounded-xl border p-4 transition-colors flex flex-col justify-between ${
        isSoldOut
          ? 'bg-slate-950/60 border-slate-900 text-slate-600'
          : isLastOne
            ? 'bg-slate-900/90 border-rose-500/40 shadow-sm'
            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-sm'
      }`}
    >
      <div>
        {/* Top bar: Category Name and Quota Badge */}
        <div className="flex items-start justify-between gap-2">
          <h3
            className={`font-bold text-base tracking-tight leading-snug ${
              isSoldOut ? 'text-slate-500 line-through' : 'text-white'
            }`}
          >
            {category.name}
          </h3>

          {/* Quota Badge */}
          <div className="shrink-0">
            {isSoldOut ? (
              <span
                data-testid={`quota-badge-${category.id}`}
                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-900 border border-slate-800 text-slate-500"
              >
                HABIS
              </span>
            ) : isLastOne ? (
              <span
                data-testid={`quota-badge-${category.id}`}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/20 border border-rose-500/40 text-rose-300 animate-pulse"
              >
                <Flame className="w-3 h-3 text-rose-400" />
                <span>1 TERSISA</span>
              </span>
            ) : isLimited ? (
              <span
                data-testid={`quota-badge-${category.id}`}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300"
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>{category.remainingQuota} TERSISA</span>
              </span>
            ) : (
              <span
                data-testid={`quota-badge-${category.id}`}
                className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-800/80 border border-slate-700/60 text-slate-300 tabular-nums"
              >
                {category.remainingQuota} tersisa
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {category.description && (
          <p
            className={`text-xs mt-1.5 leading-relaxed ${
              isSoldOut ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            {category.description}
          </p>
        )}
      </div>

      {/* Action Button */}
      <div className="mt-4 pt-2">
        <button
          data-testid={`select-btn-${category.id}`}
          type="button"
          disabled={isSoldOut || isAnyProcessing}
          onClick={() => onSelect(category.id)}
          className={`w-full min-h-[48px] px-4 py-2.5 rounded-lg text-sm font-semibold tracking-wide flex items-center justify-center gap-2 transition-all touch-manipulation ${
            isSoldOut
              ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
              : isProcessingThis
                ? 'bg-amber-600 text-slate-950 cursor-wait'
                : isLastOne
                  ? 'bg-rose-500 text-white hover:bg-rose-400 active:scale-[0.98]'
                  : 'bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-[0.98]'
          } disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100`}
        >
          {isProcessingThis ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Memproses...</span>
            </>
          ) : isSoldOut ? (
            <span>HABIS</span>
          ) : (
            <span>PILIH MENU INI</span>
          )}
        </button>
      </div>
    </div>
  );
};
