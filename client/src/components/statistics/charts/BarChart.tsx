import React from 'react';
import { ChartTooltip, useContainerWidth, useTooltip } from './ChartCard';
import { MARK, VIZ, axisTicks, niceMax } from './chartTheme';

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
  /** Linhas extras exibidas no tooltip. */
  detail?: { label: string; value: string }[];
}

interface BarChartProps {
  data: BarDatum[];
  orientation?: 'vertical' | 'horizontal';
  height?: number;
  /** Máximo do eixo; por padrão é derivado dos dados. */
  max?: number;
  formatValue?: (value: number) => string;
  /** Rótulo curto do eixo de valores, usado no tooltip. */
  valueLabel?: string;
  labelWidth?: number;
  color?: string;
}

/** Retângulo com a extremidade de dado arredondada e a base reta. */
function barPath(x: number, y: number, width: number, height: number, orientation: 'vertical' | 'horizontal') {
  const r = Math.min(MARK.barRadius, orientation === 'vertical' ? height : width);
  if (r <= 0 || width <= 0 || height <= 0) return '';
  if (orientation === 'vertical') {
    return `M ${x} ${y + height} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + width - r} ${y} Q ${x + width} ${y} ${x + width} ${y + r} L ${x + width} ${y + height} Z`;
  }
  return `M ${x} ${y} L ${x + width - r} ${y} Q ${x + width} ${y} ${x + width} ${y + r} L ${x + width} ${y + height - r} Q ${x + width} ${y + height} ${x + width - r} ${y + height} L ${x} ${y + height} Z`;
}

const BarChart: React.FC<BarChartProps> = ({
  data,
  orientation = 'vertical',
  height = 220,
  max,
  formatValue = (value) => String(value),
  valueLabel = 'Valor',
  labelWidth = 130,
  color = VIZ.series1
}) => {
  const { ref, width } = useContainerWidth();
  const { tooltip, show, hide } = useTooltip();

  const domainMax = niceMax(max ?? Math.max(1, ...data.map(d => d.value)));
  // Com poucas barras o rótulo direto na ponta cabe e dispensa o eixo; com
  // muitas, ele vira ruído e a informação fica no eixo e no tooltip.
  const showValueLabels = data.length <= 12;

  // Um rótulo nunca é cortado pela própria marca: medimos o espaço disponível
  // e reticenciamos antes de desenhar (≈6,4px por caractere em 11px).
  const fit = (label: string, available: number) => {
    const maxChars = Math.max(4, Math.floor(available / 6.4));
    return label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
  };

  if (orientation === 'horizontal') {
    const rowHeight = Math.min(40, Math.max(22, height / Math.max(1, data.length)));
    const chartHeight = rowHeight * data.length;
    const plotWidth = Math.max(40, width - labelWidth - 56);

    return (
      <div ref={ref} className="relative w-full">
        {width > 0 && (
          <svg width={width} height={chartHeight} role="img">
            {data.map((datum, index) => {
              const y = index * rowHeight;
              const barHeight = Math.min(MARK.maxBarThickness, rowHeight - MARK.surfaceGap * 2);
              const barY = y + (rowHeight - barHeight) / 2;
              const barWidth = Math.max(0, (datum.value / domainMax) * plotWidth);

              return (
                <g
                  key={`${datum.label}-${index}`}
                  onMouseMove={(event) => {
                    const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                    show({
                      x: event.clientX - box.left,
                      y: event.clientY - box.top,
                      title: datum.label,
                      rows: [
                        { label: valueLabel, value: formatValue(datum.value), color: datum.color || color },
                        ...(datum.detail || []).map(d => ({ label: d.label, value: d.value }))
                      ]
                    });
                  }}
                  onMouseLeave={hide}
                >
                  <rect x={0} y={y} width={width} height={rowHeight} fill="transparent" />
                  <text
                    x={0}
                    y={y + rowHeight / 2}
                    dominantBaseline="middle"
                    className="fill-text-dim text-[11px]"
                  >
                    {fit(datum.label, labelWidth - 8)}
                  </text>
                  <path d={barPath(labelWidth, barY, barWidth, barHeight, 'horizontal')} fill={datum.color || color} />
                  <text
                    x={labelWidth + barWidth + 8}
                    y={y + rowHeight / 2}
                    dominantBaseline="middle"
                    className="fill-text-bright text-[11px] font-bold tabular-nums"
                  >
                    {formatValue(datum.value)}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
        <ChartTooltip tooltip={tooltip} />
      </div>
    );
  }

  const padding = { top: 18, right: 8, bottom: 34, left: 40 };
  const plotWidth = Math.max(40, width - padding.left - padding.right);
  const plotHeight = height - padding.top - padding.bottom;
  const band = plotWidth / Math.max(1, data.length);
  const barWidth = Math.max(2, Math.min(MARK.maxBarThickness, band - MARK.surfaceGap));
  const ticks = axisTicks(domainMax);

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img">
          {ticks.map(tick => {
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

          {data.map((datum, index) => {
            const barHeight = Math.max(0, (datum.value / domainMax) * plotHeight);
            const x = padding.left + index * band + (band - barWidth) / 2;
            const y = padding.top + plotHeight - barHeight;

            return (
              <g
                key={`${datum.label}-${index}`}
                onMouseMove={(event) => {
                  const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  show({
                    x: event.clientX - box.left,
                    y: event.clientY - box.top,
                    title: datum.label,
                    rows: [
                      { label: valueLabel, value: formatValue(datum.value), color: datum.color || color },
                      ...(datum.detail || []).map(d => ({ label: d.label, value: d.value }))
                    ]
                  });
                }}
                onMouseLeave={hide}
              >
                <rect x={padding.left + index * band} y={padding.top} width={band} height={plotHeight} fill="transparent" />
                <path d={barPath(x, y, barWidth, barHeight, 'vertical')} fill={datum.color || color} />
                {showValueLabels && datum.value > 0 && (
                  <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" className="fill-text-bright text-[10px] font-bold tabular-nums">
                    {formatValue(datum.value)}
                  </text>
                )}
                <text
                  x={padding.left + index * band + band / 2}
                  y={height - padding.bottom + 14}
                  textAnchor="middle"
                  className="fill-text-dim text-[10px]"
                >
                  {fit(datum.label, band - 4)}
                </text>
              </g>
            );
          })}

          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotHeight}
            y2={padding.top + plotHeight}
            stroke={VIZ.axis}
            strokeWidth={1}
          />
        </svg>
      )}
      <ChartTooltip tooltip={tooltip} />
    </div>
  );
};

export default BarChart;
