import React, { useState } from 'react';
import { Copy, Loader2, RotateCw, Sparkles } from 'lucide-react';
import { marked } from 'marked';
import toast from 'react-hot-toast';
import type { AIReport, ReportKind } from '../../types/statistics';
import { statisticsApi } from '../../services/statistics';
import { formatDateTime } from './charts/chartTheme';

interface AIReportCardProps {
  t: Record<string, string>;
  lang: string;
  turma: string;
  kind: ReportKind;
  targetId?: string | null;
  title: string;
  description: string;
  report?: AIReport;
  onGenerated: (report: AIReport) => void;
  compact?: boolean;
}

/**
 * Cartão de análise textual. O relatório fica em cache no servidor: gerar de
 * novo é uma decisão explícita do professor, para não gastar tokens (ou tempo
 * de modelo local) a cada visita à aba.
 */
const AIReportCard: React.FC<AIReportCardProps> = ({
  t, lang, turma, kind, targetId, title, description, report, onGenerated, compact
}) => {
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const response = await statisticsApi.generateReport({ turma, kind, targetId: targetId ?? null, lang });
      onGenerated(response.data);
    } catch (err: any) {
      toast.error(`${t.statsAIError}: ${err.response?.data?.error || err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="flex flex-col rounded-xl border border-border-main bg-panel p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-accent/20 bg-accent/10 p-2 text-accent">
            <Sparkles size={compact ? 16 : 20} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-text-bright">{title}</h3>
            <p className="mt-1 max-w-xl text-[11px] leading-tight text-text-dim">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {report && (
            <button
              onClick={() => { navigator.clipboard.writeText(report.markdown); toast.success(t.statsAICopied); }}
              className="flex items-center gap-2 rounded-lg border border-border-main px-3 py-2 text-[10px] font-black uppercase tracking-widest text-text-dim transition-all hover:border-accent/50 hover:text-accent"
            >
              <Copy size={12} /> {t.statsAICopy}
            </button>
          )}
          <button
            onClick={generate}
            disabled={generating}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 ${
              report
                ? 'border border-border-main text-text-dim hover:border-accent/50 hover:text-accent'
                : 'bg-accent text-black shadow-lg shadow-accent/20 hover:bg-accent/80'
            }`}
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : report ? <RotateCw size={12} /> : <Sparkles size={12} />}
            {report ? t.statsAIRegenerate : t.statsAIGenerate}
          </button>
        </div>
      </header>

      {generating ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <Loader2 size={32} className="animate-spin text-accent" />
          <p className="animate-pulse text-[11px] font-black uppercase tracking-widest text-text-dim">{t.statsAIGenerating}</p>
        </div>
      ) : report ? (
        <>
          <div
            className="markdown-content max-h-[520px] overflow-y-auto rounded-lg border border-border-main bg-input p-5 text-sm leading-relaxed text-text-main"
            dangerouslySetInnerHTML={{ __html: marked.parse(report.markdown) as string }}
          />
          <p className="mt-3 text-[10px] uppercase tracking-widest text-text-dim">
            {t.statsAIGeneratedAt
              .replace('{date}', formatDateTime(report.generatedAt, lang))
              .replace('{model}', `${report.provider} · ${report.model}`)}
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-main py-10 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-dim">{t.statsAIEmpty}</p>
          <p className="text-[10px] text-text-dim">{t.statsAIProviderHint}</p>
        </div>
      )}
    </section>
  );
};

export default AIReportCard;
