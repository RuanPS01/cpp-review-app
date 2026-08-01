import React from 'react';
import type { StatisticsMetrics } from '../../types/statistics';
import ChartCard, { ChartLegend } from './charts/ChartCard';
import BarChart from './charts/BarChart';
import LineChart from './charts/LineChart';
import HeatmapChart from './charts/HeatmapChart';
import ScatterChart from './charts/ScatterChart';
import StatCard from './StatCard';
import { RISK_COLORS, VIZ, formatDateTime, formatNumber, formatPercent } from './charts/chartTheme';
import { Activity, Clock, Repeat, Users } from 'lucide-react';

interface EngagementPanelProps {
  metrics: StatisticsMetrics;
  t: Record<string, string>;
  lang: string;
}

const EngagementPanel: React.FC<EngagementPanelProps> = ({ metrics, t, lang }) => {
  const { engagement, overview, students } = metrics;
  const weekdays = t.statsWeekdaysShort.split(',');
  const hours = Array.from({ length: 24 }, (_, hour) => `${hour}h`);

  const riskLegend = [
    { label: t.statsRiskCritical, color: RISK_COLORS.critical },
    { label: t.statsRiskHigh, color: RISK_COLORS.high },
    { label: t.statsRiskMedium, color: RISK_COLORS.medium },
    { label: t.statsRiskLow, color: RISK_COLORS.low }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t.statsLabelSubmissions} value={formatNumber(engagement.totalSubmissions)} icon={Activity} emphasis />
        <StatCard
          label={t.statsKpiAttempts}
          value={formatNumber(engagement.avgAttemptsPerSubmission, 2)}
          icon={Repeat}
          hint={t.statsKpiAttemptsHint}
        />
        <StatCard
          label={t.statsKpiInactive}
          value={formatNumber(engagement.inactiveStudents)}
          icon={Users}
          tone={engagement.inactiveStudents > 0 ? VIZ.critical : VIZ.good}
          meter={overview.totalStudents ? (engagement.inactiveStudents / overview.totalStudents) * 100 : 0}
        />
        <StatCard
          label={t.statsStudentLastSubmission}
          value={engagement.lastActivityAt ? formatDateTime(engagement.lastActivityAt, lang) : '—'}
          icon={Clock}
          hint={engagement.peakHour !== null ? t.statsPeakHour.replace('{hour}', String(engagement.peakHour)) : undefined}
        />
      </div>

      <ChartCard
        title={t.statsChartHeatmap}
        subtitle={t.statsChartHeatmapSub}
        isEmpty={engagement.datedSubmissions === 0}
      >
        <HeatmapChart
          values={engagement.heatmap}
          rowLabels={weekdays}
          colLabels={hours}
          valueLabel={t.statsLabelSubmissions}
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          title={t.statsChartTimeline}
          isEmpty={engagement.timeline.length === 0}
        >
          <LineChart
            data={engagement.timeline.map(point => ({
              label: new Date(`${point.date}T12:00:00`).toLocaleDateString(lang, { day: '2-digit', month: '2-digit' }),
              value: point.count
            }))}
            valueLabel={t.statsLabelSubmissions}
            height={230}
          />
        </ChartCard>

        <ChartCard
          title={t.statsChartLeadTime}
          subtitle={t.statsChartLeadTimeSub}
          isEmpty={engagement.leadTimes.every(bucket => bucket.count === 0)}
        >
          <BarChart
            orientation="horizontal"
            data={engagement.leadTimes.map(bucket => ({
              label: bucket.label,
              value: bucket.count,
              color: bucket.key === 'late' ? VIZ.critical : bucket.key === 'lastHour' ? VIZ.warning : VIZ.series1
            }))}
            valueLabel={t.statsLabelSubmissions}
            height={200}
            labelWidth={110}
          />
        </ChartCard>

        <ChartCard
          title={t.statsChartAttempts}
          isEmpty={engagement.attemptsBuckets.every(bucket => bucket.count === 0)}
        >
          <BarChart
            data={engagement.attemptsBuckets.map(bucket => ({ label: bucket.label, value: bucket.count }))}
            valueLabel={t.statsLabelSubmissions}
            height={200}
          />
        </ChartCard>

        <ChartCard title={t.statsChartHourlyActivity} isEmpty={engagement.byHour.every(bucket => bucket.count === 0)}>
          <BarChart
            data={engagement.byHour.map(bucket => ({ label: `${bucket.hour}h`, value: bucket.count }))}
            valueLabel={t.statsLabelSubmissions}
            height={200}
          />
        </ChartCard>
      </div>

      <ChartCard
        title={t.statsChartEffort}
        subtitle={t.statsChartEffortSub}
        isEmpty={students.every(student => student.submittedCount === 0)}
      >
        <div className="mb-3">
          <ChartLegend items={riskLegend} />
        </div>
        <ScatterChart
          points={students
            .filter(student => student.submittedCount > 0)
            .map(student => ({
              x: student.totalAttempts,
              y: student.avgPercent ?? 0,
              label: student.name,
              color: RISK_COLORS[student.risk.level],
              detail: [
                { label: t.statsQuestionSubmissions, value: `${student.submittedCount}/${student.questionCount}` },
                { label: t.statsRiskScore, value: String(student.risk.score) }
              ]
            }))}
          xLabel={t.statsLabelAttempts}
          yLabel={t.statsLabelAverage}
          referenceY={{ value: overview.passThreshold, label: formatPercent(overview.passThreshold) }}
          height={300}
        />
      </ChartCard>
    </div>
  );
};

export default EngagementPanel;
