import React from 'react';
import {
  AlertTriangle, Award, BookOpen, CheckCircle2, Clock, FileWarning, Send, TrendingUp, Users
} from 'lucide-react';
import type { StatisticsMetrics } from '../../types/statistics';
import StatCard from './StatCard';
import ChartCard from './charts/ChartCard';
import BarChart from './charts/BarChart';
import DonutChart from './charts/DonutChart';
import { RISK_COLORS, VIZ, formatNumber, formatPercent } from './charts/chartTheme';

interface OverviewPanelProps {
  metrics: StatisticsMetrics;
  t: Record<string, string>;
}

const OverviewPanel: React.FC<OverviewPanelProps> = ({ metrics, t }) => {
  const { overview, questions } = metrics;

  const missing = Math.max(0, overview.expectedSubmissions - overview.actualSubmissions);
  const onTime = Math.max(0, overview.actualSubmissions - overview.lateCount);

  const riskSlices = [
    { label: t.statsRiskCritical, value: overview.riskBuckets.critical, color: RISK_COLORS.critical },
    { label: t.statsRiskHigh, value: overview.riskBuckets.high, color: RISK_COLORS.high },
    { label: t.statsRiskMedium, value: overview.riskBuckets.medium, color: RISK_COLORS.medium },
    { label: t.statsRiskLow, value: overview.riskBuckets.low, color: RISK_COLORS.low }
  ];

  const submissionSlices = [
    { label: t.statsLabelOnTime, value: onTime, color: VIZ.good },
    { label: t.statsLabelLate, value: overview.lateCount, color: VIZ.warning },
    { label: t.statsLabelMissing, value: missing, color: VIZ.critical }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t.statsKpiAvgGrade}
          value={formatPercent(overview.avgPercent)}
          hint={`${t.statsLabelMedian}: ${formatPercent(overview.medianPercent)} · ${t.statsLabelStdDev}: ${formatPercent(overview.stdDevPercent)}`}
          icon={TrendingUp}
          meter={overview.avgPercent}
          emphasis
        />
        <StatCard
          label={t.statsKpiSubmissionRate}
          value={formatPercent(overview.submissionRate)}
          hint={t.statsKpiSubmissionsOf
            .replace('{done}', formatNumber(overview.actualSubmissions))
            .replace('{total}', formatNumber(overview.expectedSubmissions))}
          icon={Send}
          meter={overview.submissionRate}
        />
        <StatCard
          label={t.statsKpiPassRate}
          value={formatPercent(overview.passRate)}
          hint={t.statsKpiPassHint.replace('{threshold}', String(overview.passThreshold))}
          icon={CheckCircle2}
          meter={overview.passRate}
          tone={overview.passRate >= 60 ? VIZ.good : VIZ.warning}
        />
        <StatCard
          label={t.statsKpiAtRisk}
          value={formatNumber(overview.atRiskCount)}
          hint={t.statsKpiRiskHint.replace('{critical}', formatNumber(overview.riskBuckets.critical))}
          icon={AlertTriangle}
          tone={overview.atRiskCount > 0 ? VIZ.critical : VIZ.good}
          meter={overview.totalStudents ? (overview.atRiskCount / overview.totalStudents) * 100 : 0}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t.statsKpiStudents} value={formatNumber(overview.totalStudents)} hint={`${formatNumber(overview.activeStudents)} ${t.statsLabelSubmitted.toLowerCase()}`} icon={Users} />
        <StatCard label={t.statsKpiInactive} value={formatNumber(overview.inactiveStudents)} icon={FileWarning} tone={overview.inactiveStudents > 0 ? VIZ.critical : undefined} />
        <StatCard label={t.statsKpiLate} value={formatNumber(overview.lateCount)} hint={formatPercent(overview.lateRate)} icon={Clock} tone={overview.lateCount > 0 ? VIZ.warning : undefined} />
        <StatCard
          label={t.statsKpiCompileErrors}
          value={formatPercent(overview.compileErrorRate)}
          hint={t.statsKpiCompileErrorsHint}
          icon={Award}
          tone={overview.compileErrorRate >= 20 ? VIZ.warning : undefined}
          meter={overview.compileErrorRate}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          title={t.statsChartGradeDistribution}
          subtitle={t.statsChartGradeDistributionSub}
          legend={[
            { label: t.statsLegendBelowPass, color: VIZ.warning },
            { label: t.statsLegendAbovePass, color: VIZ.series1 }
          ]}
          isEmpty={overview.histogram.every(bin => bin.count === 0)}
          footer={`${t.statsKpiZero}: ${formatNumber(overview.zeroCount)} · ${t.statsKpiPerfect}: ${formatNumber(overview.perfectCount)}`}
        >
          <BarChart
            data={overview.histogram.map(bin => ({
              label: bin.label.replace('%', ''),
              value: bin.count,
              color: bin.to <= overview.passThreshold ? VIZ.warning : VIZ.series1
            }))}
            valueLabel={t.statsLabelStudents}
            height={230}
          />
        </ChartCard>

        <ChartCard
          title={t.statsChartDifficulty}
          subtitle={t.statsChartDifficultySub}
          isEmpty={!questions.length}
        >
          <BarChart
            orientation="horizontal"
            data={[...questions]
              .sort((a, b) => (b.difficultyIndex ?? 0) - (a.difficultyIndex ?? 0))
              .map(question => ({
                label: question.name,
                value: question.difficultyIndex ?? 0,
                color: (question.difficultyIndex ?? 0) >= 60 ? VIZ.critical : (question.difficultyIndex ?? 0) >= 40 ? VIZ.warning : VIZ.series1,
                detail: [
                  { label: t.statsQuestionAvg, value: formatPercent(question.avgPercent) },
                  { label: t.statsQuestionSubmissions, value: `${question.submittedCount}/${question.expected}` },
                  { label: t.statsQuestionPassRate, value: formatPercent(question.passRate) }
                ]
              }))}
            valueLabel={t.statsQuestionDifficulty}
            formatValue={(value) => formatNumber(value)}
            height={Math.max(140, questions.length * 34)}
            labelWidth={210}
          />
        </ChartCard>

        <ChartCard
          title={t.statsChartSubmissionStatus}
          legend={submissionSlices.map(slice => ({ label: slice.label, color: slice.color }))}
          isEmpty={overview.expectedSubmissions === 0}
        >
          <DonutChart
            data={submissionSlices}
            centerValue={formatPercent(overview.submissionRate)}
            centerLabel={t.statsKpiSubmissionRate}
            formatValue={(value) => formatNumber(value)}
          />
        </ChartCard>

        <ChartCard
          title={t.statsChartRiskDistribution}
          legend={riskSlices.map(slice => ({ label: slice.label, color: slice.color }))}
          isEmpty={overview.totalStudents === 0}
        >
          <DonutChart
            data={riskSlices}
            centerValue={formatNumber(overview.totalStudents)}
            centerLabel={t.statsKpiStudents}
            formatValue={(value) => formatNumber(value)}
          />
        </ChartCard>

        <ChartCard
          title={t.statsChartQuestionAverage}
          className="xl:col-span-2"
          isEmpty={!questions.length}
          footer={overview.hardestQuestion
            ? `${t.statsKpiHardest}: ${overview.hardestQuestion.name} (${formatNumber(overview.hardestQuestion.difficultyIndex)})`
            : undefined}
        >
          <BarChart
            orientation="horizontal"
            data={questions.map(question => ({
              label: question.name,
              value: question.avgPercent ?? 0,
              color: (question.avgPercent ?? 0) >= overview.passThreshold ? VIZ.series1 : VIZ.warning,
              detail: [
                { label: t.statsQuestionSubmissions, value: `${question.submittedCount}/${question.expected}` },
                { label: t.statsQuestionAttempts, value: formatNumber(question.avgAttempts, 1) },
                { label: t.statsQuestionPassRate, value: formatPercent(question.passRate) }
              ]
            }))}
            max={100}
            valueLabel={t.statsQuestionAvg}
            formatValue={(value) => `${formatNumber(value)}%`}
            height={Math.max(140, questions.length * 36)}
            labelWidth={260}
          />
        </ChartCard>

        {metrics.professorComparison && (
          <ChartCard
            title={t.statsChartProfessor}
            subtitle={t.statsChartProfessorSub}
            className="xl:col-span-2"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="border-b border-border-main text-[10px] font-black uppercase tracking-widest text-text-dim">
                  <tr>
                    <th className="py-2">{t.studentName}</th>
                    <th className="py-2 text-right">VPL</th>
                    <th className="py-2 text-right">{t.review}</th>
                    <th className="py-2 text-right">Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-main/50">
                  {metrics.professorComparison.biggestDivergences.map(row => (
                    <tr key={`${row.userId}-${row.name}`}>
                      <td className="py-2 font-bold text-text-main">{row.name}</td>
                      <td className="py-2 text-right tabular-nums text-text-dim">{formatPercent(row.automaticAvg)}</td>
                      <td className="py-2 text-right tabular-nums text-text-dim">{formatPercent(row.professorAvg)}</td>
                      <td
                        className="py-2 text-right font-black tabular-nums"
                        style={{ color: Math.abs(row.delta) >= 20 ? VIZ.critical : Math.abs(row.delta) >= 10 ? VIZ.warning : VIZ.good }}
                      >
                        {row.delta > 0 ? '+' : ''}{formatNumber(row.delta, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border-main bg-panel p-4">
        <BookOpen size={14} className="text-accent" />
        <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">{t.statsSourcesTitle}</span>
        {[
          { key: 'enrolledUsers', label: t.statsSourceEnrolledUsers },
          { key: 'vplResults', label: t.statsSourceVplResults },
          { key: 'gradebook', label: t.statsSourceGradebook },
          { key: 'submissionHistory', label: t.statsSourceSubmissionHistory }
        ].map(source => {
          const available = Boolean(metrics.sources[source.key]);
          return (
            <span
              key={source.key}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest"
              style={{ color: available ? VIZ.good : VIZ.muted, borderColor: available ? VIZ.good : 'var(--border-main)' }}
            >
              {available ? <CheckCircle2 size={10} /> : <FileWarning size={10} />}
              {source.label} · {available ? t.statsSourceAvailable : t.statsSourceUnavailable}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default OverviewPanel;
