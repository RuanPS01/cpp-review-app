import React, { useMemo, useState } from 'react';
import { ChartTooltip, useContainerWidth, useTooltip } from './ChartCard';
import { MARK, VIZ, axisTicks, niceMax } from './chartTheme';

export interface LinePoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: LinePoint[];
  height?: number;
  color?: string;
  valueLabel?: string;
  formatValue?: (value: number) => string;
}

/** Série temporal única, com crosshair e ponto ativo no hover. */
const LineChart: React.FC<LineChartProps> = ({
  data,
  height = 220,
  color = VIZ.series1,
  valueLabel = 'Submissões',
  formatValue = (value) => String(value)
}) => {
  const { ref, width } = useContainerWidth();
  const { tooltip, show, hide } = useTooltip();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const padding = { top: 18, right: 16, bottom: 30, left: 40 };
  const plotWidth = Math.max(40, width - padding.left - padding.right);
  const plotHeight = height - padding.top - padding.bottom;
  const domainMax = niceMax(Math.max(1, ...data.map(d => d.value)));

  const points = useMemo(() => data.map((point, index) => ({
    ...point,
    x: padding.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth),
    y: padding.top + plotHeight - (point.value / domainMax) * plotHeight
  })), [data, plotWidth, plotHeight, domainMax, padding.left, padding.top]);

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
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
    show({
      x: points[nearest].x,
      y: points[nearest].y,
      title: points[nearest].label,
      rows: [{ label: valueLabel, value: formatValue(points[nearest].value), color }]
    });
  };

  return (
    <div ref={ref} className="relative w-full">
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
