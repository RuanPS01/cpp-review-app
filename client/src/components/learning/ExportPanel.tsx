import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Database, Download, Info, Loader2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { learningApi } from '../../services/learning';
import type { ExportSummary } from '../../types/learning';
import { VIZ, formatNumber } from '../statistics/charts/chartTheme';

interface ExportPanelProps {
  t: Record<string, string>;
}

const FILES = [
  'alunos.csv', 'conceitos.csv', 'trajetorias.csv',
  'atividade_diaria.csv', 'intervencoes.csv', 'turmas.csv'
];

/**
 * A base consolidada.
 *
 * Exporta todas as turmas, não só a aberta: uma turma de 30–60 alunos não treina
 * modelo nenhum, e é o empilhamento entre semestres que dá volume. Como a
 * matrícula é a mesma entre períodos, o mesmo aluno se liga ao longo do tempo.
 */
const ExportPanel: React.FC<ExportPanelProps> = ({ t }) => {
  const [turmas, setTurmas] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [pseudonymize, setPseudonymize] = useState(true);
  const [schemaVersion, setSchemaVersion] = useState(1);
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    learningApi.listExportTurmas()
      .then(response => {
        setTurmas(response.data.turmas);
        setSelected(response.data.turmas);
        setSchemaVersion(response.data.schemaVersion);
      })
      .catch(err => toast.error(err.response?.data?.error || err.message));
  }, []);

  const toggle = (turma: string) => {
    setSelected(previous => previous.includes(turma)
      ? previous.filter(item => item !== turma)
      : [...previous, turma]);
    setSummary(null);
  };

  const download = async () => {
    if (!selected.length) return;
    setBusy(true);
    try {
      const response = await learningApi.exportPackage(selected, pseudonymize);

      const header = response.headers['x-export-summary'];
      if (header) setSummary(JSON.parse(decodeURIComponent(header as string)));

      // O pacote é binário, então vira blob — o padrão de âncora com data URL
      // usado no resto do app não serve para um .zip de centenas de KB.
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/zip' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `analises-aprendizado_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(t.expDone);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const totalRows = summary
    ? Object.values(summary.rowCounts).reduce((acc, value) => acc + value, 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border-main bg-panel p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-accent/20 bg-accent/10 p-2.5">
            <Database size={18} className="text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight text-text-bright">{t.expTitle}</h3>
            <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-text-dim">{t.expHint}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-border-main bg-panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">{t.expTurmas}</span>
            <button
              onClick={() => setSelected(selected.length === turmas.length ? [] : turmas)}
              className="text-[10px] font-black uppercase tracking-widest text-text-dim transition-colors hover:text-accent"
            >
              {selected.length === turmas.length ? t.expNone : t.expAll}
            </button>
          </div>
          <div className="space-y-1">
            {turmas.map(turma => (
              <label key={turma} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-button">
                <input
                  type="checkbox"
                  checked={selected.includes(turma)}
                  onChange={() => toggle(turma)}
                  className="accent-accent"
                />
                <span className="text-[11px] text-text-main">{turma}</span>
              </label>
            ))}
          </div>
          {turmas.length < 3 && (
            <p className="mt-3 flex items-start gap-2 text-[10px] leading-tight text-text-dim">
              <AlertTriangle size={11} className="mt-0.5 shrink-0" style={{ color: VIZ.warning }} />
              {t.expFewTurmas}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border-main bg-panel p-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={pseudonymize}
                onChange={(event) => { setPseudonymize(event.target.checked); setSummary(null); }}
                className="mt-0.5 accent-accent"
              />
              <span>
                <span className="flex items-center gap-2 text-[11px] font-bold text-text-main">
                  <ShieldCheck size={13} style={{ color: pseudonymize ? VIZ.good : VIZ.warning }} />
                  {t.expPseudonymize}
                </span>
                <span className="mt-1 block text-[10px] leading-relaxed text-text-dim">
                  {pseudonymize ? t.expPseudonymizeOn : t.expPseudonymizeOff}
                </span>
              </span>
            </label>
          </div>

          <button
            onClick={download}
            disabled={busy || !selected.length}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-[11px] font-black uppercase tracking-widest text-black shadow-lg shadow-accent/20 transition-all active:scale-95 hover:bg-accent/80 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {t.expDownload}
          </button>

          <div className="rounded-xl border border-border-main bg-panel p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-text-dim">{t.expContents}</div>
            <ul className="mt-2 space-y-1 text-[11px] text-text-dim">
              {FILES.map(file => (
                <li key={file} className="flex items-center justify-between">
                  <span className="font-mono">{file}</span>
                  {summary && (
                    <span className="tabular-nums text-text-main">
                      {formatNumber(summary.rowCounts[file] ?? 0)}
                    </span>
                  )}
                </li>
              ))}
              <li className="flex items-center justify-between border-t border-border-main pt-1">
                <span className="font-mono">dicionario.csv</span>
                <span className="text-[10px] uppercase tracking-widest">{t.expDictionary}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="font-mono">LEIA-ME.md</span>
                <span className="text-[10px] uppercase tracking-widest">{t.expReadme}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="font-mono">manifesto.json</span>
                <span className="text-[10px] uppercase tracking-widest">v{schemaVersion}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {summary && (
        <div className="rounded-xl border p-4" style={{ borderColor: VIZ.good }}>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: VIZ.good }}>
            <Check size={12} /> {t.expSummary.replace('{rows}', formatNumber(totalRows)).replace('{turmas}', String(summary.turmas.length))}
          </div>
          {summary.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-border-main pt-3 text-[11px] leading-tight text-text-dim">
              {summary.warnings.map((warning, index) => (
                <li key={index} className="flex items-start gap-2">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" style={{ color: VIZ.warning }} />
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="flex items-start gap-2 text-[10px] leading-relaxed text-text-dim">
        <Info size={11} className="mt-0.5 shrink-0" /> {t.expTraps}
      </p>
    </div>
  );
};

export default ExportPanel;
