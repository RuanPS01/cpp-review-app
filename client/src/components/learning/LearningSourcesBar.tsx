import React from 'react';
import { AlertTriangle, Check, Download, Loader2, Minus } from 'lucide-react';
import type { ActivitySummary } from '../../types/learning';
import { VIZ, formatDateTime, formatNumber } from '../statistics/charts/chartTheme';

interface LearningSourcesBarProps {
  t: Record<string, string>;
  lang: string;
  activity: ActivitySummary | null;
  sources: { logs: boolean; participation: boolean; history: boolean; taxonomy: boolean } | null;
  collecting: boolean;
  progress: string;
  onCollect: () => void;
}

/**
 * O que está e o que não está medido, antes de qualquer número.
 *
 * Metade dos indicadores depende dos logs do Moodle, que não vêm na importação
 * de código. Dizer isso no topo evita que a ausência de uma fonte seja lida
 * como desempenho fraco da turma.
 */
const LearningSourcesBar: React.FC<LearningSourcesBarProps> = ({
  t, lang, activity, sources, collecting, progress, onCollect
}) => {
  const entries = [
    { key: 'logs', label: t.learnSourceLogs, on: Boolean(sources?.logs) },
    { key: 'participation', label: t.learnSourceParticipation, on: Boolean(sources?.participation) },
    { key: 'history', label: t.learnSourceHistory, on: Boolean(sources?.history) },
    { key: 'taxonomy', label: t.learnSourceTaxonomy, on: Boolean(sources?.taxonomy) }
  ];

  return (
    <div className="rounded-xl border border-border-main bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-text-dim">{t.learnSourcesTitle}</div>
          <div className="flex flex-wrap items-center gap-3">
            {entries.map(entry => (
              <span
                key={entry.key}
                className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                style={{
                  borderColor: entry.on ? VIZ.good : 'var(--border-main)',
                  color: entry.on ? VIZ.good : 'var(--text-dim)'
                }}
              >
                {entry.on ? <Check size={11} /> : <Minus size={11} />}
                {entry.label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <button
            onClick={onCollect}
            disabled={collecting}
            className="flex items-center gap-2 rounded-lg border border-border-main bg-button px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-text-main transition-all active:scale-95 hover:border-accent/50 hover:text-accent disabled:opacity-50"
          >
            {collecting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {activity?.collected ? t.learnCollectAgain : t.learnCollectLogs}
          </button>
          <span className="text-[10px] text-text-dim">
            {collecting && progress
              ? progress
              : activity?.collected
                ? `${t.learnCollectedAt}: ${formatDateTime(activity.collectedAt, lang)} · ${t.learnLogRows.replace('{rows}', formatNumber(activity.logRows ?? 0))}`
                : t.learnCollectHint}
          </span>
        </div>
      </div>

      {activity?.warnings && activity.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border-main pt-3 text-[11px] leading-tight text-text-dim">
          {activity.warnings.map((warning, index) => (
            <li key={index} className="flex items-start gap-2">
              <AlertTriangle size={11} className="mt-0.5 shrink-0" style={{ color: VIZ.warning }} />
              {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LearningSourcesBar;
