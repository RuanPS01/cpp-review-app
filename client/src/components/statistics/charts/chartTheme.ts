// Tokens e utilitários compartilhados pelos gráficos da tela de Estatísticas.
//
// As cores vivem em index.css como custom properties (`--viz-*`) para que o
// tema claro/escuro do app troque a paleta inteira em um só lugar. Aqui só
// referenciamos os papéis — nenhum hexadecimal solto nos componentes.

export const VIZ = {
  surface: 'var(--viz-surface)',
  series1: 'var(--viz-series-1)',
  series2: 'var(--viz-series-2)',
  series3: 'var(--viz-series-3)',
  good: 'var(--viz-good)',
  warning: 'var(--viz-warning)',
  serious: 'var(--viz-serious)',
  critical: 'var(--viz-critical)',
  grid: 'var(--viz-grid)',
  axis: 'var(--viz-axis)',
  muted: 'var(--viz-muted)'
} as const;

/** Rampa sequencial, do menor para o maior valor. */
export const SEQUENTIAL = [
  'var(--viz-seq-1)',
  'var(--viz-seq-2)',
  'var(--viz-seq-3)',
  'var(--viz-seq-4)',
  'var(--viz-seq-5)'
];

/** Cor de estado por nível de risco — nunca usada como cor de série. */
export const RISK_COLORS: Record<string, string> = {
  critical: VIZ.critical,
  high: VIZ.serious,
  medium: VIZ.warning,
  low: VIZ.good
};

// Especificações de marca fixas (ver diretrizes de visualização).
export const MARK = {
  maxBarThickness: 24,
  barRadius: 4,
  surfaceGap: 2,
  lineWidth: 2,
  dotRadius: 4.5,
  ringWidth: 2
};

export function seqColor(value: number, max: number): string {
  if (!max || value <= 0) return 'transparent';
  const ratio = Math.min(1, value / max);
  const index = Math.min(SEQUENTIAL.length - 1, Math.floor(ratio * SEQUENTIAL.length - 0.0001));
  return SEQUENTIAL[Math.max(0, index)];
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatPercent(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${formatNumber(value, decimals)}%`;
}

export function formatDateTime(timestamp: number | null | undefined, locale = 'pt-BR'): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString(locale, {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

export function formatDate(timestamp: number | null | undefined, locale = 'pt-BR'): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Escala com máximo arredondado para um número "limpo" no eixo. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function axisTicks(max: number, count = 4): number[] {
  const step = max / count;
  return Array.from({ length: count + 1 }, (_, i) => Math.round(i * step * 100) / 100);
}
