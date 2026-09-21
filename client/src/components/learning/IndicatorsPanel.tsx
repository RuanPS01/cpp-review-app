import React, { useMemo, useState } from 'react';
import { ChevronLeft, Info, Loader2, Search } from 'lucide-react';
import type { StatisticsMetrics } from '../../types/statistics';
import type { DimensionKey, Indicator } from '../../types/learning';
import { useLearningInsights } from '../../hooks/useLearningInsights';
import ChartCard from '../statistics/charts/ChartCard';
import LineChart from '../statistics/charts/LineChart';
import LearningSourcesBar from './LearningSourcesBar';
import { VIZ, formatNumber, formatPercent } from '../statistics/charts/chartTheme';

interface IndicatorsPanelProps {
  metrics: StatisticsMetrics;
  t: Record<string, string>;
  lang: string;
}

/** Como cada indicador cru é escrito na tela — a unidade muda o significado. */
type Unit = 'percent' | 'days' | 'hours' | 'count' | 'points';

const UNITS: Record<string, Unit> = {
  activeDays: 'count',
  eventsPerWeek: 'count',
  activitiesViewed: 'count',
  submissionRate: 'percent',
  medianGapDays: 'days',
  longestSilenceDays: 'days',
  activeWeeksRatio: 'percent',
  attemptsToFirstPass: 'count',
  gainFirstToLast: 'points',
  recoveryRate: 'percent',
  stalledCount: 'count',
  avgMastery: 'percent',
  gapTopics: 'count',
  firstAttemptPassRate: 'percent',
  medianLeadHours: 'hours',
  lastMinuteRate: 'percent',
  distributedPractice: 'percent'
};

const DIMENSION_ORDER: DimensionKey[] = ['engagement', 'regularity', 'persistence', 'learning', 'selfRegulation'];

function formatIndicator(key: string, indicator: Indicator, t: Record<string, string>): string {
  if (!indicator.available || indicator.value === null) {
    return t[`learnReason_${indicator.reason}`] || t.learnUnavailable;
  }
  const value = indicator.value;
  switch (UNITS[key]) {
    case 'percent': return formatPercent(value);
    case 'days': return t.learnUnitDays.replace('{value}', formatNumber(value, value % 1 ? 1 : 0));
    case 'hours': return t.learnUnitHours.replace('{value}', formatNumber(value, value % 1 ? 1 : 0));
    case 'points': return `${value > 0 ? '+' : ''}${formatNumber(value, 1)} p.p.`;
    default: return formatNumber(value, value % 1 ? 1 : 0);
  }
}

/**
 * Barra de posição relativa.
 *
 * Cor única de propósito. Verde/âmbar/vermelho sobre um percentil pintaria o
 * aluno mediano de "atenção" e criaria um penhasco entre o 34 e o 32, quando o
 * que a barra mostra é ordenação dentro da turma, não aprovação. O comprimento
 * já carrega a posição; o semáforo só acrescentaria um veredito que o número
 * não sustenta.
 */
const ScoreBar: React.FC<{ score: { value: number | null; available: boolean }; label: string }> = ({ score, label }) => {
  if (!score.available || score.value === null) {
    return <span className="text-[10px] uppercase tracking-widest text-text-dim">—</span>;
  }
  return (
    <div className="flex items-center gap-2" title={`${label}: ${formatNumber(score.value)}`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full" style={{ background: VIZ.grid }}>
        <div className="h-full rounded-full" style={{ width: `${score.value}%`, background: VIZ.series1 }} />
      </div>
      <span className="w-7 text-right text-[10px] font-black tabular-nums text-text-main">{formatNumber(score.value)}</span>
    </div>
  );
};

const IndicatorsPanel: React.FC<IndicatorsPanelProps> = ({ metrics, t, lang }) => {
  const insights = useLearningInsights(metrics.turmas);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [curveKey, setCurveKey] = useState<string | null>(null);

  const indicators = insights.indicators;

  // Empilhado por turma: os indicadores de cada uma são calculados dentro do
  // período dela, e o percentil é posição entre os colegas da própria turma.
  // Uma linha por aluno **por turma** — quem repetiu a disciplina aparece duas
  // vezes, que é o que aconteceu.
  const students = useMemo(
    () => (indicators?.byTurma || []).flatMap(entry =>
      (entry.students || []).map(student => ({ ...student, turma: entry.turma }))),
    [indicators]
  );

  const dimensionLabels: Record<DimensionKey, string> = {
    engagement: t.learnDimEngagement,
    regularity: t.learnDimRegularity,
    persistence: t.learnDimPersistence,
    learning: t.learnDimLearning,
    selfRegulation: t.learnDimSelfRegulation
  };

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return students;
    return students.filter(student => [student.name, student.email]
      .filter(Boolean)
      .some(field => String(field).toLowerCase().includes(normalized)));
  }, [students, query]);

  const selected = useMemo(
    () => students.find(student => `${student.turma}::${student.userId ?? student.folderName}` === selectedId) || null,
    [students, selectedId]
  );

  // Mediana por número de tentativa — da **própria turma** do aluno aberto, não
  // da seleção inteira: comparar um aluno de 2025/2 com a mediana de três
  // semestres misturados compararia coisas diferentes.
  const classCurve = useMemo(() => {
    const columns: number[][] = [];
    const cohort = selected ? students.filter(item => item.turma === selected.turma) : students;
    cohort.forEach(student => student.trajectories.forEach(path => {
      path.percents.forEach((percent, index) => {
        if (!columns[index]) columns[index] = [];
        columns[index].push(percent);
      });
    }));
    return columns.map(values => {
      const sorted = [...values].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    });
  }, [students, selected]);

  const curve = useMemo(() => {
    if (!selected?.trajectories.length) return null;
    return selected.trajectories.find(path => path.key === curveKey) || selected.trajectories[0];
  }, [selected, curveKey]);

  if (insights.loading && !indicators) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 size={36} className="animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {insights.error && (
        <div className="rounded-xl border p-4 text-center" style={{ borderColor: VIZ.critical }}>
          <p className="text-sm font-bold" style={{ color: VIZ.critical }}>{insights.error}</p>
        </div>
      )}

      <LearningSourcesBar
        t={t}
        lang={lang}
        sources={indicators?.sources || null}
        sourcesPartial={indicators?.sourcesPartial || null}
        perTurma={insights.activity?.perTurma || []}
        collecting={insights.collecting}
        progress={insights.progress}
        onCollect={() => insights.collectLogs({ noOrigin: t.learnNoOrigin, noSession: t.cookieInstructions })}
      />

      {!selected ? (
        <ChartCard
          title={t.learnIndicatorsTitle}
          subtitle={t.learnIndicatorsSub}
          action={(
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-text-dim" size={14} />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.statsSearchStudent}
                className="w-56 rounded-lg border border-border-main bg-input py-2 pl-9 pr-3 text-[11px] text-text-main focus:border-accent focus:outline-none"
              />
            </div>
          )}
          isEmpty={filtered.length === 0}
          emptyLabel={t.statsStudentNoResults}
          footer={t.learnRelativeNote}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-xs">
              <thead className="border-b border-border-main text-[10px] font-black uppercase tracking-widest text-text-dim">
                <tr>
                  <th className="py-2">{t.learnStudentColumn}</th>
                  {indicators && indicators.combined && <th className="py-2 pr-4">{t.learnTurmaColumn}</th>}
                  {DIMENSION_ORDER.map(dimension => (
                    <th key={dimension} className="py-2">{dimensionLabels[dimension]}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main/50">
                {filtered.map(student => (
                  <tr
                    key={`${student.turma}::${student.userId ?? student.folderName}`}
                    onClick={() => {
                      setSelectedId(`${student.turma}::${student.userId ?? student.folderName}`);
                      setCurveKey(null);
                    }}
                    className="cursor-pointer transition-colors hover:bg-button"
                  >
                    <td className="py-2 pr-4 font-bold text-text-main">{student.name}</td>
                    {indicators && indicators.combined && (
                      <td className="py-2 pr-4 text-[10px] text-text-dim">{student.turma}</td>
                    )}
                    {DIMENSION_ORDER.map(dimension => (
                      <td key={dimension} className="py-2 pr-4">
                        <ScoreBar score={student.scores[dimension]} label={dimensionLabels[dimension]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-dim transition-colors hover:text-accent"
          >
            <ChevronLeft size={14} /> {t.back}
          </button>

          <div className="rounded-xl border border-border-main bg-panel p-5">
            <h3 className="text-lg font-black uppercase tracking-tighter text-text-bright">{selected.name}</h3>
            <p className="text-[11px] text-text-dim">
              {selected.turma}{selected.email ? ` · ${selected.email}` : ''}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
              {DIMENSION_ORDER.map(dimension => (
                <div key={dimension} className="rounded-lg border border-border-main bg-button p-3">
                  <div className="text-[9px] font-black uppercase tracking-widest text-text-dim">{dimensionLabels[dimension]}</div>
                  <div className="mt-2">
                    <ScoreBar score={selected.scores[dimension]} label={dimensionLabels[dimension]} />
                  </div>
                  <div className="mt-1 text-[9px] uppercase tracking-widest text-text-dim">
                    {selected.scores[dimension].available
                      ? t.learnFromIndicators.replace('{n}', String(selected.scores[dimension].n))
                      : t.learnUnavailable}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-start gap-2 text-[10px] leading-tight text-text-dim">
              <Info size={11} className="mt-0.5 shrink-0" /> {t.learnRelativeNote}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {DIMENSION_ORDER.map(dimension => (
              <ChartCard key={dimension} title={dimensionLabels[dimension]} subtitle={t[`learnDimSub_${dimension}`]}>
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-border-main/50">
                    {Object.entries(selected.dimensions[dimension]).map(([key, indicator]) => (
                      <tr key={key}>
                        <td className="py-2 pr-4 text-text-main">
                          {t[`learnInd_${key}`] || key}
                          {/* Valor medido por uma fonte mais pobre: o número
                              existe, mas não é o que o rótulo promete. */}
                          {indicator.available && indicator.reason && (
                            <span className="ml-2 text-[9px] uppercase tracking-widest text-text-dim">
                              {t[`learnProxy_${indicator.reason}`] || t[`learnReason_${indicator.reason}`]}
                            </span>
                          )}
                        </td>
                        <td className={`py-2 pr-4 text-right font-black tabular-nums ${indicator.available ? 'text-text-bright' : 'text-text-dim'}`}>
                          {formatIndicator(key, indicator, t)}
                        </td>
                        <td className="w-14 py-2 text-right text-[10px] tabular-nums text-text-dim">
                          {indicator.available ? `n=${indicator.n}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ChartCard>
            ))}
          </div>

          <ChartCard
            title={t.learnCurveTitle}
            subtitle={t.learnCurveSub}
            action={selected.trajectories.length > 1 ? (
              <select
                value={curve?.key || ''}
                onChange={(event) => setCurveKey(event.target.value)}
                className="cursor-pointer rounded-lg border border-border-main bg-button px-3 py-2 text-[11px] font-bold text-text-main focus:border-accent focus:outline-none"
              >
                {selected.trajectories.map(path => (
                  <option key={path.key} value={path.key}>{path.name}</option>
                ))}
              </select>
            ) : undefined}
            isEmpty={!curve}
            emptyLabel={t.learnNoTrajectory}
            footer={curve
              ? t.learnCurveFooter
                .replace('{attempts}', String(curve.attempts))
                .replace('{gain}', `${curve.gain > 0 ? '+' : ''}${formatNumber(curve.gain, 1)}`)
                .replace('{passed}', curve.passed ? t.learnPassed : t.learnNotPassed)
              : undefined}
          >
            {curve && (
              <LineChart
                data={curve.percents.map((percent, index) => ({
                  label: t.learnAttemptShort.replace('{n}', String(index + 1)),
                  value: percent
                }))}
                secondary={{
                  label: t.learnClassMedian,
                  points: classCurve.slice(0, curve.percents.length).map((value, index) => ({
                    label: t.learnAttemptShort.replace('{n}', String(index + 1)),
                    value
                  }))
                }}
                valueLabel={t.learnGradePercent}
                formatValue={(value) => `${formatNumber(value)}%`}
                height={240}
              />
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
};

export default IndicatorsPanel;
