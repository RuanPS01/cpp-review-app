import React from 'react';
import type { StatisticsMetrics } from '../../types/statistics';
import ChartCard from './charts/ChartCard';
import BarChart from './charts/BarChart';
import { RISK_COLORS, VIZ, formatNumber, formatPercent } from './charts/chartTheme';

interface TurmaComparisonProps {
  metrics: StatisticsMetrics;
  t: Record<string, string>;
}

/**
 * Comparação lado a lado das turmas selecionadas. Cada linha vem de um cálculo
 * isolado da turma (`byTurma`), então os números batem com o que a tela mostra
 * quando aquela turma é vista sozinha.
 */
const TurmaComparison: React.FC<TurmaComparisonProps> = ({ metrics, t }) => {
  if (!metrics.combined || metrics.byTurma.length < 2) return null;

  const rows = metrics.byTurma;

  return (
    <ChartCard
      title={t.statsTurmaComparison}
      subtitle={t.statsTurmaComparisonSub}
      className="xl:col-span-2"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="border-b border-border-main text-[10px] font-black uppercase tracking-widest text-text-dim">
            <tr>
              <th className="py-2">{t.statsColumnTurma}</th>
              <th className="py-2 text-right">{t.statsKpiStudents}</th>
              <th className="py-2 text-right">{t.statsTabQuestions}</th>
              <th className="py-2 text-right">{t.statsKpiSubmissionRate}</th>
              <th className="py-2 text-right">{t.statsKpiAvgGrade}</th>
              <th className="py-2 text-right">{t.statsKpiPassRate}</th>
              <th className="py-2 text-right">{t.statsKpiLate}</th>
              <th className="py-2 text-right">{t.statsKpiAtRisk}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-main/50">
            {rows.map(entry => (
              <tr key={entry.turma}>
                <td className="max-w-[220px] truncate py-2 font-bold text-text-main">{entry.turma}</td>
                <td className="py-2 text-right tabular-nums text-text-dim">
                  {formatNumber(entry.overview.totalStudents)}
                  {entry.overview.excludedStudents > 0 && (
                    <span
                      className="ml-1 text-[9px]"
                      title={t.statsIgnoredCount.replace('{count}', String(entry.overview.excludedStudents))}
                      style={{ color: VIZ.warning }}
                    >
                      −{formatNumber(entry.overview.excludedStudents)}
                    </span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums text-text-dim">{formatNumber(entry.questionCount)}</td>
                <td className="py-2 text-right tabular-nums text-text-dim">{formatPercent(entry.overview.submissionRate)}</td>
                <td className="py-2 text-right font-black tabular-nums text-text-bright">{formatPercent(entry.overview.avgPercent)}</td>
                <td className="py-2 text-right tabular-nums text-text-dim">{formatPercent(entry.overview.passRate)}</td>
                <td className="py-2 text-right tabular-nums text-text-dim">{formatNumber(entry.overview.lateCount)}</td>
                <td
                  className="py-2 text-right font-black tabular-nums"
                  style={{ color: entry.overview.atRiskCount > 0 ? RISK_COLORS.high : RISK_COLORS.low }}
                >
                  {formatNumber(entry.overview.atRiskCount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        <BarChart
          orientation="horizontal"
          data={rows.map(entry => ({
            label: entry.turma,
            value: entry.overview.avgPercent ?? 0,
            color: (entry.overview.avgPercent ?? 0) >= metrics.overview.passThreshold ? VIZ.series1 : VIZ.warning,
            detail: [
              { label: t.statsKpiSubmissionRate, value: formatPercent(entry.overview.submissionRate) },
              { label: t.statsKpiPassRate, value: formatPercent(entry.overview.passRate) },
              { label: t.statsKpiStudents, value: formatNumber(entry.overview.totalStudents) }
            ]
          }))}
          max={100}
          valueLabel={t.statsKpiAvgGrade}
          formatValue={(value) => `${formatNumber(value)}%`}
          height={Math.max(120, rows.length * 34)}
          labelWidth={220}
        />
      </div>
    </ChartCard>
  );
};

export default TurmaComparison;
