import React from 'react';
import { ChartTooltip, useContainerWidth, useTooltip } from './ChartCard';
import { MARK, SEQUENTIAL, VIZ, seqColor } from './chartTheme';

interface HeatmapChartProps {
  /** matriz[linha][coluna] */
  values: number[][];
  rowLabels: string[];
  colLabels: string[];
  /** Rótulos de coluna exibidos (os demais ficam sem texto para não colidir). */
  colLabelEvery?: number;
  valueLabel?: string;
  rowWidth?: number;
}

/**
 * Codificação sequencial de magnitude: uma única matiz, do claro ao escuro
 * (invertida no tema escuro, ver `--viz-seq-*`). Células separadas por um vão
 * de 2px na cor da superfície.
 */
const HeatmapChart: React.FC<HeatmapChartProps> = ({
  values,
  rowLabels,
  colLabels,
  colLabelEvery = 3,
  valueLabel = 'Submissões',
  rowWidth = 44
}) => {
  const { ref, width } = useContainerWidth();
  const { tooltip, show, hide } = useTooltip();

  const max = Math.max(0, ...values.flat());
  const cellWidth = Math.max(6, (width - rowWidth - 4) / Math.max(1, colLabels.length));
  const cellHeight = 22;
  const height = rowLabels.length * cellHeight + 22;

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img">
          {colLabels.map((label, col) => (
            col % colLabelEvery === 0 ? (
              <text
                key={label}
                x={rowWidth + col * cellWidth + cellWidth / 2}
                y={10}
                textAnchor="middle"
                className="fill-text-dim text-[9px] tabular-nums"
              >
                {label}
              </text>
            ) : null
          ))}

          {rowLabels.map((rowLabel, row) => (
            <g key={rowLabel}>
              <text x={0} y={22 + row * cellHeight + cellHeight / 2} dominantBaseline="middle" className="fill-text-dim text-[10px]">
                {rowLabel}
              </text>
              {colLabels.map((colLabel, col) => {
                const value = values[row]?.[col] ?? 0;
                return (
                  <rect
                    key={`${rowLabel}-${colLabel}`}
                    x={rowWidth + col * cellWidth}
                    y={22 + row * cellHeight}
                    width={Math.max(1, cellWidth - MARK.surfaceGap)}
                    height={cellHeight - MARK.surfaceGap}
                    rx={2}
                    fill={value > 0 ? seqColor(value, max) : 'transparent'}
                    stroke={value > 0 ? 'none' : VIZ.grid}
                    strokeWidth={1}
                    onMouseMove={(event) => {
                      const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                      show({
                        x: event.clientX - box.left,
                        y: event.clientY - box.top,
                        title: `${rowLabel} · ${colLabel}`,
                        rows: [{ label: valueLabel, value: String(value) }]
                      });
                    }}
                    onMouseLeave={hide}
                  />
                );
              })}
            </g>
          ))}
        </svg>
      )}
      <ChartTooltip tooltip={tooltip} />

      <div className="mt-3 flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-text-dim">0</span>
        {SEQUENTIAL.map(step => (
          <span key={step} className="h-2 w-6 rounded-sm" style={{ background: step }} />
        ))}
        <span className="text-[9px] font-bold uppercase tracking-widest text-text-dim tabular-nums">{max}</span>
      </div>
    </div>
  );
};

export default HeatmapChart;
