import React from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { RiskLevel } from '../../types/statistics';
import { RISK_COLORS } from './charts/chartTheme';

const ICONS = {
  critical: AlertOctagon,
  high: AlertTriangle,
  medium: Info,
  low: CheckCircle2
} as const;

interface RiskBadgeProps {
  level: RiskLevel;
  label: string;
  score?: number;
  compact?: boolean;
}

/**
 * Cor de estado nunca aparece sozinha: o selo sempre carrega ícone e rótulo,
 * que é o que garante leitura em daltonismo e impressão em tons de cinza.
 */
const RiskBadge: React.FC<RiskBadgeProps> = ({ level, label, score, compact }) => {
  const Icon = ICONS[level];
  const color = RISK_COLORS[level];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-black uppercase tracking-widest ${compact ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-[10px]'}`}
      style={{ color, borderColor: color, background: 'transparent' }}
    >
      <Icon size={compact ? 10 : 12} />
      {label}
      {score !== undefined && <span className="tabular-nums opacity-70">{score}</span>}
    </span>
  );
};

export default RiskBadge;
