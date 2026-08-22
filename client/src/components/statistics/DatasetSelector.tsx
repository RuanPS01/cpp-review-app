import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Database, Layers, Trash2, UserX } from 'lucide-react';
import type { StatisticsDatasetSummary } from '../../types/statistics';
import { VIZ, formatDateTime, formatNumber } from './charts/chartTheme';

interface DatasetSelectorProps {
  datasets: StatisticsDatasetSummary[];
  selected: string[];
  onToggle: (turma: string) => void;
  onSelectOnly: (turma: string) => void;
  onSelectAll: () => void;
  onDelete: (turma: string) => void;
  t: Record<string, string>;
  lang: string;
}

/**
 * Seletor de importações com múltipla escolha. Marcar mais de uma turma
 * consolida as métricas em uma visão única — por isso a lista é de caixas de
 * seleção, e não um `select` simples.
 */
const DatasetSelector: React.FC<DatasetSelectorProps> = ({
  datasets, selected, onToggle, onSelectOnly, onSelectAll, onDelete, t, lang
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const label = selected.length === 0
    ? t.statsSelectDatasets
    : selected.length === 1
      ? selected[0]
      : t.statsSelectedCount.replace('{count}', String(selected.length));

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(previous => !previous)}
        className={`flex max-w-[340px] items-center gap-2 rounded-lg border bg-button px-4 py-2.5 text-xs font-bold transition-all hover:border-accent/50 ${
          open ? 'border-accent text-accent' : 'border-border-main text-text-main'
        }`}
      >
        {selected.length > 1 ? <Layers size={14} className="shrink-0 text-accent" /> : <Database size={14} className="shrink-0 text-text-dim" />}
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-[420px] max-w-[85vw] overflow-hidden rounded-xl border border-border-main bg-panel shadow-2xl duration-150 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-border-main bg-header px-4 py-2.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">
              {t.statsSelectDatasets}
            </span>
            <button
              onClick={onSelectAll}
              className="text-[10px] font-black uppercase tracking-widest text-text-dim transition-colors hover:text-accent"
            >
              {t.statsSelectAll}
            </button>
          </div>

          <ul className="max-h-[50vh] divide-y divide-border-main/50 overflow-y-auto">
            {datasets.map(dataset => {
              const isSelected = selected.includes(dataset.turma);
              return (
                <li key={dataset.turma} className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/5">
                  <button
                    onClick={() => onToggle(dataset.turma)}
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                      isSelected ? 'border-accent bg-accent text-black' : 'border-border-main'
                    }`}
                    aria-label={dataset.turma}
                  >
                    {isSelected && <Check size={11} strokeWidth={4} />}
                  </button>

                  <button onClick={() => onToggle(dataset.turma)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-xs font-bold text-text-main">{dataset.turma}</div>
                    <div className="mt-0.5 text-[10px] text-text-dim">
                      {t.statsDatasetMeta
                        .replace('{students}', formatNumber(dataset.studentCount))
                        .replace('{questions}', formatNumber(dataset.questionCount))}
                      {' · '}
                      {formatDateTime(dataset.importedAt, lang)}
                    </div>
                    {Boolean(dataset.emptyStudentCount) && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: VIZ.warning }}>
                        <UserX size={10} />
                        {t.statsDatasetEmpty.replace('{count}', formatNumber(dataset.emptyStudentCount))}
                      </div>
                    )}
                  </button>

                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => onSelectOnly(dataset.turma)}
                      className="rounded border border-border-main px-2 py-1 text-[9px] font-black uppercase tracking-widest text-text-dim transition-all hover:border-accent/50 hover:text-accent"
                    >
                      {t.statsSelectOnly}
                    </button>
                    <button
                      onClick={() => onDelete(dataset.turma)}
                      title={t.statsDelete}
                      className="rounded border border-transparent p-1.5 text-text-dim transition-all hover:border-red-500/50 hover:text-red-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DatasetSelector;
