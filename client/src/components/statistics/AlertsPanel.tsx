import React from 'react';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import type { AIReport, RiskLevel, StatisticsMetrics } from '../../types/statistics';
import RiskBadge from './RiskBadge';
import AIReportCard from './AIReportCard';
import { RISK_COLORS, formatDateTime, formatNumber, formatPercent } from './charts/chartTheme';

interface AlertsPanelProps {
  metrics: StatisticsMetrics;
  reports: Record<string, AIReport>;
  onReportGenerated: (report: AIReport) => void;
  onOpenStudent: (studentId: string) => void;
  t: Record<string, string>;
  lang: string;
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({
  metrics, reports, onReportGenerated, onOpenStudent, t, lang
}) => {
  const riskLabels: Record<RiskLevel, string> = {
    critical: t.statsRiskCritical,
    high: t.statsRiskHigh,
    medium: t.statsRiskMedium,
    low: t.statsRiskLow
  };

  const reasonText = (code: string, value?: number) => {
    const key = `statsReason${code.charAt(0).toUpperCase()}${code.slice(1)}`;
    return (t[key] || code).replace('{value}', String(value ?? ''));
  };

  return (
    <div className="space-y-6">
      <header>
        <h3 className="text-sm font-black uppercase tracking-widest text-text-bright">{t.statsAlertsTitle}</h3>
        <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-text-dim">{t.statsAlertsSubtitle}</p>
      </header>

      {metrics.alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-main p-12 text-center">
          <ShieldCheck size={40} style={{ color: RISK_COLORS.low }} />
          <p className="text-[11px] font-black uppercase tracking-widest text-text-dim">{t.statsAlertsEmpty}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {metrics.alerts.map(student => (
            <li key={String(student.userId ?? student.folderName)}>
              <button
                onClick={() => onOpenStudent(String(student.userId ?? student.folderName))}
                className="group flex w-full flex-wrap items-center justify-between gap-4 rounded-xl border border-border-main bg-panel p-4 text-left transition-all hover:border-accent/40"
                style={{ borderLeft: `3px solid ${RISK_COLORS[student.risk.level]}` }}
              >
                <div className="min-w-[220px] flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-text-bright transition-colors group-hover:text-accent">{student.name}</span>
                    <RiskBadge level={student.risk.level} label={riskLabels[student.risk.level]} score={student.risk.score} compact />
                  </div>
                  <div className="mt-1 text-[10px] text-text-dim">{student.email || student.username || '—'}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {student.risk.reasons.map(reason => (
                      <span
                        key={reason.code}
                        className="rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                        style={{ color: RISK_COLORS[student.risk.level], borderColor: RISK_COLORS[student.risk.level] }}
                      >
                        {reasonText(reason.code, reason.value)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-6 text-right">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-text-dim">{t.statsQuestionSubmissions}</div>
                    <div className="font-black tabular-nums text-text-bright">{student.submittedCount}/{student.questionCount}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-text-dim">{t.statsLabelAverage}</div>
                    <div className="font-black tabular-nums text-text-bright">{formatPercent(student.avgPercent)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-text-dim">{t.statsLabelAttempts}</div>
                    <div className="font-black tabular-nums text-text-bright">{formatNumber(student.totalAttempts)}</div>
                  </div>
                  <div className="hidden lg:block">
                    <div className="text-[9px] font-black uppercase tracking-widest text-text-dim">{t.statsStudentLastSubmission}</div>
                    <div className="text-[11px] tabular-nums text-text-dim">{formatDateTime(student.lastSubmissionAt, lang)}</div>
                  </div>
                  <ChevronRight size={18} className="text-text-dim transition-all group-hover:text-accent" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AIReportCard
        t={t}
        lang={lang}
        turma={metrics.turma}
        kind="alerts"
        title={t.statsAIAlerts}
        description={t.statsAIAlertsDesc}
        report={reports.alerts}
        onGenerated={onReportGenerated}
      />
    </div>
  );
};

export default AlertsPanel;
