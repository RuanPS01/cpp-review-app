import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Check, ChevronDown, Layers, Loader2, Plus, Save, Sparkles, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import type {
  QuestionMapping, SuggestionResult, Taxonomy, TopicWeight
} from '../../types/learning';
import { VIZ } from '../statistics/charts/chartTheme';

interface TopicMappingSectionProps {
  t: Record<string, string>;
  taxonomies: Taxonomy[];
  mapping: { turma: string; taxonomyId: string | null; mapping: QuestionMapping } | null;
  /** Quantas turmas a seleção tem — o vínculo vale para todas elas de uma vez. */
  turmaCount?: number;
  suggestion: SuggestionResult | null;
  suggesting: boolean;
  questions: { key: string; name: string; section: string | null }[];
  onBind: (taxonomyId: string) => void;
  onSave: (mapping: QuestionMapping, reviewed?: boolean) => void;
  onSuggest: () => void;
  onDismissSuggestion: () => void;
}

const WEIGHT_NEXT: Record<string, TopicWeight> = { '1': 0.5, '0.5': 1 };

/**
 * Vínculo da taxonomia e revisão do mapeamento questão→conceito.
 *
 * A sugestão da IA nunca é gravada direto: ela aparece como proposta, com a
 * justificativa ao lado, e só entra no mapeamento quando o professor aceita.
 */
const TopicMappingSection: React.FC<TopicMappingSectionProps> = ({
  t, taxonomies, mapping, turmaCount = 1, suggestion, suggesting, questions,
  onBind, onSave, onSuggest, onDismissSuggestion
}) => {
  const [draft, setDraft] = useState<QuestionMapping | null>(null);
  const [addingFor, setAddingFor] = useState<string | null>(null);

  const taxonomy = taxonomies.find(item => item.id === mapping?.taxonomyId) || null;
  const current = draft ?? mapping?.mapping ?? {};
  const isDirty = draft !== null;

  const topicByCode = useMemo(
    () => new Map((taxonomy?.topics || []).map(topic => [topic.code, topic])),
    [taxonomy]
  );

  const mutate = (next: QuestionMapping) => setDraft(next);

  const addTopic = (questionKey: string, code: string) => {
    const entries = current[questionKey] || [];
    if (entries.some(entry => entry.code === code)) return;
    mutate({ ...current, [questionKey]: [...entries, { code, weight: entries.length === 0 ? 1 : 0.5 }] });
    setAddingFor(null);
  };

  const removeTopic = (questionKey: string, code: string) => {
    const entries = (current[questionKey] || []).filter(entry => entry.code !== code);
    const next = { ...current };
    if (entries.length) next[questionKey] = entries;
    else delete next[questionKey];
    mutate(next);
  };

  const toggleWeight = (questionKey: string, code: string) => {
    mutate({
      ...current,
      [questionKey]: (current[questionKey] || []).map(entry =>
        entry.code === code ? { ...entry, weight: WEIGHT_NEXT[String(entry.weight)] ?? 1 } : entry)
    });
  };

  const applySuggestionFor = (questionKey: string) => {
    const proposed = suggestion?.mapping?.[questionKey];
    if (!proposed?.length) return;
    const known = proposed
      .filter(entry => topicByCode.has(entry.code))
      .map(entry => ({ code: entry.code, weight: entry.weight }));
    if (!known.length) {
      toast.error(t.learnSuggestionUnknownTopic);
      return;
    }
    mutate({ ...current, [questionKey]: known });
  };

  const applyAllSuggestions = () => {
    if (!suggestion) return;
    const next = { ...current };
    let applied = 0;
    Object.entries(suggestion.mapping).forEach(([questionKey, entries]) => {
      const known = entries
        .filter(entry => topicByCode.has(entry.code))
        .map(entry => ({ code: entry.code, weight: entry.weight }));
      if (known.length) { next[questionKey] = known; applied += 1; }
    });
    mutate(next);
    toast.success(t.learnSuggestionApplied.replace('{count}', String(applied)));
  };

  const mappedCount = Object.values(current).filter(entries => entries.length > 0).length;

  return (
    <section className="space-y-4 rounded-xl border border-border-main bg-panel p-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-accent/20 bg-accent/10 p-2 text-accent">
            <Layers size={18} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-text-bright">{t.learnMappingTitle}</h3>
            <p className="mt-1 max-w-2xl text-[11px] leading-tight text-text-dim">
              {t.learnMappingDesc}
              {/* O vínculo vale para a seleção inteira; o mapeamento, não. */}
              {turmaCount > 1 && ` ${t.learnBindAppliesToAll.replace('{count}', String(turmaCount))}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={mapping?.taxonomyId || ''}
            onChange={(event) => { setDraft(null); onBind(event.target.value); }}
            className="cursor-pointer rounded-lg border border-border-main bg-button px-3 py-2 text-[11px] font-bold text-text-main transition-all hover:border-accent/50 focus:border-accent focus:outline-none"
          >
            <option value="" disabled>{t.learnSelectTaxonomy}</option>
            {taxonomies.map(item => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>

          <button
            onClick={onSuggest}
            disabled={!taxonomy || suggesting}
            className="flex items-center gap-2 rounded-lg border border-border-main px-3 py-2 text-[10px] font-black uppercase tracking-widest text-text-dim transition-all hover:border-accent/50 hover:text-accent disabled:opacity-40"
          >
            {suggesting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {t.learnSuggest}
          </button>

          <button
            onClick={() => { onSave(current, true); setDraft(null); }}
            disabled={!taxonomy || !isDirty}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black shadow-lg shadow-accent/20 transition-all active:scale-95 hover:bg-accent/80 disabled:opacity-40"
          >
            <Save size={12} /> {t.save}
          </button>
        </div>
      </header>

      {!taxonomy ? (
        <div className="rounded-lg border border-dashed border-border-main p-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-dim">{t.learnNoTaxonomyBound}</p>
          <p className="mt-2 text-[11px] text-text-dim">{t.learnNoTaxonomyBoundHint}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-text-dim">
            <span>{t.learnMappedCount.replace('{done}', String(mappedCount)).replace('{total}', String(questions.length))}</span>
            {isDirty && <span style={{ color: VIZ.warning }}>{t.learnUnsaved}</span>}
          </div>

          {suggestion && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-accent">
                  <Sparkles size={12} /> {t.learnSuggestionTitle.replace('{model}', `${suggestion.provider} · ${suggestion.model}`)}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={applyAllSuggestions}
                    className="rounded-lg border border-accent px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-accent transition-all hover:bg-accent hover:text-black"
                  >
                    {t.learnApplyAll}
                  </button>
                  <button
                    onClick={onDismissSuggestion}
                    className="rounded-lg border border-border-main px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-text-dim transition-all hover:text-text-bright"
                  >
                    {t.discard}
                  </button>
                </div>
              </div>
              {suggestion.newTopics.length > 0 && (
                <p className="flex items-start gap-2 text-[11px] leading-tight text-text-dim">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" style={{ color: VIZ.warning }} />
                  {t.learnSuggestionNewTopics.replace(
                    '{topics}',
                    suggestion.newTopics.map(topic => `${topic.code} ${topic.name}`).join(', ')
                  )}
                </p>
              )}
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-border-main">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border-main bg-button/30 text-[10px] font-black uppercase tracking-widest text-text-dim">
                <tr>
                  <th className="px-4 py-3">{t.question}</th>
                  <th className="px-4 py-3">{t.learnTopicsColumn}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main/50">
                {questions.map(question => {
                  const entries = current[question.key] || [];
                  const proposed = suggestion?.mapping?.[question.key] || [];
                  const available = (taxonomy.topics || []).filter(topic => !entries.some(e => e.code === topic.code));

                  return (
                    <tr key={question.key} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-bold text-text-main">{question.name}</div>
                        <div className="text-[10px] text-text-dim">
                          {question.key.toUpperCase()}{question.section ? ` · ${question.section}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {entries.map(entry => {
                            const topic = topicByCode.get(entry.code);
                            return (
                              <span
                                key={entry.code}
                                className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 py-1 pl-2.5 pr-1.5 text-[10px] font-bold text-accent"
                              >
                                <button
                                  onClick={() => toggleWeight(question.key, entry.code)}
                                  title={t.learnToggleWeight}
                                  className="uppercase tracking-widest"
                                >
                                  {entry.code} · {entry.weight === 1 ? t.learnWeightPrimary : t.learnWeightSecondary}
                                </button>
                                <span className="text-text-dim">{topic?.name}</span>
                                <button onClick={() => removeTopic(question.key, entry.code)} className="hover:text-red-500">
                                  <X size={11} />
                                </button>
                              </span>
                            );
                          })}

                          {addingFor === question.key ? (
                            <select
                              autoFocus
                              value=""
                              onChange={(event) => addTopic(question.key, event.target.value)}
                              onBlur={() => setAddingFor(null)}
                              className="rounded border border-accent bg-input px-2 py-1 text-[10px] text-text-main focus:outline-none"
                            >
                              <option value="" disabled>{t.learnSelectTopic}</option>
                              {available.map(topic => (
                                <option key={topic.code} value={topic.code}>{topic.code} — {topic.name}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              onClick={() => setAddingFor(question.key)}
                              disabled={available.length === 0}
                              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-main px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-text-dim transition-all hover:border-accent/50 hover:text-accent disabled:opacity-30"
                            >
                              <Plus size={10} /> {t.learnAddTopic}
                            </button>
                          )}
                        </div>

                        {proposed.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-start gap-2 rounded-lg border border-dashed border-accent/40 p-2">
                            <button
                              onClick={() => applySuggestionFor(question.key)}
                              className="inline-flex shrink-0 items-center gap-1 rounded border border-accent px-2 py-1 text-[9px] font-black uppercase tracking-widest text-accent transition-all hover:bg-accent hover:text-black"
                            >
                              <Check size={10} /> {t.learnApply}
                            </button>
                            <div className="flex-1 space-y-1">
                              {proposed.map(entry => (
                                <div key={entry.code} className="text-[10px] leading-tight">
                                  <span className="font-bold text-accent">
                                    {entry.code} · {entry.weight === 1 ? t.learnWeightPrimary : t.learnWeightSecondary}
                                  </span>
                                  {entry.rationale && <span className="text-text-dim"> — {entry.rationale}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <details className="rounded-lg border border-border-main">
            <summary className="flex cursor-pointer items-center gap-2 p-3 text-[10px] font-black uppercase tracking-widest text-text-dim">
              <ChevronDown size={12} /> {t.learnTopicListTitle.replace('{count}', String(taxonomy.topics.length))}
            </summary>
            <ul className="space-y-1 border-t border-border-main p-3 text-[11px]">
              {taxonomy.topics.map(topic => (
                <li key={topic.code} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-accent">{topic.code}</span>
                  <span className="text-text-main">{topic.name}</span>
                  {topic.codeSignals.length > 0 ? (
                    <span className="text-[10px] text-text-dim">· {t.learnCodeSignal}: {topic.codeSignals.join(', ')}</span>
                  ) : (
                    <span className="text-[10px] italic text-text-dim">· {t.learnNoCodeSignal}</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
};

export default TopicMappingSection;
