import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  /** Cor de estado (`--viz-*`). Só use quando o número tiver leitura boa/ruim. */
  tone?: string;
  /** Medidor 0–100 exibido abaixo do valor. */
  meter?: number | null;
  emphasis?: boolean;
}

/**
 * Contrato do cartão de número: rótulo em caixa alta discreta, valor em
 * destaque e uma dica textual opcional. A cor de estado nunca é o único canal —
 * o texto da dica sempre diz o que está acontecendo.
 */
const StatCard: React.FC<StatCardProps> = ({ label, value, hint, icon: Icon, tone, meter, emphasis }) => {
  // Um valor indisponível não tem leitura boa/ruim: colorir o traço de "—"
  // faria parecer que existe um estado quando não existe medida.
  const hasValue = value !== '—' && value !== '';
  const effectiveTone = hasValue ? tone : undefined;

  return (
  <div className={`flex flex-col justify-between rounded-xl border border-border-main bg-panel p-4 ${emphasis ? 'shadow-[0_0_20px_var(--accent-glow)]' : ''}`}>
    <div className="mb-3 flex items-start justify-between gap-2">
      <span className="text-[10px] font-black uppercase leading-tight tracking-widest text-text-dim">{label}</span>
      {Icon && <Icon size={16} className="shrink-0 text-text-dim" style={effectiveTone ? { color: effectiveTone } : undefined} />}
    </div>

    <div>
      <div className={`${emphasis ? 'text-4xl' : 'text-2xl'} font-black leading-none text-text-bright`} style={effectiveTone ? { color: effectiveTone } : undefined}>
        {value}
      </div>
      {hint && <p className="mt-2 text-[11px] leading-tight text-text-dim">{hint}</p>}
    </div>

    {hasValue && meter !== null && meter !== undefined && (
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--viz-grid)' }}>
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(0, Math.min(100, meter))}%`, background: effectiveTone || 'var(--viz-series-1)' }}
        />
      </div>
    )}
  </div>
  );
};

export default StatCard;
