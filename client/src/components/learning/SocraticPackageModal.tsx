import React, { useState } from 'react';
import { Copy, Download, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { learningApi } from '../../services/learning';
import type { SocraticPackage } from '../../types/learning';
import { VIZ } from '../statistics/charts/chartTheme';

interface SocraticPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  turma: string;
  student: { userId: number; name: string };
  questions: { key: string; name: string }[];
  t: Record<string, string>;
  lang: string;
}

/** O `.md` que o professor leva para a conversa. */
function toMarkdown(pkg: SocraticPackage, t: Record<string, string>): string {
  const lines = [
    `# ${t.socTitle} — ${pkg.student?.name || pkg.topic?.name || ''}`,
    '',
    pkg.question ? `**${t.socQuestion}:** ${pkg.question.name}` : '',
    pkg.topic ? `**${t.socTopic}:** ${pkg.topic.code} · ${pkg.topic.name}` : '',
    '',
    `## ${t.socRules}`,
    '',
    ...pkg.rules.map(rule => `- ${rule}`),
    '',
    `## ${t.socDiagnosis}`,
    '',
    pkg.generated.diagnostico,
    '',
    `## ${t.socQuestions}`,
    ''
  ];

  (pkg.generated.perguntas || []).forEach((item, index) => {
    lines.push(
      `${index + 1}. **${item.pergunta}**`,
      `   - ${t.socGoal}: ${item.objetivo}`,
      `   - ${t.socIfStuck}: ${item.seNaoSouber}`,
      ''
    );
  });

  lines.push(
    `## ${t.socScaffolding}`,
    '',
    pkg.generated.andaime,
    '',
    `## ${t.socProgressSignal}`,
    '',
    pkg.generated.sinalDeAvanco,
    '',
    '---',
    `_${t.socFooter.replace('{model}', `${pkg.provider}/${pkg.model}`)}_`
  );

  return lines.filter(line => line !== null && line !== undefined).join('\n');
}

const SocraticPackageModal: React.FC<SocraticPackageModalProps> = ({
  isOpen, onClose, turma, student, questions, t, lang
}) => {
  const [questionKey, setQuestionKey] = useState(questions[0]?.key || '');
  const [pkg, setPkg] = useState<SocraticPackage | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const response = await learningApi.buildSocratic({
        turma, userId: student.userId, questionKey, lang
      });
      setPkg(response.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!pkg) return;
    const content = toMarkdown(pkg, t);
    const anchor = document.createElement('a');
    anchor.setAttribute('href', `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`);
    anchor.setAttribute('download', `socratico_${student.name.replace(/\s+/g, '-')}.md`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const copy = () => {
    if (!pkg) return;
    navigator.clipboard.writeText(toMarkdown(pkg, t));
    toast.success(t.promptCopied);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t.socTitle} — ${student.name}`}
      icon={Sparkles}
      maxWidth="max-w-3xl"
      maxHeight="max-h-[90vh]"
    >
      <div className="space-y-4 overflow-y-auto">
        <p className="text-[11px] leading-relaxed text-text-dim">{t.socHint}</p>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={questionKey}
            onChange={(event) => setQuestionKey(event.target.value)}
            className="flex-1 cursor-pointer rounded-lg border border-border-main bg-input px-3 py-2 text-[11px] text-text-main focus:border-accent focus:outline-none"
          >
            {questions.map(question => (
              <option key={question.key} value={question.key}>{question.name}</option>
            ))}
          </select>
          <button
            onClick={generate}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-[10px] font-black uppercase tracking-widest text-black transition-all active:scale-95 hover:bg-accent/80 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {pkg ? t.socRegenerate : t.socGenerate}
          </button>
        </div>

        {/* As regras aparecem antes da geração e não mudam: elas não passam pelo
            modelo, senão o pacote deixaria de ser socrático assim que o modelo
            achasse mais gentil entregar a resposta. */}
        <div className="rounded-xl border p-4" style={{ borderColor: VIZ.good }}>
          <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: VIZ.good }}>
            {t.socRules} · {t.socRulesFixed}
          </div>
          <ul className="mt-2 space-y-1 text-[11px] leading-tight text-text-main">
            {(pkg?.rules || t.socRulesFallback.split('|')).map((rule, index) => (
              <li key={index}>• {rule}</li>
            ))}
          </ul>
        </div>

        {pkg && (
          <>
            <div className="space-y-3 rounded-xl border border-border-main p-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-text-dim">{t.socDiagnosis}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-text-main">{pkg.generated.diagnostico}</p>
              </div>

              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-text-dim">{t.socQuestions}</div>
                <ol className="mt-2 space-y-3">
                  {(pkg.generated.perguntas || []).map((item, index) => (
                    <li key={index} className="border-l-2 border-border-main pl-3">
                      <div className="text-[11px] font-bold text-text-bright">{index + 1}. {item.pergunta}</div>
                      <div className="mt-1 text-[10px] text-text-dim">{t.socGoal}: {item.objetivo}</div>
                      <div className="text-[10px] text-text-dim">{t.socIfStuck}: {item.seNaoSouber}</div>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-text-dim">{t.socScaffolding}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-text-main">{pkg.generated.andaime}</p>
              </div>

              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-text-dim">{t.socProgressSignal}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-text-main">{pkg.generated.sinalDeAvanco}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={download}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border-main bg-button py-2.5 text-[10px] font-black uppercase tracking-widest text-text-main transition-all active:scale-95 hover:border-accent/50 hover:text-accent"
              >
                <Download size={14} /> {t.socDownload}
              </button>
              <button
                onClick={copy}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border-main bg-button py-2.5 text-[10px] font-black uppercase tracking-widest text-text-main transition-all active:scale-95 hover:border-accent/50 hover:text-accent"
              >
                <Copy size={14} /> {t.copyPrompt}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default SocraticPackageModal;
