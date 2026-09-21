import React, { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Search, Target } from 'lucide-react';
import type { StatisticsMetrics } from '../../types/statistics';
import type { MasteryResult, TopicStatus } from '../../types/learning';
import { useLearning } from '../../hooks/useLearning';
import ChartCard from '../statistics/charts/ChartCard';
import BarChart from '../statistics/charts/BarChart';
import HeatmapChart from '../statistics/charts/HeatmapChart';
import StatCard from '../statistics/StatCard';
import TopicMappingSection from './TopicMappingSection';
import { VIZ, formatNumber, formatPercent } from '../statistics/charts/chartTheme';

interface ConceptsPanelProps {
  metrics: StatisticsMetrics;
  t: Record<string, string>;
}

const STATUS_COLORS: Record<TopicStatus, string> = {
  mastered: VIZ.good,
  partial: VIZ.warning,
  gap: VIZ.critical,
  insufficient: VIZ.muted
};

/** Resumo honesto do domínio: sem evidência não vira número. */
function masteryLabel(mastery: number | null, t: Record<string, string>) {
  return mastery === null ? t.learnInsufficient : formatPercent(mastery);
}

const ConceptsPanel: React.FC<ConceptsPanelProps> = ({ metrics, t }) => {
  const learning = useLearning(metrics.turmas, true);
  const [query, setQuery] = useState('');
  // O mapeamento é de uma turma por vez: questões homônimas de semestres
  // diferentes podem ter enunciados diferentes. O domínio é que combina.
  const [mappingTurma, setMappingTurma] = useState<string | null>(null);

  const mastery: MasteryResult | null = learning.mastery;
  const statusLabels: Record<TopicStatus, string> = {
    mastered: t.learnStatusMastered,
    partial: t.learnStatusPartial,
    gap: t.learnStatusGap,
    insufficient: t.learnInsufficient
  };

  const activeTurma = mappingTurma || learning.mapping?.perTurma?.[0]?.turma || metrics.turmas[0];
  const turmaMapping = useMemo(
    () => learning.mapping?.perTurma.find(item => item.turma === activeTurma) || null,
    [learning.mapping, activeTurma]
  );
  const questions = useMemo(
    () => (turmaMapping?.questions
      || metrics.questions.map(q => ({ key: q.key, name: q.name, section: q.section }))),
    [turmaMapping, metrics.questions]
  );

  const filteredStudents = useMemo(() => {
    const rows = mastery?.students || [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter(student => [student.name, student.email]
      .filter(Boolean)
      .some(field => String(field).toLowerCase().includes(normalized)));
  }, [mastery?.students, query]);

  const topics = mastery?.topics || [];
  // Conceito sem evidência não entra nos gráficos: plotar 0% afirmaria que
  // a turma foi mal, quando o que houve foi ausência de medida.
  const topicsWithEvidence = topics.filter(topic => topic.avgMastery !== null);
  const topicsWithoutEvidence = topics.filter(topic => topic.avgMastery === null);
  const hasEvidence = topicsWithEvidence.length > 0;

  // A célula codifica a LACUNA (100 − domínio), não o domínio: a rampa
  // sequencial destaca o passo mais escuro, e a tinta tem de marcar o problema.
  const matrixValues = filteredStudents.map(student =>
    topics.map(topic => {
      const result = student.topics[topic.code];
      return result?.mastery === null || result?.mastery === undefined ? null : 100 - result.mastery;
    })
  );
  const matrixMarkers = filteredStudents.map(student =>
    topics.map(topic => Boolean(student.topics[topic.code]?.untried))
  );

  const totalUntried = topics.reduce((acc, topic) => acc + topic.untriedCount, 0);
  const gapCount = topics.reduce((acc, topic) => acc + topic.distribution.gap, 0);
  const weakestTopic = [...topics]
    .filter(topic => topic.avgMastery !== null)
    .sort((a, b) => (a.avgMastery ?? 100) - (b.avgMastery ?? 100))[0];

  if (learning.loading && !mastery) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 size={36} className="animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {learning.error && (
        <div className="rounded-xl border p-4 text-center" style={{ borderColor: VIZ.critical }}>
          <p className="text-sm font-bold" style={{ color: VIZ.critical }}>{learning.error}</p>
        </div>
      )}

      {/* Taxonomias diferentes entre as turmas selecionadas: o domínio não é
          comparável, e somar conceitos de códigos iguais definidos de formas
          distintas produziria um número que não significa nada. */}
      {mastery?.conflict && (
        <div className="rounded-xl border p-4" style={{ borderColor: VIZ.critical }}>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: VIZ.critical }}>
            <AlertTriangle size={12} /> {t.learnTaxonomyConflict}
          </div>
          <p className="text-[11px] leading-relaxed text-text-dim">{t.learnTaxonomyConflictHint}</p>
          <ul className="mt-2 space-y-0.5 text-[11px] text-text-dim">
            {mastery.conflict.map(item => (
              <li key={item.turma}>• {item.turma} → <span className="font-mono">{item.taxonomyId}</span></li>
            ))}
          </ul>
        </div>
      )}

      {(mastery?.unboundTurmas?.length ?? 0) > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: VIZ.warning }}>
          <p className="text-[11px] leading-tight text-text-dim">
            {t.learnUnboundTurmas.replace('{turmas}', (mastery!.unboundTurmas || []).join(', '))}
          </p>
        </div>
      )}

      {metrics.turmas.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">{t.learnMappingOf}</span>
          {metrics.turmas.map(item => (
            <button
              key={item}
              onClick={() => setMappingTurma(item)}
              className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeTurma === item
                  ? 'border-accent bg-accent text-black'
                  : 'border-border-main bg-button text-text-dim hover:border-accent/50 hover:text-accent'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      <TopicMappingSection
        t={t}
        taxonomies={learning.taxonomies}
        mapping={turmaMapping}
        turmaCount={metrics.turmas.length}
        suggestion={learning.suggestion}
        suggesting={learning.suggesting}
        questions={questions}
        onBind={learning.bindTaxonomy}
        onSave={(next, reviewed) => learning.saveMapping(activeTurma, next, reviewed)}
        onSuggest={() => learning.requestSuggestion(activeTurma)}
        onDismissSuggestion={() => learning.setSuggestion(null)}
      />

      {mastery?.bound && (
        <>
          {mastery.coverage && mastery.coverage.unmappedQuestions.length > 0 && (
            <div className="rounded-xl border p-4" style={{ borderColor: VIZ.warning }}>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: VIZ.warning }}>
                <AlertTriangle size={12} /> {t.learnUnmappedTitle}
              </div>
              <p className="text-[11px] leading-tight text-text-dim">
                {t.learnUnmappedDesc.replace(
                  '{questions}',
                  mastery.coverage.unmappedQuestions.map(q => q.name).join(', ')
                )}
              </p>
            </div>
          )}

          {!hasEvidence ? (
            <div className="rounded-xl border border-dashed border-border-main p-10 text-center">
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-dim">{t.learnNoEvidenceYet}</p>
              <p className="mt-2 text-[11px] text-text-dim">{t.learnNoEvidenceYetHint}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label={t.learnKpiTopics}
                  value={`${topicsWithEvidence.length}/${topics.length}`}
                  hint={t.learnKpiTopicsHint.replace('{mapped}', String(mastery.coverage?.mappedQuestions ?? 0)).replace('{total}', String(mastery.coverage?.totalQuestions ?? 0))}
                  icon={Target}
                  emphasis
                />
                <StatCard
                  label={t.learnKpiWeakest}
                  value={weakestTopic ? weakestTopic.code : '—'}
                  hint={weakestTopic ? `${weakestTopic.name} · ${formatPercent(weakestTopic.avgMastery)}` : undefined}
                  tone={weakestTopic && (weakestTopic.avgMastery ?? 100) < (mastery.thresholds?.partial ?? 60) ? VIZ.critical : undefined}
                />
                <StatCard
                  label={t.learnKpiGaps}
                  value={formatNumber(gapCount)}
                  hint={t.learnKpiGapsHint}
                  tone={gapCount > 0 ? VIZ.critical : VIZ.good}
                />
                <StatCard
                  label={t.learnKpiUntried}
                  value={formatNumber(totalUntried)}
                  hint={t.learnKpiUntriedHint}
                  tone={totalUntried > 0 ? VIZ.warning : undefined}
                />
              </div>

              <ChartCard
                title={t.learnChartByTopic}
                subtitle={t.learnChartByTopicSub}
                isEmpty={topicsWithEvidence.length === 0}
                footer={topicsWithoutEvidence.length > 0
                  ? t.learnTopicsWithoutEvidence.replace('{topics}', topicsWithoutEvidence.map(topic => topic.code).join(', '))
                  : undefined}
              >
                <BarChart
                  orientation="horizontal"
                  data={topicsWithEvidence.map(topic => ({
                    label: `${topic.code} ${topic.name}`,
                    value: topic.avgMastery ?? 0,
                    color: topic.avgMastery === null
                      ? VIZ.muted
                      : topic.avgMastery >= 80 ? VIZ.good
                        : topic.avgMastery >= (mastery.thresholds?.partial ?? 60) ? VIZ.warning
                          : VIZ.critical,
                    detail: [
                      { label: t.learnDetailQuestions, value: String(topic.questionCount) },
                      { label: t.learnDetailStudents, value: `${topic.studentsWithEvidence}/${topic.totalStudents}` },
                      { label: t.learnStatusGap, value: String(topic.distribution.gap) },
                      { label: t.learnInsufficient, value: String(topic.distribution.insufficient) },
                      { label: t.learnDetailUntried, value: `${topic.untriedCount} (${formatPercent(topic.untriedRate)})` }
                    ]
                  }))}
                  max={100}
                  valueLabel={t.learnDetailMastery}
                  formatValue={(value) => `${formatNumber(value)}%`}
                  height={Math.max(140, topicsWithEvidence.length * 32)}
                  labelWidth={230}
                />
              </ChartCard>

              <ChartCard
                title={t.learnTableTitle}
                subtitle={t.learnTableSub}
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead className="border-b border-border-main text-[10px] font-black uppercase tracking-widest text-text-dim">
                      <tr>
                        <th className="py-2">{t.learnTopicsColumn}</th>
                        <th className="py-2 text-right">{t.learnDetailQuestions}</th>
                        <th className="py-2 pr-6 text-right">{t.learnDetailMastery}</th>
                        <th className="py-2">{t.learnDistribution}</th>
                        <th className="py-2 text-right">{t.learnDetailUntried}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-main/50">
                      {topics.map(topic => (
                        <tr key={topic.code}>
                          <td className="py-2">
                            <span className="font-mono font-bold text-accent">{topic.code}</span>
                            <span className="ml-2 text-text-main">{topic.name}</span>
                            {topic.codeSignals.length === 0 && (
                              <span className="ml-2 text-[9px] uppercase tracking-widest text-text-dim">
                                {t.learnNoCodeSignalShort}
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-right tabular-nums text-text-dim">{topic.questionCount}</td>
                          <td className="py-2 pr-6 text-right font-black tabular-nums text-text-bright">
                            {masteryLabel(topic.avgMastery, t)}
                          </td>
                          <td className="py-2">
                            <div className="flex h-2 w-40 overflow-hidden rounded-full" style={{ background: 'var(--viz-grid)' }}>
                              {(['mastered', 'partial', 'gap', 'insufficient'] as TopicStatus[]).map(status => {
                                const count = topic.distribution[status];
                                if (!count) return null;
                                return (
                                  <span
                                    key={status}
                                    title={`${statusLabels[status]}: ${count}`}
                                    style={{ width: `${(count / topic.totalStudents) * 100}%`, background: STATUS_COLORS[status] }}
                                  />
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-2 text-right tabular-nums text-text-dim">
                            {topic.codeSignals.length ? topic.untriedCount : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>

              <ChartCard
                title={t.learnMatrixTitle}
                subtitle={t.learnMatrixSub}
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
                isEmpty={filteredStudents.length === 0 || topics.length === 0}
                emptyLabel={t.statsStudentNoResults}
              >
                <HeatmapChart
                  values={matrixValues}
                  markers={matrixMarkers}
                  markerLabel={t.learnUntriedMarker}
                  rowLabels={filteredStudents.map(student => student.name)}
                  colLabels={topics.map(topic => topic.code)}
                  colLabelEvery={1}
                  rowWidth={170}
                  valueLabel={t.learnGap}
                  formatValue={(value) => `${formatNumber(value)}%`}
                  missingLabel={t.learnInsufficient}
                  scaleLabels={[t.learnGapNone, t.learnGapTotal]}
                  maxValue={100}
                />
              </ChartCard>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ConceptsPanel;
