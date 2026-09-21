import React, { useMemo, useState } from 'react';
import { ChartTooltip, useContainerWidth, useTooltip } from './ChartCard';
import { MARK, VIZ, axisTicks, niceMax } from './chartTheme';

export interface LinePoint {
  label: string;
  value: number;
}

interface LineSeries {
  label: string;
  points: LinePoint[];
  color?: string;
}

interface LineChartProps {
  data: LinePoint[];
  height?: number;
  color?: string;
  valueLabel?: string;
  formatValue?: (value: number) => string;
  /**
   * Série de comparação opcional — a mediana da turma sob a curva do aluno,
   * por exemplo. Quando existe, a legenda aparece: duas séries sem legenda
   * deixam o leitor adivinhando qual é qual.
   */
  secondary?: LineSeries;
}

/** Série temporal, com crosshair, ponto ativo no hover e comparação opcional. */
const LineChart: React.FC<LineChartProps> = ({
  data,
  height = 220,
  color = VIZ.series1,
  valueLabel = 'Submissões',
  formatValue = (value) => String(value),
  secondary
}) => {
  const { ref, width } = useContainerWidth();
  const { tooltip, show, hide } = useTooltip();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const padding = { top: 18, right: 16, bottom: 30, left: 40 };
  const plotWidth = Math.max(40, width - padding.left - padding.right);
  const plotHeight = height - padding.top - padding.bottom;
  const secondaryColor = secondary?.color || VIZ.series2;
  const domainMax = niceMax(Math.max(
    1,
    ...data.map(d => d.value),
    ...(secondary?.points || []).map(d => d.value)
  ));

  // As duas séries compartilham o eixo X: a posição vem do índice da série
  // principal, para que a comparação fique ponto a ponto.
  const scale = (index: number, length: number, value: number) => ({
    x: padding.left + (length === 1 ? plotWidth / 2 : (index / (length - 1)) * plotWidth),
    y: padding.top + plotHeight - (value / domainMax) * plotHeight
  });

  const points = useMemo(() => data.map((point, index) => ({
    ...point,
    ...scale(index, data.length, point.value)
  })), [data, plotWidth, plotHeight, domainMax, padding.left, padding.top]);

  const secondaryPoints = useMemo(() => (secondary?.points || []).map((point, index) => ({
    ...point,
    ...scale(index, Math.max(data.length, secondary?.points.length || 1), point.value)
  })), [secondary, data.length, plotWidth, plotHeight, domainMax, padding.left, padding.top]);

  const toPath = (list: { x: number; y: number }[]) =>
    list.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const linePath = toPath(points);
  const secondaryPath = toPath(secondaryPoints);
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${padding.top + plotHeight} L ${points[0].x} ${padding.top + plotHeight} Z`
    : '';

  // Rótulos do eixo X só nas extremidades e no meio: com muitos dias, todas as
  // datas colidem e não são lidas.
  const labelIndexes = points.length <= 2
    ? points.map((_, i) => i)
    : [0, Math.floor((points.length - 1) / 2), points.length - 1];

  const handleMove = (event: React.MouseEvent<SVGRectElement>) => {
    const box = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const offsetX = event.clientX - box.left;
    let nearest = 0;
    points.forEach((point, index) => {
      if (Math.abs(point.x - offsetX) < Math.abs(points[nearest].x - offsetX)) nearest = index;
    });
    setActiveIndex(nearest);
    const rows = [{ label: valueLabel, value: formatValue(points[nearest].value), color }];
    const companion = secondaryPoints[nearest];
    if (secondary && companion) {
      rows.push({ label: secondary.label, value: formatValue(companion.value), color: secondaryColor });
    }
    show({ x: points[nearest].x, y: points[nearest].y, title: points[nearest].label, rows });
  };

  return (
    <div ref={ref} className="relative w-full">
      {secondary && (
        <div className="mb-1 flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-text-dim">
          {[{ label: valueLabel, color, dashed: false }, { label: secondary.label, color: secondaryColor, dashed: true }].map(entry => (
            <span key={entry.label} className="flex items-center gap-1.5">
              <svg width={18} height={6} aria-hidden="true">
                <line
                  x1={0} x2={18} y1={3} y2={3}
                  stroke={entry.color}
                  strokeWidth={MARK.lineWidth}
                  strokeDasharray={entry.dashed ? '5 4' : undefined}
                />
              </svg>
              {entry.label}
            </span>
          ))}
        </div>
      )}
      {width > 0 && points.length > 0 && (
        <svg width={width} height={height} role="img">
          {axisTicks(domainMax).map(tick => {
            const y = padding.top + plotHeight - (tick / domainMax) * plotHeight;
            return (
              <g key={tick}>
                <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke={VIZ.grid} strokeWidth={1} />
                <text x={padding.left - 6} y={y} textAnchor="end" dominantBaseline="middle" className="fill-text-dim text-[10px] tabular-nums">
                  {formatValue(tick)}
                </text>
              </g>
            );
          })}

          {/* A série de comparação fica atrás e sem área: o protagonista é o aluno. */}
          {secondaryPoints.length > 1 && (
            <path
              d={secondaryPath}
              fill="none"
              stroke={secondaryColor}
              strokeWidth={MARK.lineWidth}
              strokeDasharray="5 4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          <path d={areaPath} fill={color} opacity={0.1} />
          <path d={linePath} fill="none" stroke={color} strokeWidth={MARK.lineWidth} strokeLinejoin="round" strokeLinecap="round" />

          {activeIndex !== null && points[activeIndex] && (
            <>
              <line
                x1={points[activeIndex].x}
                x2={points[activeIndex].x}
                y1={padding.top}
                y2={padding.top + plotHeight}
                stroke={VIZ.axis}
                strokeWidth={1}
              />
              <circle
                cx={points[activeIndex].x}
                cy={points[activeIndex].y}
                r={MARK.dotRadius}
                fill={color}
                stroke={VIZ.surface}
                strokeWidth={MARK.ringWidth}
              />
              {secondaryPoints[activeIndex] && (
                <circle
                  cx={secondaryPoints[activeIndex].x}
                  cy={secondaryPoints[activeIndex].y}
                  r={MARK.dotRadius}
                  fill={secondaryColor}
                  stroke={VIZ.surface}
                  strokeWidth={MARK.ringWidth}
                />
              )}
            </>
          )}

          {labelIndexes.map(index => (
            <text
              key={index}
              x={points[index].x}
              y={height - padding.bottom + 14}
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
              className="fill-text-dim text-[10px]"
            >
              {points[index].label}
            </text>
          ))}

          <rect
            x={padding.left}
            y={padding.top}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            onMouseMove={handleMove}
            onMouseLeave={() => { setActiveIndex(null); hide(); }}
          />
        </svg>
      )}
      <ChartTooltip tooltip={tooltip} />
    </div>
  );
};

export default LineChart;
