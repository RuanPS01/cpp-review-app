import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Largura real do container. Os SVGs são desenhados em pixels (texto não pode
 * ser esticado por `preserveAspectRatio`), então medimos em vez de escalar.
 */
export function useContainerWidth<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width ?? 0;
      setWidth(previous => (Math.abs(previous - next) > 1 ? next : previous));
    });
    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export interface TooltipState {
  x: number;
  y: number;
  title: string;
  rows: TooltipRow[];
}

/**
 * Estado de tooltip compartilhado. Um gráfico HTML/SVG é interativo por
 * natureza, então todo gráfico com marcas embarca hover — o único que dispensa
 * é o cartão de número puro.
 */
export function useTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const show = useCallback((state: TooltipState) => setTooltip(state), []);
  const hide = useCallback(() => setTooltip(null), []);
  return { tooltip, show, hide };
}

export const ChartTooltip: React.FC<{ tooltip: TooltipState | null }> = ({ tooltip }) => {
  if (!tooltip) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[140px] max-w-[240px] -translate-x-1/2 -translate-y-full rounded-lg border border-border-main bg-panel px-3 py-2 shadow-xl"
      style={{ left: `${tooltip.x}px`, top: `${tooltip.y - 10}px` }}
    >
      <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-text-dim">{tooltip.title}</div>
      {tooltip.rows.map((row, index) => (
        <div key={`${row.label}-${index}`} className="flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-2 text-text-dim">
            {row.color && (
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: row.color }} />
            )}
            {row.label}
          </span>
          <span className="font-bold tabular-nums text-text-bright">{row.value}</span>
        </div>
      ))}
    </div>
  );
};

export interface LegendItem {
  label: string;
  color: string;
}

export const ChartLegend: React.FC<{ items: LegendItem[] }> = ({ items }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
    {items.map(item => (
      <span key={item.label} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-text-dim">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
        {item.label}
      </span>
    ))}
  </div>
);

interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** Um legenda só faz sentido a partir de duas séries; uma série é nomeada pelo título. */
  legend?: LegendItem[];
  action?: React.ReactNode;
  footer?: React.ReactNode;
  isEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
  children: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({
  title, subtitle, legend, action, footer, isEmpty, emptyLabel = 'Sem dados', className = '', children
}) => (
  <section className={`relative flex flex-col rounded-xl border border-border-main bg-panel p-5 ${className}`}>
    <header className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-xs font-black uppercase tracking-widest text-text-bright">{title}</h3>
        {subtitle && <p className="mt-1 text-[11px] leading-tight text-text-dim">{subtitle}</p>}
      </div>
      {action}
    </header>

    {legend && legend.length > 1 && (
      <div className="mb-3">
        <ChartLegend items={legend} />
      </div>
    )}

    <div className="relative flex-1">
      {isEmpty ? (
        <div className="flex h-full min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border-main text-[11px] font-bold uppercase tracking-widest text-text-dim">
          {emptyLabel}
        </div>
      ) : children}
    </div>

    {footer && <div className="mt-4 border-t border-border-main pt-3 text-[11px] text-text-dim">{footer}</div>}
  </section>
);

export default ChartCard;
