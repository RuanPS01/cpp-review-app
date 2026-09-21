import React from 'react';
import type { AIReport, StatisticsMetrics } from '../../types/statistics';
import { reportKey, scopeOf } from '../../services/statistics';
import AIReportCard from './AIReportCard';
import ChartCard from './charts/ChartCard';
import BarChart from './charts/BarChart';
import { VIZ, formatNumber } from './charts/chartTheme';

interface AIInsightsPanelProps {
  metrics: StatisticsMetrics;
  reports: Record<string, AIReport>;
  onReportGenerated: (report: AIReport) => void;
  t: Record<string, string>;
  lang: string;
}

const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({ metrics, reports, onReportGenerated, t, lang }) => (
  <div className="space-y-6">
    <AIReportCard
      t={t}
      lang={lang}
      scope={scopeOf(metrics)}
      kind="overview"
      title={t.statsAIOverview}
      description={t.statsAIOverviewDesc}
      report={reports[reportKey(metrics.turmas, 'overview')]}
      onGenerated={onReportGenerated}
    />

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <ChartCard
        title={t.statsChartConcepts}
        subtitle={t.statsChartConceptsSub}
        isEmpty={metrics.conceptCoverage.every(concept => concept.total === 0)}
      >
        <BarChart
          orientation="horizontal"
          data={metrics.conceptCoverage.map(concept => ({
            label: concept.label,
            value: concept.rate,
            detail: [{ label: t.statsLabelStudents, value: `${concept.count}/${concept.total}` }]
          }))}
          max={100}
          valueLabel={t.statsLabelPercentage}
          formatValue={(value) => `${formatNumber(value)}%`}
          height={Math.max(140, metrics.conceptCoverage.length * 28)}
          labelWidth={160}
        />
      </ChartCard>

      <ChartCard
        title={t.statsChartSmells}
        isEmpty={metrics.smellCounts.every(smell => smell.total === 0)}
      >
        <BarChart
          orientation="horizontal"
          data={metrics.smellCounts.map(smell => ({
            label: smell.label,
            value: smell.rate,
            color: smell.rate >= 50 ? VIZ.warning : VIZ.series3,
            detail: [{ label: t.statsLabelSubmissions, value: `${smell.count}/${smell.total}` }]
          }))}
          max={100}
          valueLabel={t.statsLabelPercentage}
          formatValue={(value) => `${formatNumber(value)}%`}
          height={Math.max(140, metrics.smellCounts.length * 32)}
          labelWidth={160}
        />
      </ChartCard>
    </div>

    <AIReportCard
      t={t}
      lang={lang}
      scope={scopeOf(metrics)}
      kind="alerts"
      title={t.statsAIAlerts}
      description={t.statsAIAlertsDesc}
      report={reports[reportKey(metrics.turmas, 'alerts')]}
      onGenerated={onReportGenerated}
    />
  </div>
);

export default AIInsightsPanel;
