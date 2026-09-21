import React, { useState } from 'react';
import { Award, ChevronDown, ChevronRight, Info, Loader2, ShieldAlert } from 'lucide-react';
import type { StatisticsMetrics } from '../../types/statistics';
import type { PatternCode, PatternMatch, PatternResult, PatternsResult } from '../../types/learning';
import { useLearningInsights } from '../../hooks/useLearningInsights';
import LearningSourcesBar from './LearningSourcesBar';
import { VIZ, formatNumber, formatPercent } from '../statistics/charts/chartTheme';

interface PatternsPanelProps {
  metrics: StatisticsMetrics;
  t: Record<string, string>;
  lang: string;
}

const ORDER: PatternCode[] = [
  'lowEngagementEarly',
  'irregularPlusConceptGap',
  'procrastination',
  'bruteForce',
  'recurringConceptError',
  'earlyAbandonment',
  'productivePersistence'
];

/**
 * De que fonte cada padrão depende. Sem a fonte, o cartão diz "não avaliável" —
 * e não "nenhum aluno", que afirmaria algo que não foi medido.
 */
const DEPENDS_ON: Record<PatternCode, (keyof PatternsResult['availability'])[]> = {
  lowEngagementEarly: ['period'],
  irregularPlusConceptGap: ['taxonomy'],
  procrastination: [],
  bruteForce: ['history'],
  recurringConceptError: [],
  productivePersistence: ['history'],
  earlyAbandonment: ['history']
};

/** Resume a evidência de um aluno em uma linha legível. */
function describeEvidence(code: PatternCode, evidence: Record<string, any>, t: Record<string, string>): string {
  switch (code) {
    case 'lowEngagementEarly':
      return t.learnEvidenceEarly
        .replace('{weeks}', String(evidence.weeks))
        .replace('{source}', evidence.fromLogs ? t.learnSourceLogs : t.learnEvidenceFromSubmissions);
    case 'irregularPlusConceptGap':
      return t.learnEvidenceIrregular
        .replace('{days}', formatNumber(evidence.longestSilenceDays, 1))
        .replace('{topics}', (evidence.gapTopics || []).join(', '));
    case 'procrastination':
      return t.learnEvidenceProcrastination
        .replace('{hours}', formatNumber(evidence.medianLeadHours, 1))
        .replace('{n}', String(evidence.n))
        .replace('{rate}', evidence.lastMinuteRate === null ? '—' : formatPercent(evidence.lastMinuteRate));
    case 'bruteForce':
    case 'productivePersistence':
      return (evidence.questions || [])
        .map((question: any) => t.learnEvidenceAttempts
          .replace('{name}', question.name)
          .replace('{attempts}', String(question.attempts))
          .replace('{gain}', `${question.gain > 0 ? '+' : ''}${formatNumber(question.gain, 1)}`))
        .join(' · ');
    case 'recurringConceptError':
      if (evidence.topics) {
        return (evidence.topics || [])
          .map((topic: any) => `${topic.code} (${formatPercent(topic.mastery)}, ${topic.items} ${t.learnEvidenceItems})`)
          .join(' · ');
      }
      return (evidence.repeatedCases || [])
        .map((entry: any) => `${entry.name} ×${entry.count}`)
        .join(' · ');
    case 'earlyAbandonment':
      return (evidence.questions || [])
        .map((question: any) => t.learnEvidenceAbandoned
          .replace('{name}', question.name)
          .replace('{attempts}', String(question.attempts)))
        .join(' · ');
    default:
      return '';
  }
}

const PatternCard: React.FC<{
  pattern: PatternResult;
  available: boolean;
  missing: string[];
  total: number;
  t: Record<string, string>;
}> = ({ pattern, available, missing, total, t }) => {
  const [open, setOpen] = useState(false);
  const accent = pattern.positive ? VIZ.good : pattern.count > 0 ? VIZ.warning : 'var(--border-main)';
  const Icon = pattern.positive ? Award : ShieldAlert;

  return (
    <div className="rounded-xl border bg-panel p-5" style={{ borderColor: accent }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border p-2" style={{ borderColor: accent, color: accent }}>
            <Icon size={16} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight text-text-bright">
              {t[`learnPattern_${pattern.code}`]}
            </h3>
            <p className="mt-0.5 text-[11px] text-text-dim">{t[`learnPatternRule_${pattern.code}`]}</p>
          </div>
        </div>
        <div className="text-right">
          {available ? (
            <>
              <div className="text-2xl font-black tabular-nums" style={{ color: pattern.count > 0 ? accent : 'var(--text-dim)' }}>
                {formatNumber(pattern.count)}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-text-dim">
                {formatPercent(pattern.rate)} {t.learnOfClass.replace('{total}', String(total))}
              </div>
            </>
          ) : (
            <div className="max-w-[220px] text-right text-[10px] font-bold uppercase leading-tight tracking-widest text-text-dim">
              {t.learnPatternUnavailable.replace('{sources}', missing.join(', '))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-t border-border-main pt-4 md:grid-cols-2">
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-text-dim">{t.learnInterpretation}</div>
          <p className="mt-1 text-[11px] leading-relaxed text-text-main">{t[`learnPatternMeaning_${pattern.code}`]}</p>
        </div>
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-text-dim">
            {pattern.positive ? t.learnRecognition : t.learnIntervention}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-text-main">{t[`learnPatternAction_${pattern.code}`]}</p>
        </div>
      </div>

      {available && pattern.count > 0 && (
        <>
          <button
            onClick={() => setOpen(value => !value)}
            className="mt-4 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-text-dim transition-colors hover:text-accent"
          >
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {open
              ? t.learnHideStudents
              : pattern.count === 1
                ? t.learnShowStudentsOne
                : t.learnShowStudents.replace('{count}', String(pattern.count))}
          </button>
          {open && (
            <ul className="mt-3 space-y-2 border-t border-border-main pt-3">
              {pattern.students.map((student: PatternMatch, index: number) => (
                <li key={`${student.userId ?? student.name}-${index}`} className="text-[11px] leading-tight">
                  <span className="font-bold text-text-main">{student.name}</span>
                  <span className="ml-2 text-text-dim">{describeEvidence(pattern.code, student.evidence, t)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

const PatternsPanel: React.FC<PatternsPanelProps> = ({ metrics, t, lang }) => {
  const insights = useLearningInsights(metrics.turmas);
  const scope = insights.patterns;

  // Um seletor em vez de empilhar: os limiares de cada padrão saem da
  // distribuição da própria turma (a mediana do ganho, o quartil de silêncio),
  // então cartões de turmas diferentes não são comparáveis lado a lado — e
  // sete cartões vezes três turmas não se lê.
  const [turma, setTurma] = useState<string | null>(null);
  const current = (scope?.byTurma || []).find(entry => entry.turma === turma) || scope?.byTurma?.[0] || null;
  const patterns = current;

  if (insights.loading && !scope) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 size={36} className="animate-spin text-accent" />
      </div>
    );
  }

  const byCode = new Map((patterns?.patterns || []).map(pattern => [pattern.code, pattern]));
  const sourceLabels: Record<string, string> = {
    history: t.learnSourceHistory,
    taxonomy: t.learnSourceTaxonomy,
    logs: t.learnSourceLogs,
    period: t.learnSourcePeriod
  };

  return (
    <div className="space-y-6">
      {insights.error && (
        <div className="rounded-xl border p-4 text-center" style={{ borderColor: VIZ.critical }}>
          <p className="text-sm font-bold" style={{ color: VIZ.critical }}>{insights.error}</p>
        </div>
      )}

      {scope && scope.combined && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">{t.learnTurmaColumn}</span>
          {scope.byTurma.map(entry => (
            <button
              key={entry.turma}
              onClick={() => setTurma(entry.turma)}
              className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                current?.turma === entry.turma
                  ? 'border-accent bg-accent text-black'
                  : 'border-border-main bg-button text-text-dim hover:border-accent/50 hover:text-accent'
              }`}
            >
              {entry.turma}
            </button>
          ))}
        </div>
      )}

      <LearningSourcesBar
        t={t}
        lang={lang}
        sources={insights.indicators?.sources || null}
        sourcesPartial={insights.indicators?.sourcesPartial || null}
        perTurma={insights.activity?.perTurma || []}
        collecting={insights.collecting}
        progress={insights.progress}
        onCollect={() => insights.collectLogs({ noOrigin: t.learnNoOrigin, noSession: t.cookieInstructions })}
      />

      {patterns && (
        <div className="rounded-xl border border-border-main bg-panel p-4">
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-text-dim">
            <Info size={12} className="mt-0.5 shrink-0" />
            {t.learnThresholdsNote
              .replace('{gain}', patterns.thresholds.gainThreshold === null ? '—' : `${formatNumber(patterns.thresholds.gainThreshold, 1)} p.p.`)
              .replace('{attempts}', String(patterns.thresholds.minAttemptsForTrend))
              .replace('{hours}', String(patterns.thresholds.procrastinationHours))
              .replace('{silence}', patterns.thresholds.silenceCutDays === null ? '—' : formatNumber(patterns.thresholds.silenceCutDays, 1))}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {ORDER.map(code => {
          const pattern = byCode.get(code);
          if (!pattern) return null;
          const missing = DEPENDS_ON[code].filter(source => !patterns?.availability[source]);
          return (
            <PatternCard
              key={code}
              pattern={pattern}
              available={missing.length === 0}
              missing={missing.map(source => sourceLabels[source] || source)}
              total={patterns?.totalStudents ?? 0}
              t={t}
            />
          );
        })}
      </div>
    </div>
  );
};

export default PatternsPanel;
