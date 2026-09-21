import React from 'react';
import { AlertTriangle, Check, Download, Loader2, Minus } from 'lucide-react';
import type { ActivitySummary } from '../../types/learning';
import { VIZ, formatDateTime, formatNumber } from '../statistics/charts/chartTheme';

type SourceFlags = { logs: boolean; participation: boolean; history: boolean; taxonomy: boolean };

interface LearningSourcesBarProps {
  t: Record<string, string>;
  lang: string;
  sources: SourceFlags | null;
  /** Fonte que só parte da seleção tem: não é "disponível" nem "ausente". */
  sourcesPartial?: SourceFlags | null;
  perTurma?: (ActivitySummary & { turma: string })[];
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
  t, lang, sources, sourcesPartial, perTurma = [], collecting, progress, onCollect
}) => {
  const entries = ([
    { key: 'logs' as const, label: t.learnSourceLogs },
    { key: 'participation' as const, label: t.learnSourceParticipation },
    { key: 'history' as const, label: t.learnSourceHistory },
    { key: 'taxonomy' as const, label: t.learnSourceTaxonomy }
  ]).map(entry => ({
    ...entry,
    on: Boolean(sources?.[entry.key]),
    partial: Boolean(sourcesPartial?.[entry.key])
  }));

  const collected = perTurma.filter(item => item.collected);
  const anyCollected = collected.length > 0;
  const collectedAt = collected.length
    ? Math.max(...collected.map(item => item.collectedAt || 0))
    : null;
  const logRows = collected.reduce((acc, item) => acc + (item.logRows || 0), 0);
  const warnings = perTurma.flatMap(item =>
    (item.warnings || []).map(warning => (perTurma.length > 1 ? `[${item.turma}] ${warning}` : warning)));

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
                  borderColor: entry.on ? VIZ.good : entry.partial ? VIZ.warning : 'var(--border-main)',
                  color: entry.on ? VIZ.good : entry.partial ? VIZ.warning : 'var(--text-dim)'
                }}
              >
                {entry.on ? <Check size={11} /> : <Minus size={11} />}
                {entry.label}
                {/* Só parte da seleção tem a fonte: dizer "disponível" afirmaria
                    um dado que metade das turmas não tem. */}
                {entry.partial && <span className="normal-case">{t.learnSourcePartial}</span>}
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
            {anyCollected ? t.learnCollectAgain : t.learnCollectLogs}
          </button>
          <span className="text-[10px] text-text-dim">
            {collecting && progress
              ? progress
              : anyCollected
                ? `${t.learnCollectedAt}: ${formatDateTime(collectedAt, lang)} · ${t.learnLogRows.replace('{rows}', formatNumber(logRows))}`
                  + (perTurma.length > 1 ? ` · ${collected.length}/${perTurma.length} ${t.learnTurmasShort}` : '')
                : t.learnCollectHint}
          </span>
        </div>
      </div>

      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border-main pt-3 text-[11px] leading-tight text-text-dim">
          {warnings.map((warning, index) => (
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
