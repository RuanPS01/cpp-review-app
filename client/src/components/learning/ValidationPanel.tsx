import React, { useMemo, useState } from 'react';
import { AlertTriangle, FileSpreadsheet, Info, Loader2, Target } from 'lucide-react';
import type { StatisticsMetrics } from '../../types/statistics';
import type {
  AssociationRow, IndicatorFamily, OutcomeKind, OutcomeSource
} from '../../types/learning';
import { useValidation } from '../../hooks/useValidation';
import ChartCard from '../statistics/charts/ChartCard';
import ScatterChart from '../statistics/charts/ScatterChart';
import AcademicImportModal from './AcademicImportModal';
import { VIZ, formatNumber, formatDate } from '../statistics/charts/chartTheme';

interface ValidationPanelProps {
  metrics: StatisticsMetrics;
  t: Record<string, string>;
  lang: string;
}

const FAMILY_ORDER: IndicatorFamily[] = ['independent', 'partial', 'shared'];

/**
 * Como se lê um intervalo — **pela largura**, nunca por ele cruzar o zero.
 *
 * "O intervalo não cruza zero" é um p-valor pela porta dos fundos: devolve
 * exatamente o problema de comparações múltiplas que motivou tirar o p-valor
 * daqui. O que um intervalo honestamente diz é o quanto ele deixa em aberto.
 */
function readWidth(width: number | null, t: Record<string, string>) {
  if (width === null) return null;
  if (width <= 0.3) return { label: t.valWidthNarrow, inconclusive: false };
  if (width <= 0.6) return { label: t.valWidthWide, inconclusive: false };
  return { label: t.valWidthInconclusive, inconclusive: true };
}

const IndicatorRow: React.FC<{
  row: AssociationRow;
  t: Record<string, string>;
  selected: boolean;
  onSelect: () => void;
}> = ({ row, t, selected, onSelect }) => {
  const width = readWidth(row.width, t);
  const measurable = row.status === 'ok';
  // Quando o intervalo é largo demais, o ponto some: exibi-lo daria a um
  // número que a amostra não sustenta a aparência de um achado.
  const showValue = measurable && !width?.inconclusive;

  return (
    <tr
      onClick={measurable ? onSelect : undefined}
      className={`${measurable ? 'cursor-pointer hover:bg-button' : ''} ${selected ? 'bg-button' : ''} transition-colors`}
    >
      <td className="py-2 pr-4">
        <span className="text-text-main">{t[`learnInd_${row.key}`] || row.key}</span>
        {row.smallSample && measurable && (
          <span className="ml-2 text-[9px] uppercase tracking-widest" style={{ color: VIZ.warning }}>
            {t.valSmallSample}
          </span>
        )}
        {row.partialCoverage && measurable && (
          <span className="ml-2 text-[9px] uppercase tracking-widest text-text-dim">
            {t.valPartialCoverage}
          </span>
        )}
      </td>
      <td className="py-2 pr-4 text-right font-black tabular-nums text-text-bright">
        {showValue ? formatNumber(row.value, 2) : '—'}
      </td>
      <td className="py-2 pr-4 text-right text-[10px] tabular-nums text-text-dim">
        {row.ci ? `${formatNumber(row.ci[0], 2)} a ${formatNumber(row.ci[1], 2)}` : '—'}
      </td>
      <td className="py-2 pr-4 text-[10px] text-text-dim">
        {measurable
          ? width?.label
          : row.status === 'constant'
            ? t.valStatusConstant.replace('{value}', formatNumber(row.onlyValue, 1))
            : t[`valStatus_${row.status}`] || row.status}
      </td>
      <td className="py-2 text-right text-[10px] tabular-nums text-text-dim">{row.n}</td>
    </tr>
  );
};

const ValidationPanel: React.FC<ValidationPanelProps> = ({ metrics, t, lang }) => {
  const validation = useValidation(metrics.turma);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const { association, outcome, academic } = validation;
  const config = outcome?.config;

  const selectedRow: AssociationRow | null = useMemo(() => {
    if (!association?.blocks) return null;
    const all = association.blocks.flatMap(block => block.indicators);
    return all.find(row => row.key === selected) || null;
  }, [association, selected]);

  const update = (patch: Record<string, unknown>) => {
    if (!config) return;
    validation.saveOutcome({ ...config, ...patch });
  };

  if (validation.loading && !association) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 size={36} className="animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {validation.error && (
        <div className="rounded-xl border p-4 text-center" style={{ borderColor: VIZ.critical }}>
          <p className="text-sm font-bold" style={{ color: VIZ.critical }}>{validation.error}</p>
        </div>
      )}

      {/* --- Desfecho ------------------------------------------------------ */}
      <div className="rounded-xl border border-border-main bg-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-text-dim">{t.valOutcomeTitle}</h3>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-text-dim">{t.valOutcomeHint}</p>
          </div>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 rounded-lg border border-border-main bg-button px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-text-main transition-all active:scale-95 hover:border-accent/50 hover:text-accent"
          >
            <FileSpreadsheet size={14} />
            {academic?.imported ? t.valReimportSheet : t.valImportSheet}
          </button>
        </div>

        {config && (
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-text-dim">{t.valKind}</span>
              <select
                value={config.kind}
                onChange={(event) => update({ kind: event.target.value as OutcomeKind })}
                className="w-full cursor-pointer rounded-lg border border-border-main bg-input px-3 py-2 text-[11px] text-text-main focus:border-accent focus:outline-none"
              >
                <option value="finalGrade">{t.valKindFinalGrade}</option>
                <option value="failed">{t.valKindFailed}</option>
                <option value="dropout">{t.valKindDropout}</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-text-dim">{t.valSource}</span>
              <select
                value={config.source}
                onChange={(event) => update({ source: event.target.value as OutcomeSource })}
                className="w-full cursor-pointer rounded-lg border border-border-main bg-input px-3 py-2 text-[11px] text-text-main focus:border-accent focus:outline-none"
              >
                <option value="academic">{t.valSourceAcademic}</option>
                <option value="professorGrades">{t.valSourceProfessor}</option>
                <option value="manual">{t.valSourceManual}</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-text-dim">{t.valCut}</span>
              <input
                type="number"
                value={config.cut}
                onChange={(event) => update({ cut: Number(event.target.value) })}
                className="w-full rounded-lg border border-border-main bg-input px-3 py-2 text-[11px] text-text-main focus:border-accent focus:outline-none"
              />
            </label>

            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-text-dim">{t.valVplWeight}</span>
              <input
                type="number"
                value={config.vplWeight ?? ''}
                placeholder={t.valVplWeightUnknown}
                onChange={(event) => update({ vplWeight: event.target.value === '' ? null : Number(event.target.value) })}
                className="w-full rounded-lg border border-border-main bg-input px-3 py-2 text-[11px] text-text-main focus:border-accent focus:outline-none"
              />
            </label>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border-main pt-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            {t.valDefinedFor.replace('{defined}', String(outcome?.defined ?? 0)).replace('{total}', String(outcome?.total ?? 0))}
          </span>
          <div className="flex rounded-lg border border-border-main bg-button p-1">
            {([
              { key: 'full' as const, label: t.valWindowFull },
              { key: 'early' as const, label: t.valWindowEarly }
            ]).map(item => (
              <button
                key={item.key}
                onClick={() => validation.setWindow(item.key)}
                className={`rounded-md px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all ${
                  validation.window === item.key ? 'bg-accent text-black' : 'text-text-dim hover:text-accent'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {association?.cutoff && (
            <span className="text-[10px] text-text-dim">
              {t.valWindowUntil.replace('{date}', formatDate(association.cutoff, lang))}
            </span>
          )}
        </div>
      </div>

      {/* --- Avisos -------------------------------------------------------- */}
      {(association?.warnings?.length ?? 0) > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: VIZ.warning }}>
          <ul className="space-y-1 text-[11px] leading-tight text-text-dim">
            {association!.warnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-2">
                <AlertTriangle size={11} className="mt-0.5 shrink-0" style={{ color: VIZ.warning }} />
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!association?.available ? (
        <div className="rounded-xl border border-dashed border-border-main p-10 text-center">
          <Target size={28} className="mx-auto text-text-dim" />
          <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-text-dim">{t.valNoOutcome}</p>
          <p className="mx-auto mt-2 max-w-lg text-[11px] leading-relaxed text-text-dim">{t.valNoOutcomeHint}</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border-main bg-panel p-4">
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-text-dim">
              <Info size={12} className="mt-0.5 shrink-0" />
              {t.valNotPrediction}
            </p>
          </div>

          {FAMILY_ORDER.map(family => {
            const block = association.blocks.find(item => item.family === family);
            if (!block) return null;
            return (
              <ChartCard
                key={family}
                title={t[`valFamily_${family}`]}
                subtitle={t[`valFamilyHint_${family}`]}
                footer={t.valOrderNote}
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead className="border-b border-border-main text-[10px] font-black uppercase tracking-widest text-text-dim">
                      <tr>
                        <th className="py-2">{t.valIndicator}</th>
                        <th className="py-2 pr-4 text-right">
                          {association.measure === 'cliffsDelta' ? t.valDelta : t.valRho}
                        </th>
                        <th className="py-2 pr-4 text-right">{t.valInterval}</th>
                        <th className="py-2">{t.valReading}</th>
                        <th className="py-2 text-right">{t.valPairs}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-main/50">
                      {block.indicators.map(row => (
                        <IndicatorRow
                          key={row.key}
                          row={row}
                          t={t}
                          selected={selected === row.key}
                          onSelect={() => setSelected(selected === row.key ? null : row.key)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            );
          })}

          {selectedRow && selectedRow.points.length > 0 && (
            <ChartCard
              title={t.valScatterTitle.replace('{indicator}', t[`learnInd_${selectedRow.key}`] || selectedRow.key)}
              subtitle={t.valScatterSub}
            >
              <ScatterChart
                points={selectedRow.points.map(point => ({
                  x: point.x,
                  y: association.outcome.binary ? point.y * 100 : point.y,
                  label: point.label,
                  color: VIZ.series1
                }))}
                xLabel={t[`learnInd_${selectedRow.key}`] || selectedRow.key}
                yLabel={association.outcome.binary ? t.valOutcomeBinaryAxis : t.valOutcomeGradeAxis}
                referenceY={association.outcome.binary
                  ? undefined
                  : { value: association.outcome.cut, label: t.valCut }}
              />
            </ChartCard>
          )}
        </>
      )}

      <AcademicImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        turma={metrics.turma}
        t={t}
        onImported={validation.importAcademic}
      />
    </div>
  );
};

export default ValidationPanel;
