import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Check, Clock, Download, FileSpreadsheet, Layers, Loader2, Table2
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { ExportGroup, ExportManifest, ExportTableInfo, StatisticsScope } from '../../types/statistics';
import { downloadBlob, fileNameFromResponse, statisticsApi } from '../../services/statistics';
import { VIZ, formatNumber } from './charts/chartTheme';

interface StatisticsExportPanelProps {
  scope: StatisticsScope;
  t: Record<string, string>;
  onClose: () => void;
}

const GROUP_ORDER: ExportGroup[] = ['cross', 'timeseries', 'unified'];

const GROUP_ICONS: Record<ExportGroup, typeof Table2> = {
  cross: Table2,
  timeseries: Clock,
  unified: Layers
};

/**
 * Recorte "essencial": as quatro tabelas que respondem a maior parte das
 * perguntas. Os outros atalhos são grupos inteiros, resolvidos por `group`.
 */
const ESSENTIAL_TABLES = ['overview', 'questions', 'students', 'submissions'];

/**
 * Escolha do que exportar. O catálogo vem do servidor já com a contagem de
 * linhas do recorte atual, então o professor vê o tamanho de cada tabela antes
 * de baixar — e pode levar uma tabela isolada em CSV ou o pacote inteiro em ZIP
 * com o guia de análise.
 */
const StatisticsExportPanel: React.FC<StatisticsExportPanelProps> = ({ scope, t, onClose }) => {
  const [manifest, setManifest] = useState<ExportManifest | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [includeDocs, setIncludeDocs] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    statisticsApi.getExportManifest(scope)
      .then(response => {
        if (!active) return;
        setManifest(response.data);
        setSelected(response.data.tables.map(table => table.id));
      })
      .catch((err: any) => {
        if (active) toast.error(err.response?.data?.error || err.message);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [scope]);

  const groupLabel = useCallback((group: ExportGroup) => {
    const key = `statsExportGroup${group.charAt(0).toUpperCase()}${group.slice(1)}`;
    return t[key] || manifest?.groups?.[group] || group;
  }, [t, manifest]);

  const tablesByGroup = useMemo(() => {
    const map = new Map<ExportGroup, ExportTableInfo[]>();
    (manifest?.tables || []).forEach(table => {
      if (!map.has(table.group)) map.set(table.group, []);
      map.get(table.group)!.push(table);
    });
    return map;
  }, [manifest]);

  const totals = useMemo(() => {
    const chosen = (manifest?.tables || []).filter(table => selected.includes(table.id));
    return {
      tables: chosen.length,
      rows: chosen.reduce((acc, table) => acc + table.rowCount, 0)
    };
  }, [manifest, selected]);

  const toggle = (id: string) => setSelected(previous => (previous.includes(id)
    ? previous.filter(item => item !== id)
    : [...previous, id]));

  const toggleGroup = (group: ExportGroup) => {
    const ids = (tablesByGroup.get(group) || []).map(table => table.id);
    const allSelected = ids.every(id => selected.includes(id));
    setSelected(previous => (allSelected
      ? previous.filter(id => !ids.includes(id))
      : [...new Set([...previous, ...ids])]));
  };

  const applyPreset = (preset: 'all' | 'none' | 'essential' | 'timeseries' | 'unified') => {
    const all = manifest?.tables || [];
    if (preset === 'all') return setSelected(all.map(table => table.id));
    if (preset === 'none') return setSelected([]);
    if (preset === 'essential') {
      return setSelected(all.filter(table => ESSENTIAL_TABLES.includes(table.id)).map(table => table.id));
    }
    return setSelected(all.filter(table => table.group === preset).map(table => table.id));
  };

  const downloadZip = async () => {
    if (!selected.length) return toast.error(t.statsExportEmpty);
    setBusy('zip');
    try {
      const response = await statisticsApi.exportZip(scope, selected, includeDocs);
      downloadBlob(response.data, fileNameFromResponse(response.headers, 'estatisticas.zip'));
      toast.success(t.statsExportDone);
      onClose();
    } catch (err: any) {
      toast.error(`${t.statsExportFailed}: ${err.message}`);
    } finally {
      setBusy(null);
    }
  };

  const downloadCsv = async (table: ExportTableInfo) => {
    setBusy(table.id);
    try {
      const response = await statisticsApi.exportCsv(scope, table.id);
      downloadBlob(response.data, fileNameFromResponse(response.headers, table.file));
      toast.success(t.statsExportDone);
    } catch (err: any) {
      toast.error(`${t.statsExportFailed}: ${err.message}`);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 size={32} className="animate-spin text-accent" />
        <p className="animate-pulse text-[11px] font-black uppercase tracking-widest text-text-dim">
          {t.statsExportLoading}
        </p>
      </div>
    );
  }

  if (!manifest) {
    return (
      <p className="py-10 text-center text-[11px] font-bold uppercase tracking-widest text-text-dim">
        {t.statsExportFailed}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] leading-relaxed text-text-dim">{t.statsExportIntro}</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border-main bg-input px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-text-dim">
        <span className="text-accent">{manifest.turmas.join(' + ')}</span>
        <span>{formatNumber(manifest.studentCount)} {t.statsLabelStudents}</span>
        <span>{formatNumber(manifest.questionCount)} {t.statsTabQuestions}</span>
        <span>{formatNumber(manifest.eventCount)} {t.statsExportEvents}</span>
        {manifest.ignoreEmptyStudents && manifest.excludedStudentCount > 0 && (
          <span style={{ color: VIZ.warning }}>
            −{formatNumber(manifest.excludedStudentCount)} {t.statsExportExcluded}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([
          ['all', t.statsExportSelectAll],
          ['essential', t.statsExportPresetEssential],
          ['timeseries', t.statsExportPresetTime],
          ['unified', t.statsExportPresetUnified],
          ['none', t.statsExportClear]
        ] as const).map(([preset, label]) => (
          <button
            key={preset}
            onClick={() => applyPreset(preset)}
            className="rounded-lg border border-border-main bg-button px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-text-dim transition-all hover:border-accent/50 hover:text-accent active:scale-95"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="max-h-[46vh] space-y-5 overflow-y-auto pr-1">
        {GROUP_ORDER.filter(group => tablesByGroup.has(group)).map(group => {
          const tables = tablesByGroup.get(group) || [];
          const Icon = GROUP_ICONS[group];
          const allSelected = tables.every(table => selected.includes(table.id));

          return (
            <section key={group}>
              <header className="mb-2 flex items-center justify-between gap-3">
                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-bright">
                  <Icon size={12} className="text-accent" /> {groupLabel(group)}
                </h4>
                <button
                  onClick={() => toggleGroup(group)}
                  className="text-[9px] font-black uppercase tracking-widest text-text-dim transition-colors hover:text-accent"
                >
                  {allSelected ? t.statsExportClear : t.statsExportSelectAll}
                </button>
              </header>

              <ul className="space-y-1.5">
                {tables.map(table => {
                  const isSelected = selected.includes(table.id);
                  return (
                    <li
                      key={table.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 transition-all ${
                        isSelected ? 'border-accent/40 bg-accent/5' : 'border-border-main'
                      }`}
                    >
                      <button
                        onClick={() => toggle(table.id)}
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                          isSelected ? 'border-accent bg-accent text-black' : 'border-border-main'
                        }`}
                        aria-label={table.title}
                      >
                        {isSelected && <Check size={11} strokeWidth={4} />}
                      </button>

                      <button onClick={() => toggle(table.id)} className="min-w-0 flex-1 text-left">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-xs font-bold text-text-main">{table.title}</span>
                          <code className="text-[9px] text-text-dim">{table.file}</code>
                        </div>
                        <p className="mt-1 text-[10px] leading-snug text-text-dim">{table.description}</p>
                        <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-text-dim">
                          {t.statsExportRows
                            .replace('{rows}', formatNumber(table.rowCount))
                            .replace('{cols}', formatNumber(table.columnCount))}
                        </div>
                      </button>

                      <button
                        onClick={() => downloadCsv(table)}
                        disabled={busy !== null}
                        title={t.statsExportDownloadCsv}
                        className="shrink-0 rounded-lg border border-border-main p-2 text-text-dim transition-all hover:border-accent/50 hover:text-accent disabled:opacity-40"
                      >
                        {busy === table.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <FileSpreadsheet size={13} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-main bg-input p-3">
        <input
          type="checkbox"
          checked={includeDocs}
          onChange={(event) => setIncludeDocs(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
        />
        <span>
          <span className="flex items-center gap-2 text-[11px] font-bold text-text-main">
            <BookOpen size={12} className="text-accent" /> {t.statsExportIncludeDocs}
          </span>
          <span className="mt-1 block text-[10px] leading-snug text-text-dim">{t.statsExportIncludeDocsHint}</span>
        </span>
      </label>

      <p className="text-[10px] leading-snug text-text-dim">{t.statsExportHint}</p>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-main pt-4">
        <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">
          {t.statsExportSelected
            .replace('{count}', formatNumber(totals.tables))
            .replace('{rows}', formatNumber(totals.rows))}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border-main px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-text-dim transition-all hover:text-text-bright"
          >
            {t.cancel}
          </button>
          <button
            onClick={downloadZip}
            disabled={busy !== null || !selected.length}
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-black shadow-lg shadow-accent/20 transition-all active:scale-95 hover:bg-accent/80 disabled:opacity-40"
          >
            {busy === 'zip' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {t.statsExportDownloadZip}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatisticsExportPanel;
