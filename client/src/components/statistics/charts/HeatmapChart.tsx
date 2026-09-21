import React, { useId } from 'react';
import { ChartTooltip, useContainerWidth, useTooltip } from './ChartCard';
import { MARK, SEQUENTIAL, VIZ, seqColor } from './chartTheme';

interface HeatmapChartProps {
  /** matriz[linha][coluna]; `null` significa **sem dado**, que é diferente de zero. */
  values: (number | null)[][];
  rowLabels: string[];
  colLabels: string[];
  /** Rótulos de coluna exibidos (os demais ficam sem texto para não colidir). */
  colLabelEvery?: number;
  valueLabel?: string;
  rowWidth?: number;
  /** Formata o valor no tooltip (ex.: percentual). */
  formatValue?: (value: number) => string;
  /** Texto do tooltip e da legenda para as células sem dado. */
  missingLabel?: string;
  /** Rótulos das pontas da escala; por padrão `0` e o máximo observado. */
  scaleLabels?: [string, string];
  /** Topo fixo da escala. Sem isto a cor é relativa ao maior valor presente,
   *  o que faz um valor pequeno parecer máximo quando a matriz é branda. */
  maxValue?: number;
  /** Marcadores opcionais sobre a célula, por posição — ex.: um sinal extra. */
  markers?: (boolean | undefined)[][];
  markerLabel?: string;
}

/**
 * Codificação sequencial de magnitude: uma única matiz, do claro ao escuro
 * (invertida no tema escuro, ver `--viz-seq-*`). Células separadas por um vão
 * de 2px na cor da superfície.
 *
 * Célula `null` é desenhada hachurada, não vazia: "não avaliado" e "avaliado e
 * deu zero" são afirmações diferentes e não podem ter o mesmo visual.
 */
const HeatmapChart: React.FC<HeatmapChartProps> = ({
  values,
  rowLabels,
  colLabels,
  colLabelEvery = 3,
  valueLabel = 'Submissões',
  rowWidth = 44,
  formatValue = (value) => String(value),
  missingLabel = 'sem dado',
  scaleLabels,
  maxValue,
  markers,
  markerLabel
}) => {
  const { ref, width } = useContainerWidth();
  const { tooltip, show, hide } = useTooltip();
  // Ids de <pattern> são globais no documento: dois heatmaps na mesma tela
  // colidiriam sem isto.
  const patternId = `viz-heatmap-missing-${useId().replace(/:/g, '')}`;

  // Nulos ficam fora da escala: incluí-los faria `Math.max` virar NaN e
  // derrubar a cor de todas as células.
  const numeric = values.flat().filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const max = maxValue ?? (numeric.length ? Math.max(0, ...numeric) : 0);

  const cellWidth = Math.max(6, (width - rowWidth - 4) / Math.max(1, colLabels.length));
  const cellHeight = 22;
  const height = rowLabels.length * cellHeight + 22;

  // O rótulo de linha é medido antes de desenhar: sem isso nomes longos
  // escorrem por cima das células (≈6px por caractere em 10px).
  const fitLabel = (label: string) => {
    const maxChars = Math.max(4, Math.floor((rowWidth - 8) / 6));
    return label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
  };

  const hasMissing = values.flat().some(value => value === null || value === undefined);

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img">
          <defs>
            <pattern id={patternId} width={6} height={6} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1={0} y1={0} x2={0} y2={6} stroke={VIZ.grid} strokeWidth={3} />
            </pattern>
          </defs>

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
              <title>{rowLabel}</title>
              <text x={0} y={22 + row * cellHeight + cellHeight / 2} dominantBaseline="middle" className="fill-text-dim text-[10px]">
                {fitLabel(rowLabel)}
              </text>
              {colLabels.map((colLabel, col) => {
                const raw = values[row]?.[col];
                const missing = raw === null || raw === undefined;
                const value = missing ? 0 : (raw as number);
                const marked = Boolean(markers?.[row]?.[col]);
                const x = rowWidth + col * cellWidth;
                const y = 22 + row * cellHeight;
                const cellW = Math.max(1, cellWidth - MARK.surfaceGap);
                const cellH = cellHeight - MARK.surfaceGap;

                return (
                  <g key={`${rowLabel}-${colLabel}`}>
                    <rect
                      x={x}
                      y={y}
                      width={cellW}
                      height={cellH}
                      rx={2}
                      fill={missing ? `url(#${patternId})` : value > 0 ? seqColor(value, max) : 'transparent'}
                      stroke={missing || value > 0 ? 'none' : VIZ.grid}
                      strokeWidth={1}
                      onMouseMove={(event) => {
                        const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                        show({
                          x: event.clientX - box.left,
                          y: event.clientY - box.top,
                          title: `${rowLabel} · ${colLabel}`,
                          rows: [
                            { label: valueLabel, value: missing ? missingLabel : formatValue(value) },
                            ...(marked && markerLabel ? [{ label: markerLabel, value: 'sim' }] : [])
                          ]
                        });
                      }}
                      onMouseLeave={hide}
                    />
                    {marked && !missing && (
                      <circle
                        cx={x + cellW - 5}
                        cy={y + 5}
                        r={2.5}
                        fill={VIZ.surface}
                        stroke={VIZ.critical}
                        strokeWidth={1.5}
                        pointerEvents="none"
                      />
                    )}
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      )}
      <ChartTooltip tooltip={tooltip} />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-text-dim">
            {scaleLabels?.[0] ?? '0'}
          </span>
          {SEQUENTIAL.map(step => (
            <span key={step} className="h-2 w-6 rounded-sm" style={{ background: step }} />
          ))}
          <span className="text-[9px] font-bold uppercase tracking-widest tabular-nums text-text-dim">
            {scaleLabels?.[1] ?? String(max)}
          </span>
        </div>

        {hasMissing && (
          <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-text-dim">
            <span
              className="inline-block h-2.5 w-5 rounded-sm"
              style={{ backgroundImage: `repeating-linear-gradient(45deg, ${VIZ.grid} 0 3px, transparent 3px 6px)` }}
            />
            {missingLabel}
          </span>
        )}

        {markerLabel && (
          <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-text-dim">
            <svg width={10} height={10}>
              <circle cx={5} cy={5} r={2.5} fill={VIZ.surface} stroke={VIZ.critical} strokeWidth={1.5} />
            </svg>
            {markerLabel}
          </span>
        )}
      </div>
    </div>
  );
};

export default HeatmapChart;
