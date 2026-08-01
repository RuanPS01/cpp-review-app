import React from 'react';
import { ChartTooltip, useContainerWidth, useTooltip } from './ChartCard';
import { MARK, VIZ, axisTicks, niceMax } from './chartTheme';

export interface ScatterPoint {
  x: number;
  y: number;
  label: string;
  color: string;
  detail?: { label: string; value: string }[];
}

interface ScatterChartProps {
  points: ScatterPoint[];
  height?: number;
  xLabel: string;
  yLabel: string;
  yMax?: number;
  /** Linha de referência horizontal (ex.: nota de aprovação). */
  referenceY?: { value: number; label: string };
}

const ScatterChart: React.FC<ScatterChartProps> = ({
  points, height = 260, xLabel, yLabel, yMax = 100, referenceY
}) => {
  const { ref, width } = useContainerWidth();
  const { tooltip, show, hide } = useTooltip();

  const padding = { top: 18, right: 16, bottom: 40, left: 44 };
  const plotWidth = Math.max(40, width - padding.left - padding.right);
  const plotHeight = height - padding.top - padding.bottom;
  const xMax = niceMax(Math.max(1, ...points.map(p => p.x)));

  const toX = (value: number) => padding.left + (value / xMax) * plotWidth;
  const toY = (value: number) => padding.top + plotHeight - (value / yMax) * plotHeight;

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img">
          {axisTicks(yMax).map(tick => (
            <g key={`y-${tick}`}>
              <line x1={padding.left} x2={width - padding.right} y1={toY(tick)} y2={toY(tick)} stroke={VIZ.grid} strokeWidth={1} />
              <text x={padding.left - 6} y={toY(tick)} textAnchor="end" dominantBaseline="middle" className="fill-text-dim text-[10px] tabular-nums">
                {tick}
              </text>
            </g>
          ))}

          {axisTicks(xMax).map(tick => (
            <text key={`x-${tick}`} x={toX(tick)} y={height - padding.bottom + 14} textAnchor="middle" className="fill-text-dim text-[10px] tabular-nums">
              {tick}
            </text>
          ))}

          {referenceY && (
            <g>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={toY(referenceY.value)}
                y2={toY(referenceY.value)}
                stroke={VIZ.axis}
                strokeWidth={1}
              />
              <text x={width - padding.right} y={toY(referenceY.value) - 5} textAnchor="end" className="fill-text-dim text-[9px] font-bold uppercase tracking-widest">
                {referenceY.label}
              </text>
            </g>
          )}

          {points.map((point, index) => (
            <circle
              key={`${point.label}-${index}`}
              cx={toX(point.x)}
              cy={toY(point.y)}
              r={MARK.dotRadius}
              fill={point.color}
              stroke={VIZ.surface}
              strokeWidth={MARK.ringWidth}
              onMouseMove={(event) => {
                const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                show({
                  x: event.clientX - box.left,
                  y: event.clientY - box.top,
                  title: point.label,
                  rows: [
                    { label: yLabel, value: String(point.y), color: point.color },
                    { label: xLabel, value: String(point.x) },
                    ...(point.detail || [])
                  ]
                });
              }}
              onMouseLeave={hide}
            />
          ))}

          <line x1={padding.left} x2={width - padding.right} y1={padding.top + plotHeight} y2={padding.top + plotHeight} stroke={VIZ.axis} strokeWidth={1} />
          <text x={width - padding.right} y={height - 6} textAnchor="end" className="fill-text-dim text-[9px] font-bold uppercase tracking-widest">
            {xLabel}
          </text>
        </svg>
      )}
      <ChartTooltip tooltip={tooltip} />
    </div>
  );
};

export default ScatterChart;
