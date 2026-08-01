import React, { useState } from 'react';
import { AlertTriangle, CalendarClock, FlaskConical, Percent, Send, Sigma } from 'lucide-react';
import type { AIReport, StatisticsMetrics } from '../../types/statistics';
import ChartCard from './charts/ChartCard';
import BarChart from './charts/BarChart';
import StatCard from './StatCard';
import AIReportCard from './AIReportCard';
import { VIZ, formatDateTime, formatNumber, formatPercent } from './charts/chartTheme';

interface QuestionsPanelProps {
  metrics: StatisticsMetrics;
  reports: Record<string, AIReport>;
  onReportGenerated: (report: AIReport) => void;
  t: Record<string, string>;
  lang: string;
}

const QuestionsPanel: React.FC<QuestionsPanelProps> = ({ metrics, reports, onReportGenerated, t, lang }) => {
  const [selectedKey, setSelectedKey] = useState(metrics.questions[0]?.key || '');
  const question = metrics.questions.find(q => q.key === selectedKey) || metrics.questions[0];

  if (!question) {
    return (
      <div className="rounded-xl border border-dashed border-border-main p-10 text-center text-[11px] font-bold uppercase tracking-widest text-text-dim">
        {t.statsQuestionSelect}
      </div>
    );
  }

  const conceptEntries = Object.entries(question.conceptUsage)
    .filter(([, usage]) => usage.total > 0)
    .sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {metrics.questions.map(item => {
          const isSelected = item.key === question.key;
          const difficulty = item.difficultyIndex ?? 0;
          return (
            <button
              key={item.key}
              onClick={() => setSelectedKey(item.key)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-bold transition-all active:scale-95 ${
                isSelected
                  ? 'border-accent bg-accent text-black shadow-[0_0_15px_var(--accent-glow)]'
                  : 'border-border-main bg-button text-text-dim hover:border-accent/50 hover:text-accent'
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: difficulty >= 60 ? VIZ.critical : difficulty >= 40 ? VIZ.warning : VIZ.good }}
              />
              {item.name.length > 26 ? `${item.name.slice(0, 25)}…` : item.name}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t.statsQuestionDifficulty}
          value={formatNumber(question.difficultyIndex)}
          hint={t.statsChartDifficultySub}
          icon={AlertTriangle}
          meter={question.difficultyIndex}
          tone={(question.difficultyIndex ?? 0) >= 60 ? VIZ.critical : (question.difficultyIndex ?? 0) >= 40 ? VIZ.warning : VIZ.good}
          emphasis
        />
        <StatCard
          label={t.statsQuestionSubmissions}
          value={`${question.submittedCount}/${question.expected}`}
          hint={formatPercent(question.submissionRate)}
          icon={Send}
          meter={question.submissionRate}
        />
        <StatCard
          label={t.statsQuestionAvg}
          value={formatPercent(question.avgPercent)}
          hint={`${t.statsLabelMedian}: ${formatPercent(question.medianPercent)} · ${t.statsLabelStdDev}: ${formatPercent(question.stdDevPercent)}`}
          icon={Sigma}
          meter={question.avgPercent}
        />
        <StatCard
          label={t.statsQuestionPassRate}
          value={formatPercent(question.passRate)}
          hint={`${t.statsKpiZero}: ${question.zeroCount} · ${t.statsKpiPerfect}: ${question.perfectCount}`}
          icon={Percent}
          meter={question.passRate}
          tone={question.passRate >= 60 ? VIZ.good : VIZ.warning}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border-main bg-panel p-4 text-[10px] font-bold uppercase tracking-widest text-text-dim">
        <span className="flex items-center gap-2">
          <CalendarClock size={12} className="text-accent" /> {t.statsQuestionDue}: {formatDateTime(question.dueDate, lang)}
        </span>
        <span className="flex items-center gap-2">
          <FlaskConical size={12} className="text-accent" /> {t.statsQuestionTestCases}: {question.testCaseCount}
        </span>
        <span className="flex items-center gap-2">
          {t.statsQuestionAttempts}: {formatNumber(question.avgAttempts, 1)}
        </span>
        <span className="flex items-center gap-2">
          {t.statsKpiCompileErrors}: {formatPercent(question.compileErrorRate)}
        </span>
        <span className="flex items-center gap-2">
          {t.statsKpiLate}: {question.lateCount}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          title={t.statsQuestionScoreSpread}
          subtitle={`${question.name} · ${formatNumber(question.gradedCount)} ${t.statsLabelStudents}`}
          isEmpty={question.histogram.every(bin => bin.count === 0)}
        >
          <BarChart
            data={question.histogram.map(bin => ({
              label: bin.label.replace('%', ''),
              value: bin.count,
              color: bin.to <= metrics.overview.passThreshold ? VIZ.warning : VIZ.series1
            }))}
            valueLabel={t.statsLabelStudents}
            height={230}
          />
        </ChartCard>

        <ChartCard
          title={t.statsQuestionFailedCases}
          isEmpty={question.topFailedCases.length === 0}
          emptyLabel={t.statsQuestionNoFailedCases}
        >
          <BarChart
            orientation="horizontal"
            data={question.topFailedCases.map(entry => ({ label: entry.label, value: entry.count, color: VIZ.critical }))}
            valueLabel={t.statsLabelStudents}
            height={Math.max(120, question.topFailedCases.length * 32)}
            labelWidth={180}
          />
        </ChartCard>

        <ChartCard
          title={t.statsQuestionCompileErrors}
          isEmpty={question.topCompileErrors.length === 0}
          emptyLabel={t.statsQuestionNoFailedCases}
        >
          <BarChart
            orientation="horizontal"
            data={question.topCompileErrors.map(entry => ({ label: entry.label, value: entry.count, color: VIZ.warning }))}
            valueLabel={t.statsLabelStudents}
            height={Math.max(120, question.topCompileErrors.length * 32)}
            labelWidth={220}
          />
        </ChartCard>

        <ChartCard
          title={t.statsChartConcepts}
          subtitle={t.statsChartConceptsSub}
          isEmpty={conceptEntries.length === 0}
        >
          <BarChart
            orientation="horizontal"
            data={conceptEntries.map(([, usage]) => ({
              label: usage.label,
              value: usage.total ? Math.round((usage.count / usage.total) * 100) : 0,
              detail: [{ label: t.statsLabelStudents, value: `${usage.count}/${usage.total}` }]
            }))}
            max={100}
            valueLabel={t.statsLabelPercentage}
            formatValue={(value) => `${formatNumber(value)}%`}
            height={Math.max(120, conceptEntries.length * 30)}
            labelWidth={160}
          />
        </ChartCard>
      </div>

      <AIReportCard
        t={t}
        lang={lang}
        turma={metrics.turma}
        kind="question"
        targetId={question.key}
        title={`${t.statsAIQuestion} — ${question.name}`}
        description={t.statsAIQuestionDesc}
        report={reports[`question:${question.key}`]}
        onGenerated={onReportGenerated}
      />
    </div>
  );
};

export default QuestionsPanel;
