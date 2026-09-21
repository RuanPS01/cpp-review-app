// O desfecho contra o qual os indicadores são conferidos.
//
// Sem um desfecho, os indicadores são plausíveis, não validados: "engajamento
// baixo" é uma hipótese de quem escreveu o código. O desfecho é o que dá lastro
// — e a escolha da fonte muda o que a associação pode significar, então a fonte
// viaja junto do resultado em vez de ficar implícita.

const { normalizeKey, loadProfessorGrades, mean } = require('../statistics/statistics.service');

const KINDS = ['finalGrade', 'failed', 'dropout'];
const SOURCES = ['academic', 'professorGrades', 'manual'];

const DEFAULT_CUT = 60;

/**
 * Quanto a fonte do desfecho é independente das notas do VPL que alimentam
 * metade dos indicadores. Nenhuma é totalmente — e a tela diz isso.
 */
const INDEPENDENCE = {
  academic: 'partial',        // a nota do portal costuma incluir as próprias atividades do VPL
  professorGrades: 'low',     // outro avaliador, os mesmos artefatos
  manual: 'high'              // julgamento do professor, mas julgamento
};

function emptyOutcome() {
  return {
    version: 1,
    kind: 'finalGrade',
    source: 'academic',
    cut: DEFAULT_CUT,
    /** Peso das atividades VPL na nota final, em %, quando o professor souber. */
    vplWeight: null,
    periodoLetivo: null,
    manual: {},
    updatedAt: null
  };
}

function normalizeConfig(config) {
  const base = emptyOutcome();
  if (!config) return base;
  return {
    ...base,
    ...config,
    kind: KINDS.includes(config.kind) ? config.kind : base.kind,
    source: SOURCES.includes(config.source) ? config.source : base.source,
    cut: Number.isFinite(Number(config.cut)) ? Number(config.cut) : base.cut,
    vplWeight: Number.isFinite(Number(config.vplWeight)) ? Number(config.vplWeight) : null,
    manual: config.manual && typeof config.manual === 'object' ? config.manual : {}
  };
}

/** Média percentual do professor por aluno, a partir de `grades_turma_{turma}.json`. */
function professorPercentByStudent(dataset) {
  const grades = loadProfessorGrades(dataset.turma);
  if (!grades || !grades.length) return null;

  const byEmail = new Map();
  const byName = new Map();
  grades.forEach(entry => {
    const scores = Object.values(entry.questions || {})
      .map(question => question?.score)
      .filter(score => typeof score === 'number');
    if (!scores.length) return;
    // A escala do app é 0–10; o desfecho é percentual para bater com o resto.
    const percent = Math.max(0, Math.min(100, mean(scores) * 10));
    if (entry.email) byEmail.set(normalizeKey(entry.email), percent);
    if (entry.name) byName.set(normalizeKey(entry.name), percent);
  });

  const result = new Map();
  (dataset.students || []).forEach(student => {
    const percent = (student.email && byEmail.get(normalizeKey(student.email)))
      ?? (student.name && byName.get(normalizeKey(student.name)))
      ?? null;
    if (percent !== null && percent !== undefined) {
      result.set(String(student.userId ?? student.folderName), percent);
    }
  });
  return result;
}

/**
 * Resolve o desfecho por aluno.
 *
 * @returns {{
 *   kind, source, binary, cut, independence,
 *   values: Map<string, number|null>,
 *   defined: number, total: number,
 *   warnings: string[], available: boolean
 * }}
 */
function resolveOutcome(dataset, config, academic) {
  const settings = normalizeConfig(config);
  const students = dataset.students || [];
  const values = new Map();
  const warnings = [];

  const binary = settings.kind !== 'finalGrade';

  const academicByUser = academic?.students || {};
  const professorPercent = settings.source === 'professorGrades'
    ? professorPercentByStudent(dataset)
    : null;

  if (settings.source === 'academic' && !Object.keys(academicByUser).length) {
    warnings.push('Nenhuma planilha do portal foi importada para esta turma.');
  }
  if (settings.source === 'professorGrades' && (!professorPercent || !professorPercent.size)) {
    warnings.push('Esta turma não tem notas lançadas pelo professor no app.');
  }
  if (settings.source === 'academic' && academic?.match?.lowMatch) {
    warnings.push(
      `Só ${academic.match.matchRate}% dos alunos casaram com a planilha. `
      + 'O desfecho descreve o subgrupo que casou, não a turma.'
    );
  }

  students.forEach(student => {
    const key = String(student.userId ?? student.folderName);
    let value = null;

    if (settings.kind === 'dropout') {
      // Evasão nunca sai de nota: ou o professor marca, ou o portal traz o status.
      const status = academicByUser[key]?.status || '';
      const flagged = settings.manual[key] === true || /trancad|evad|desist|cancelad/i.test(status);
      value = settings.source === 'manual' || status ? (flagged ? 1 : 0) : null;
    } else {
      const percent = settings.source === 'academic'
        ? academicByUser[key]?.gradePercent ?? null
        : settings.source === 'professorGrades'
          ? professorPercent?.get(key) ?? null
          : null;

      if (settings.kind === 'finalGrade') {
        value = percent;
      } else if (settings.source === 'manual') {
        // Marcação manual: só quem foi marcado é reprovado; o resto é aprovado.
        value = settings.manual[key] === true ? 1 : 0;
      } else {
        value = percent === null ? null : (percent < settings.cut ? 1 : 0);
      }
    }

    values.set(key, value);
  });

  const defined = [...values.values()].filter(value => value !== null).length;

  if (binary && defined > 0) {
    const positive = [...values.values()].filter(value => value === 1).length;
    if (positive === 0 || positive === defined) {
      warnings.push('O desfecho binário não tem os dois grupos nesta turma: não há o que comparar.');
    }
  }
  if (settings.kind === 'failed' && settings.source !== 'manual') {
    warnings.push(
      'Dicotomizar uma nota contínua joga informação fora. '
      + 'Quando houver nota, prefira o desfecho "nota final" — ele é mais estável.'
    );
  }

  return {
    ...settings,
    binary,
    independence: INDEPENDENCE[settings.source],
    values,
    defined,
    total: students.length,
    available: defined > 0,
    warnings
  };
}

module.exports = {
  emptyOutcome,
  normalizeConfig,
  resolveOutcome,
  professorPercentByStudent,
  KINDS,
  SOURCES,
  INDEPENDENCE,
  DEFAULT_CUT
};
