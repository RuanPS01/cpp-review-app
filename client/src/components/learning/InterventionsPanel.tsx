import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Info, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { StatisticsMetrics } from '../../types/statistics';
import type { Intervention, InterventionAction, InterventionsState } from '../../types/learning';
import { learningApi } from '../../services/learning';
import ChartCard from '../statistics/charts/ChartCard';
import SocraticPackageModal from './SocraticPackageModal';
import { VIZ, formatDate, formatNumber } from '../statistics/charts/chartTheme';

interface InterventionsPanelProps {
  metrics: StatisticsMetrics;
  t: Record<string, string>;
  lang: string;
}

const ACTIONS: InterventionAction[] = [
  'socraticPackage', 'individualContact', 'studyPlan', 'reviewSession', 'other'
];

const InterventionsPanel: React.FC<InterventionsPanelProps> = ({ metrics, t, lang }) => {
  const [state, setState] = useState<InterventionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [socraticFor, setSocraticFor] = useState<{ userId: number; name: string } | null>(null);
  const [draft, setDraft] = useState({ userId: '', action: 'individualContact' as InterventionAction, note: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await learningApi.getInterventions(metrics.turma);
      setState(response.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [metrics.turma]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!draft.userId) return;
    setAdding(true);
    try {
      const student = metrics.students.find(item => String(item.userId) === draft.userId);
      await learningApi.addIntervention(metrics.turma, {
        userId: Number(draft.userId),
        name: student?.name || null,
        action: draft.action,
        note: draft.note
      } as Partial<Intervention>);
      setDraft({ userId: '', action: 'individualContact', note: '' });
      await load();
      toast.success(t.intSaved);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await learningApi.deleteIntervention(metrics.turma, id);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const changeStatus = async (id: string, status: string) => {
    try {
      await learningApi.updateIntervention(metrics.turma, id, { status });
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const sortedStudents = useMemo(
    () => [...metrics.students].sort((a, b) => a.name.localeCompare(b.name)),
    [metrics.students]
  );

  if (loading && !state) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 size={36} className="animate-spin text-accent" />
      </div>
    );
  }

  const followup = state?.followup;

  return (
    <div className="space-y-6">
      {/* --- Registrar ----------------------------------------------------- */}
      <div className="rounded-xl border border-border-main bg-panel p-5">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-text-dim">{t.intNewTitle}</h3>
        <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-text-dim">{t.intNewHint}</p>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_auto]">
          <select
            value={draft.userId}
            onChange={(event) => setDraft({ ...draft, userId: event.target.value })}
            className="cursor-pointer rounded-lg border border-border-main bg-input px-3 py-2 text-[11px] text-text-main focus:border-accent focus:outline-none"
          >
            <option value="">{t.intChooseStudent}</option>
            {sortedStudents.map(student => (
              <option key={String(student.userId)} value={String(student.userId)}>{student.name}</option>
            ))}
          </select>

          <select
            value={draft.action}
            onChange={(event) => setDraft({ ...draft, action: event.target.value as InterventionAction })}
            className="cursor-pointer rounded-lg border border-border-main bg-input px-3 py-2 text-[11px] text-text-main focus:border-accent focus:outline-none"
          >
            {ACTIONS.map(action => (
              <option key={action} value={action}>{t[`intAction_${action}`]}</option>
            ))}
          </select>

          <input
            type="text"
            value={draft.note}
            onChange={(event) => setDraft({ ...draft, note: event.target.value })}
            placeholder={t.intNotePlaceholder}
            className="rounded-lg border border-border-main bg-input px-3 py-2 text-[11px] text-text-main focus:border-accent focus:outline-none"
          />

          <button
            onClick={submit}
            disabled={adding || !draft.userId}
            className="flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2 text-[10px] font-black uppercase tracking-widest text-black transition-all active:scale-95 hover:bg-accent/80 disabled:opacity-50"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {t.intRegister}
          </button>
        </div>
      </div>

      {/* --- Acompanhamento ------------------------------------------------ */}
      {(followup?.groups.length ?? 0) > 0 && (
        <ChartCard title={t.intFollowupTitle} subtitle={t.intFollowupSub}>
          <p className="mb-4 flex items-start gap-2 rounded-lg border p-3 text-[11px] leading-relaxed text-text-dim" style={{ borderColor: VIZ.warning }}>
            <AlertTriangle size={12} className="mt-0.5 shrink-0" style={{ color: VIZ.warning }} />
            {t.intRegressionWarning}
          </p>

          <div className="space-y-4">
            {followup!.groups.map(group => (
              <div key={group.snapshotId} className="rounded-lg border border-border-main p-4">
                <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-text-dim">
                  {t.intBaselineOf.replace('{date}', formatDate(group.snapshotAt, lang))}
                </div>

                {group.stale ? (
                  <p className="text-[11px] text-text-dim">{t.intSameImport}</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([
                      { key: 'treated', label: t.intTreated, data: group.treated },
                      { key: 'comparison', label: t.intComparison, data: group.comparison }
                    ]).map(item => (
                      <div key={item.key} className="rounded-lg border border-border-main bg-button p-3">
                        <div className="text-[9px] font-black uppercase tracking-widest text-text-dim">
                          {item.label} · n={item.data.n}
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-lg font-black tabular-nums text-text-bright">
                            {item.data.meanDelta === null
                              ? '—'
                              : `${item.data.meanDelta > 0 ? '+' : ''}${formatNumber(item.data.meanDelta, 1)}`}
                          </span>
                          <span className="text-[10px] uppercase tracking-widest text-text-dim">p.p.</span>
                        </div>
                        <div className="mt-1 text-[10px] tabular-nums text-text-dim">
                          {formatNumber(item.data.meanBefore, 1)} → {formatNumber(item.data.meanAfter, 1)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* --- Registro ------------------------------------------------------ */}
      <ChartCard
        title={t.intListTitle}
        subtitle={t.intListSub}
        isEmpty={!state?.entries.length}
        emptyLabel={t.intEmpty}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="border-b border-border-main text-[10px] font-black uppercase tracking-widest text-text-dim">
              <tr>
                <th className="py-2">{t.learnStudentColumn}</th>
                <th className="py-2">{t.intAction}</th>
                <th className="py-2">{t.intNote}</th>
                <th className="py-2 text-right">{t.intBefore}</th>
                <th className="py-2 pr-6 text-right">{t.intAfter}</th>
                <th className="py-2">{t.intStatus}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main/50">
              {(followup?.entries || []).map(entry => (
                <tr key={entry.id}>
                  <td className="py-2 pr-4">
                    <div className="font-bold text-text-main">{entry.name || entry.userId}</div>
                    <div className="text-[10px] text-text-dim">{formatDate(entry.createdAt, lang)}</div>
                  </td>
                  <td className="py-2 pr-4 text-text-dim">{t[`intAction_${entry.action}`]}</td>
                  <td className="py-2 pr-4 text-text-dim">{entry.note || '—'}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-text-dim">
                    {formatNumber(entry.baseline.avgPercent, 1)}
                  </td>
                  <td className="py-2 pr-6 text-right tabular-nums text-text-bright">
                    {entry.movement && !entry.stale ? formatNumber(entry.movement.after, 1) : '—'}
                  </td>
                  <td className="py-2 pr-4">
                    <select
                      value={entry.status}
                      onChange={(event) => changeStatus(entry.id, event.target.value)}
                      className="cursor-pointer rounded border border-border-main bg-input px-2 py-1 text-[10px] text-text-main focus:border-accent focus:outline-none"
                    >
                      {['planned', 'done', 'abandoned'].map(status => (
                        <option key={status} value={status}>{t[`intStatus_${status}`]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setSocraticFor({ userId: entry.userId, name: entry.name || String(entry.userId) })}
                        title={t.intSocratic}
                        className="rounded p-1.5 text-text-dim transition-colors hover:text-accent"
                      >
                        <Sparkles size={13} />
                      </button>
                      <button
                        onClick={() => remove(entry.id)}
                        title={t.intRemove}
                        className="rounded p-1.5 text-text-dim transition-colors hover:text-red-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <p className="flex items-start gap-2 text-[10px] leading-relaxed text-text-dim">
        <Info size={11} className="mt-0.5 shrink-0" /> {t.intBaselineNote}
      </p>

      {socraticFor && (
        <SocraticPackageModal
          isOpen
          onClose={() => setSocraticFor(null)}
          turma={metrics.turma}
          student={socraticFor}
          questions={metrics.questions.map(question => ({ key: question.key, name: question.name }))}
          t={t}
          lang={lang}
        />
      )}
    </div>
  );
};

export default InterventionsPanel;
