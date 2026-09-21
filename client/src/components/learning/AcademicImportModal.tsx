import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { learningApi } from '../../services/learning';
import type { AcademicMatch, AcademicRow } from '../../types/learning';
import { VIZ, formatNumber } from '../statistics/charts/chartTheme';

interface AcademicImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  turma: string;
  t: Record<string, string>;
  onImported: (rows: AcademicRow[], columns: Record<string, string>, label: string) => Promise<unknown>;
}

/** Papéis que a planilha pode preencher. Só a matrícula é indispensável. */
const ROLES = ['idNumber', 'name', 'finalGrade', 'gradeMax', 'absences', 'attendanceRate', 'status'] as const;
type Role = typeof ROLES[number];

const normalize = (text: string) => String(text || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .trim();

/**
 * Detecção tolerante do cabeçalho, no espírito do parser de logs do Moodle.
 * O que não casar fica em branco para o professor apontar — nunca adivinhado
 * em silêncio, porque uma coluna errada produz uma tabela plausível e falsa.
 */
const PATTERNS: Record<Role, RegExp> = {
  idNumber: /^(matricula|ra|registro|id|codigo)/,
  name: /^(nome|aluno|estudante|name|student)/,
  finalGrade: /(nota final|media final|media|nota|final|grade)/,
  gradeMax: /(nota maxima|maxima|total possivel|grade max)/,
  absences: /(falta|ausencia|absence)/,
  attendanceRate: /(frequencia|presenca|attendance|assidu)/,
  status: /(situacao|status|resultado|condicao)/
};

function detectColumns(headers: string[]): Record<Role, string> {
  const mapping = {} as Record<Role, string>;
  const taken = new Set<string>();
  ROLES.forEach(role => {
    const found = headers.find(header => !taken.has(header) && PATTERNS[role].test(normalize(header)));
    if (found) { mapping[role] = found; taken.add(found); }
    else mapping[role] = '';
  });
  return mapping;
}

const AcademicImportModal: React.FC<AcademicImportModalProps> = ({
  isOpen, onClose, turma, t, onImported
}) => {
  const [headers, setHeaders] = useState<string[]>([]);
  const [sheetRows, setSheetRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<Record<Role, string> | null>(null);
  const [label, setLabel] = useState('');
  const [match, setMatch] = useState<AcademicMatch | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setHeaders([]); setSheetRows([]); setColumns(null); setMatch(null); setLabel('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      // `raw: false` faz o xlsx devolver o texto formatado da célula, o que
      // preserva a matrícula com zero à esquerda em vez de virar número.
      const workbook = XLSX.read(buffer, { type: 'array', raw: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
      if (!rows.length) throw new Error(t.valNoRows);

      const found = Object.keys(rows[0]);
      setHeaders(found);
      setSheetRows(rows);
      setColumns(detectColumns(found));
      setMatch(null);
      setLabel(file.name.replace(/\.[^.]+$/, ''));
    } catch (err: any) {
      toast.error(err.message);
      reset();
    } finally {
      setBusy(false);
    }
  };

  const mappedRows: AcademicRow[] = useMemo(() => {
    if (!columns) return [];
    const pick = (row: Record<string, unknown>, role: Role) =>
      columns[role] ? (row[columns[role]] as string | number) ?? null : null;
    return sheetRows.map(row => ({
      idNumber: pick(row, 'idNumber') as string | null,
      name: pick(row, 'name') as string | null,
      finalGrade: pick(row, 'finalGrade'),
      gradeMax: pick(row, 'gradeMax'),
      absences: pick(row, 'absences'),
      attendanceRate: pick(row, 'attendanceRate'),
      status: pick(row, 'status') as string | null
    }));
  }, [sheetRows, columns]);

  const runPreview = async () => {
    setBusy(true);
    try {
      const response = await learningApi.previewAcademic(turma, mappedRows);
      setMatch(response.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!columns) return;
    setBusy(true);
    const saved = await onImported(mappedRows, columns as Record<string, string>, label);
    setBusy(false);
    if (saved) { toast.success(t.valImported); reset(); onClose(); }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title={t.valImportTitle}
      icon={FileSpreadsheet}
      maxWidth="max-w-3xl"
      maxHeight="max-h-[90vh]"
    >
      <div className="space-y-5 overflow-y-auto">
        <p className="text-[11px] leading-relaxed text-text-dim">{t.valImportHint}</p>

        <label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-border-main bg-button px-6 py-8 text-[11px] font-black uppercase tracking-widest text-text-dim transition-all hover:border-accent/50 hover:text-accent">
          <Upload size={16} />
          {sheetRows.length ? t.valFileLoaded.replace('{rows}', String(sheetRows.length)) : t.valChooseFile}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            className="sr-only"
          />
        </label>

        {columns && (
          <>
            <div>
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">{t.valColumns}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {ROLES.map(role => (
                  <div key={role} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 text-[11px] text-text-main">
                      {t[`valRole_${role}`]}
                      {role === 'idNumber' && <span style={{ color: VIZ.critical }}> *</span>}
                    </span>
                    <select
                      value={columns[role]}
                      onChange={(event) => { setColumns({ ...columns, [role]: event.target.value }); setMatch(null); }}
                      className="flex-1 cursor-pointer rounded-lg border border-border-main bg-input px-2 py-1.5 text-[11px] text-text-main focus:border-accent focus:outline-none"
                    >
                      <option value="">{t.valColumnNone}</option>
                      {headers.map(header => <option key={header} value={header}>{header}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-[11px] text-text-main">{t.valSourceLabel}</span>
              <input
                type="text"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={t.valSourceLabelHint}
                className="flex-1 rounded-lg border border-border-main bg-input px-3 py-1.5 text-[11px] text-text-main focus:border-accent focus:outline-none"
              />
            </div>

            <button
              onClick={runPreview}
              disabled={busy || !columns.idNumber}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border-main bg-button py-2.5 text-[10px] font-black uppercase tracking-widest text-text-main transition-all active:scale-95 hover:border-accent/50 hover:text-accent disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {t.valPreviewMatch}
            </button>
          </>
        )}

        {match && (
          <div className="space-y-3 rounded-xl border border-border-main p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: t.valMatched, value: `${match.matched}/${match.totalStudents}` },
                { label: t.valMatchRate, value: `${formatNumber(match.matchRate, 1)}%` },
                { label: t.valSheetRows, value: String(match.rows) }
              ].map(item => (
                <div key={item.label} className="rounded-lg border border-border-main bg-button p-3">
                  <div className="text-lg font-black tabular-nums text-text-bright">{item.value}</div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-text-dim">{item.label}</div>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-text-dim">
              {t.valMatchBreakdown
                .replace('{id}', String(match.byIdNumber))
                .replace('{email}', String(match.byEmail))
                .replace('{name}', String(match.byName))}
            </p>

            {match.lowMatch && (
              <p className="flex items-start gap-2 text-[11px] leading-tight" style={{ color: VIZ.warning }}>
                <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {t.valLowMatch}
              </p>
            )}

            {match.unmatched.length > 0 && (
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-text-dim">
                  {t.valUnmatchedRows.replace('{count}', String(match.unmatched.length))}
                </div>
                <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto text-[11px] text-text-dim">
                  {match.unmatched.map((row, index) => (
                    <li key={index}>{row.idNumber || '—'} · {row.name || '—'}</li>
                  ))}
                </ul>
              </div>
            )}

            {match.withoutRow.length > 0 && (
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-text-dim">
                  {t.valStudentsWithoutRow.replace('{count}', String(match.withoutRow.length))}
                </div>
                <p className="mt-1 text-[11px] leading-tight text-text-dim">
                  {match.withoutRow.map(student => student.name).join(', ')}
                </p>
              </div>
            )}

            <button
              onClick={confirm}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-[10px] font-black uppercase tracking-widest text-black transition-all active:scale-95 hover:bg-accent/80 disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {t.valConfirmImport}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AcademicImportModal;
