import React from 'react';
import { ChartTooltip, useTooltip } from './ChartCard';
import { MARK } from './chartTheme';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  /** Número em destaque no centro. */
  centerValue: string;
  centerLabel: string;
  formatValue?: (value: number) => string;
}

/**
 * Proporção de um todo pequeno (3–4 partes). Os segmentos são separados por um
 * vão na cor da superfície — o fundo aparecendo entre os traços — em vez de uma
 * borda desenhada.
 */
const DonutChart: React.FC<DonutChartProps> = ({
  data, size = 180, centerValue, centerLabel, formatValue = (value) => String(value)
}) => {
  const { tooltip, show, hide } = useTooltip();
  const total = data.reduce((acc, slice) => acc + slice.value, 0);
  const thickness = 22;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="relative flex items-center gap-6">
      <svg width={size} height={size} role="img" className="shrink-0">
        <g transform={`translate(${size / 2}, ${size / 2}) rotate(-90)`}>
          {total === 0 ? (
            <circle r={radius} fill="none" stroke="var(--viz-grid)" strokeWidth={thickness} />
          ) : data.map(slice => {
            const fraction = slice.value / total;
            const dash = Math.max(0, fraction * circumference - MARK.surfaceGap * 2);
            const element = (
              <circle
                key={slice.label}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                onMouseMove={(event) => {
                  const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  show({
                    x: event.clientX - box.left,
                    y: event.clientY - box.top,
                    title: slice.label,
                    rows: [
                      { label: 'Total', value: formatValue(slice.value), color: slice.color },
                      { label: 'Percentual', value: `${Math.round(fraction * 100)}%` }
                    ]
                  });
                }}
                onMouseLeave={hide}
              />
            );
            offset += fraction * circumference;
            return element;
          })}
        </g>
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="fill-text-bright text-2xl font-black">
          {centerValue}
        </text>
        <text x={size / 2} y={size / 2 + 16} textAnchor="middle" className="fill-text-dim text-[10px] font-bold uppercase tracking-widest">
          {centerLabel}
        </text>
      </svg>

      <ul className="flex-1 space-y-2">
        {data.map(slice => (
          <li key={slice.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-text-dim">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: slice.color }} />
              {slice.label}
            </span>
            <span className="font-bold tabular-nums text-text-bright">
              {formatValue(slice.value)}
              <span className="ml-2 text-text-dim">{total ? `${Math.round((slice.value / total) * 100)}%` : '—'}</span>
            </span>
          </li>
        ))}
      </ul>

      <ChartTooltip tooltip={tooltip} />
    </div>
  );
};

export default DonutChart;
