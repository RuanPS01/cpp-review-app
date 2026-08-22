import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, Clock, Code2, FileCode, Loader2, Search, Send, TrendingUp, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { AIReport, RiskLevel, StatisticsMetrics, StudentMetrics, SubmissionCode } from '../../types/statistics';
import { reportKey, scopeOf, statisticsApi } from '../../services/statistics';
import ChartCard from './charts/ChartCard';
import BarChart from './charts/BarChart';
import StatCard from './StatCard';
import RiskBadge from './RiskBadge';
import AIReportCard from './AIReportCard';
import { RISK_COLORS, VIZ, formatDateTime, formatNumber, formatPercent } from './charts/chartTheme';

interface StudentsPanelProps {
  metrics: StatisticsMetrics;
  reports: Record<string, AIReport>;
  onReportGenerated: (report: AIReport) => void;
  t: Record<string, string>;
  lang: string;
  /** Aluno pré-selecionado ao navegar a partir da aba de alertas. */
  initialStudentId?: string | null;
}

type SortKey = 'risk' | 'name' | 'grade' | 'submissions';

const RISK_ORDER: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const StudentsPanel: React.FC<StudentsPanelProps> = ({
  metrics, reports, onReportGenerated, t, lang, initialStudentId
}) => {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('risk');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(initialStudentId ?? null);
  const [code, setCode] = useState<{ question: string; data: SubmissionCode } | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);

  const riskLabels: Record<RiskLevel, string> = {
    critical: t.statsRiskCritical,
    high: t.statsRiskHigh,
    medium: t.statsRiskMedium,
    low: t.statsRiskLow
  };

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const list = metrics.students.filter(student => {
      if (riskFilter !== 'all' && student.risk.level !== riskFilter) return false;
      if (!normalized) return true;
      return [student.name, student.email, student.username, student.folderName]
        .filter(Boolean)
        .some(field => String(field).toLowerCase().includes(normalized));
    });

    return list.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'grade') return (b.avgPercent ?? -1) - (a.avgPercent ?? -1);
      if (sortKey === 'submissions') return b.submittedCount - a.submittedCount;
      return RISK_ORDER[a.risk.level] - RISK_ORDER[b.risk.level] || b.risk.score - a.risk.score;
    });
  }, [metrics.students, query, sortKey, riskFilter]);

  const selected = metrics.students.find(
    student => String(student.userId ?? student.folderName) === String(selectedId)
  );

  const openCode = async (student: StudentMetrics, questionKey: string, questionName: string) => {
    setLoadingCode(true);
    try {
      const response = await statisticsApi.getSubmissionCode(
        scopeOf(metrics),
        student.userId ?? student.folderName ?? '',
        questionKey
      );
      setCode({ question: questionName, data: response.data });
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setLoadingCode(false);
    }
  };

  if (selected) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setSelectedId(null); setCode(null); }}
              className="flex items-center gap-2 rounded-lg border border-border-main px-3 py-2 text-[10px] font-black uppercase tracking-widest text-text-dim transition-all hover:border-accent/50 hover:text-accent"
            >
              <ArrowLeft size={14} /> {t.back}
            </button>
            <div>
              <h3 className="text-lg font-black tracking-tight text-text-bright">{selected.name}</h3>
              <p className="text-[11px] text-text-dim">
                {selected.email || selected.username || selected.folderName}
                {metrics.combined && selected.turmas.length > 0 && (
                  <span className="ml-2 text-accent">{selected.turmas.join(' · ')}</span>
                )}
              </p>
            </div>
          </div>
          <RiskBadge level={selected.risk.level} label={riskLabels[selected.risk.level]} score={selected.risk.score} />
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label={t.statsQuestionSubmissions}
            value={`${selected.submittedCount}/${selected.questionCount}`}
            hint={formatPercent(selected.submissionRate)}
            icon={Send}
            meter={selected.submissionRate}
            emphasis
          />
          <StatCard
            label={t.statsLabelAverage}
            value={formatPercent(selected.avgPercent)}
            hint={`${t.statsChartQuestionAverage}: ${formatPercent(metrics.overview.avgPercent)}`}
            icon={TrendingUp}
            meter={selected.avgPercent}
            tone={(selected.avgPercent ?? 0) >= metrics.overview.passThreshold ? VIZ.good : VIZ.warning}
          />
          <StatCard label={t.statsLabelAttempts} value={formatNumber(selected.totalAttempts)} hint={`${t.statsKpiLate}: ${selected.lateCount}`} icon={Clock} />
          <StatCard
            label={t.statsStudentLastSubmission}
            value={formatDateTime(selected.lastSubmissionAt, lang)}
            hint={selected.lastCourseAccess ? `${t.statsStudentLastAccess}: ${formatDateTime(selected.lastCourseAccess, lang)}` : undefined}
            icon={FileCode}
          />
        </div>

        {selected.risk.reasons.length > 0 && (
          <div className="flex flex-wrap gap-2 rounded-xl border border-border-main bg-panel p-4">
            {selected.risk.reasons.map(reason => (
              <span
                key={reason.code}
                className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: RISK_COLORS[selected.risk.level], borderColor: RISK_COLORS[selected.risk.level] }}
              >
                {(t[`statsReason${reason.code.charAt(0).toUpperCase()}${reason.code.slice(1)}`] || reason.code)
                  .replace('{value}', String(reason.value ?? ''))}
              </span>
            ))}
          </div>
        )}

        <ChartCard title={t.statsChartQuestionAverage} isEmpty={selected.questions.length === 0}>
          <BarChart
            data={selected.questions.map(question => ({
              label: question.name,
              value: question.percent ?? 0,
              color: !question.submitted
                ? VIZ.critical
                : (question.percent ?? 0) >= metrics.overview.passThreshold ? VIZ.series1 : VIZ.warning,
              detail: [
                { label: t.statsLabelSubmitted, value: question.submitted ? '✓' : '✗' },
                { label: t.statsLabelAttempts, value: formatNumber(question.attempts) },
                { label: t.statsStudentLastSubmission, value: formatDateTime(question.submittedAt, lang) }
              ]
            }))}
            max={100}
            valueLabel={t.statsLabelAverage}
            formatValue={(value) => formatNumber(value)}
            height={240}
          />
        </ChartCard>

        <div className="overflow-hidden rounded-xl border border-border-main bg-panel">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border-main bg-button/30 text-[10px] font-black uppercase tracking-widest text-text-dim">
              <tr>
                <th className="px-4 py-3">{t.question}</th>
                <th className="px-4 py-3 text-center">{t.statsLabelSubmitted}</th>
                <th className="px-4 py-3 text-right">{t.score}</th>
                <th className="px-4 py-3 text-right">{t.statsLabelAttempts}</th>
                <th className="px-4 py-3">{t.statsQuestionFailedCases}</th>
                <th className="px-4 py-3 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main/50">
              {selected.questions.map(question => (
                <tr key={question.key} className="transition-colors hover:bg-white/5">
                  <td className="px-4 py-3 font-bold text-text-main">
                    {question.name}
                    {metrics.combined && (
                      <div className="text-[9px] font-black uppercase tracking-widest text-text-dim">{question.turma}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="text-[10px] font-black uppercase tracking-widest"
                      style={{ color: question.submitted ? (question.late ? VIZ.warning : VIZ.good) : VIZ.critical }}
                    >
                      {question.submitted ? (question.late ? t.statsLabelLate : t.statsLabelOnTime) : t.statsLabelMissing}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-black tabular-nums text-text-bright">{formatPercent(question.percent)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-dim">{formatNumber(question.attempts)}</td>
                  <td className="px-4 py-3 text-text-dim">
                    {question.failedCases.length ? question.failedCases.slice(0, 3).join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {question.hasCode && (
                      <button
                        onClick={() => openCode(selected, question.key, question.name)}
                        className="inline-flex items-center gap-2 rounded-lg border border-border-main px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-text-dim transition-all hover:border-accent/50 hover:text-accent"
                      >
                        <Code2 size={12} /> {t.statsViewCode}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loadingCode && (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-accent" /></div>
        )}

        {code && (
          <section className="rounded-xl border border-border-main bg-panel p-5">
            <header className="mb-4 flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-widest text-text-bright">
                {t.statsCodeOf.replace('{question}', code.question)}
              </h4>
              <button onClick={() => setCode(null)} className="p-1 text-text-dim transition-colors hover:text-accent">
                <X size={16} />
              </button>
            </header>

            {code.data.codeMetrics && (
              <div className="mb-4 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-text-dim">
                <span>{t.statsStudentCodeLines}: {code.data.codeMetrics.codeLines}</span>
                <span>{t.statsCodeMetrics}: {code.data.codeMetrics.functionCount} func · {code.data.codeMetrics.maxNestingDepth} nest</span>
                <span>{code.data.codeMetrics.includes.join(', ') || '—'}</span>
              </div>
            )}

            {code.data.code ? (
              <pre className="max-h-[420px] overflow-auto rounded-lg border border-border-main bg-app p-4 font-mono text-[11px] leading-relaxed text-text-main">
                {code.data.code}
              </pre>
            ) : (
              <p className="rounded-lg border border-dashed border-border-main p-6 text-center text-[11px] uppercase tracking-widest text-text-dim">
                {t.statsNoCode}
              </p>
            )}

            {code.data.evaluation && (
              <div className="mt-4">
                <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">{t.statsEvaluationOutput}</div>
                <pre className="max-h-[220px] overflow-auto rounded-lg border border-border-main bg-app p-4 font-mono text-[11px] text-text-dim">
                  {code.data.evaluation}
                </pre>
              </div>
            )}
          </section>
        )}

        <AIReportCard
          t={t}
          lang={lang}
          scope={scopeOf(metrics)}
          kind="student"
          targetId={String(selected.userId ?? '')}
          title={`${t.statsAIStudent} — ${selected.name}`}
          description={t.statsAIStudentDesc}
          report={reports[reportKey(metrics.turmas, 'student', String(selected.userId ?? ''))]}
          onGenerated={onReportGenerated}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-3 text-text-dim" size={16} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.statsSearchStudent}
            className="w-full rounded-lg border border-border-main bg-input py-2.5 pl-10 pr-4 text-sm text-text-main shadow-inner transition-all focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-text-dim">{t.statsFilterRisk}</span>
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map(level => (
            <button
              key={level}
              onClick={() => setRiskFilter(level)}
              className={`rounded-lg border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                riskFilter === level ? 'border-accent bg-accent text-black' : 'border-border-main text-text-dim hover:border-accent/50 hover:text-accent'
              }`}
            >
              {level === 'all' ? t.statsFilterAll : riskLabels[level]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-text-dim">{t.statsSortBy}</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="cursor-pointer rounded-lg border border-border-main bg-button px-3 py-1.5 text-[10px] font-bold text-text-dim transition-all hover:border-accent/50 hover:text-accent focus:outline-none"
          >
            <option value="risk">{t.statsSortRisk}</option>
            <option value="name">{t.statsSortName}</option>
            <option value="grade">{t.statsSortGrade}</option>
            <option value="submissions">{t.statsSortSubmissions}</option>
          </select>
        </div>
      </div>

      <p className="text-[10px] font-black uppercase tracking-widest text-text-dim">
        {t.statsStudentsFound.replace('{count}', String(filtered.length))}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-main p-10 text-center text-[11px] font-bold uppercase tracking-widest text-text-dim">
          {t.statsStudentNoResults}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-main bg-panel">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="border-b border-border-main bg-button/30 text-[10px] font-black uppercase tracking-widest text-text-dim">
              <tr>
                <th className="px-4 py-3">{t.studentName}</th>
                {metrics.combined && <th className="px-4 py-3">{t.statsColumnTurma}</th>}
                <th className="px-4 py-3 text-center">{t.statsQuestionSubmissions}</th>
                <th className="px-4 py-3 text-right">{t.statsLabelAverage}</th>
                <th className="px-4 py-3 text-right">{t.statsLabelAttempts}</th>
                <th className="px-4 py-3 text-right">{t.statsKpiLate}</th>
                <th className="px-4 py-3">{t.statsStudentLastSubmission}</th>
                <th className="px-4 py-3 text-right">{t.statsFilterRisk}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main/50">
              {filtered.map(student => (
                <tr
                  key={String(student.userId ?? student.folderName)}
                  onClick={() => setSelectedId(String(student.userId ?? student.folderName))}
                  className="cursor-pointer transition-colors hover:bg-white/5"
                >
                  <td className="px-4 py-3">
                    <div className="font-bold text-text-main">{student.name}</div>
                    <div className="text-[10px] text-text-dim">{student.email || student.username || '—'}</div>
                  </td>
                  {metrics.combined && (
                    <td className="px-4 py-3 text-[10px] text-text-dim">{student.turmas.join(' · ')}</td>
                  )}
                  <td className="px-4 py-3 text-center">
                    <span className="tabular-nums text-text-main">{student.submittedCount}/{student.questionCount}</span>
                    <div className="mx-auto mt-1 h-1 w-16 overflow-hidden rounded-full" style={{ background: 'var(--viz-grid)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${student.submissionRate}%`,
                          background: student.submissionRate >= 100 ? VIZ.good : student.submissionRate > 0 ? VIZ.warning : VIZ.critical
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-black tabular-nums text-text-bright">{formatPercent(student.avgPercent)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-dim">{formatNumber(student.totalAttempts)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-dim">{student.lateCount}</td>
                  <td className="px-4 py-3 text-text-dim">{formatDateTime(student.lastSubmissionAt, lang)}</td>
                  <td className="px-4 py-3 text-right">
                    <RiskBadge level={student.risk.level} label={riskLabels[student.risk.level]} score={student.risk.score} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StudentsPanel;
