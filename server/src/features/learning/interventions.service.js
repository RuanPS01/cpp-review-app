// Registro de intervenções e o acompanhamento entre importações.
//
// O que este módulo **não** faz é tão importante quanto o que faz: ele não
// afirma que uma intervenção funcionou. O aluno é escolhido justamente por
// estar pior, então tende a melhorar sozinho — regressão à média. Sem
// randomização não há como separar o efeito da intervenção do retorno natural
// ao meio da distribuição.
//
// O que ele entrega é o registro longitudinal, que hoje não existe em lugar
// nenhum: o que foi feito, por que, quando, e como o aluno estava naquele
// momento. Sem o `baseline` gravado não há o que comparar depois, porque o
// dataset é sobrescrito a cada reimportação.

const { mean, round } = require('../statistics/statistics.service');

const ACTIONS = ['socraticPackage', 'individualContact', 'studyPlan', 'reviewSession', 'other'];
const STATUSES = ['planned', 'done', 'abandoned'];

function emptyRegistry() {
  return { version: 1, entries: [], snapshots: {} };
}

const randomId = () => `iv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Retrato da turma inteira no momento da importação corrente.
 *
 * Um retrato por importação, e não um por intervenção: é o que permite montar
 * depois um grupo de comparação com alunos que **não** receberam intervenção
 * mas estavam no mesmo patamar — sem isso, a comparação seria contra o aluno
 * médio, que nunca esteve onde o aluno intervindo estava.
 */
function buildSnapshot(dataset, indicators, mastery) {
  const masteryByUser = new Map((mastery?.students || []).map(s => [String(s.userId), s]));
  const students = {};

  (indicators.students || []).forEach(row => {
    const key = String(row.userId ?? row.folderName);
    const values = {};
    Object.entries(row.dimensions).forEach(([dimension, entries]) => {
      Object.entries(entries).forEach(([indicator, payload]) => {
        if (payload?.available) values[`${dimension}.${indicator}`] = payload.value;
      });
    });

    const topics = {};
    const masteryRow = masteryByUser.get(key);
    if (masteryRow) {
      Object.entries(masteryRow.topics).forEach(([code, result]) => {
        if (result.mastery !== null) topics[code] = result.mastery;
      });
    }

    values['learning.avgMastery'] = values['learning.avgMastery'] ?? null;
    students[key] = { indicators: values, topics, avgPercent: studentAverage(dataset, key) };
  });

  return { at: Date.now(), importedAt: dataset.importedAt, students };
}

/** Média percentual do aluno nas questões entregues, direto do dataset. */
function studentAverage(dataset, key) {
  const student = (dataset.students || [])
    .find(s => String(s.userId ?? s.folderName) === key);
  if (!student) return null;

  const maxByKey = new Map((dataset.questions || [])
    .map(q => [q.key, q.maxGrade && q.maxGrade > 0 ? q.maxGrade : 10]));
  const percents = Object.entries(student.questions || {})
    .filter(([, submission]) => submission?.submitted && typeof submission.grade === 'number')
    .map(([key2, submission]) => (submission.grade / (maxByKey.get(key2) || 10)) * 100);

  return percents.length ? round(mean(percents)) : null;
}

/** Terços da distribuição, para parear o grupo de comparação. */
function tercile(value, population) {
  const sorted = population.filter(v => typeof v === 'number').sort((a, b) => a - b);
  if (sorted.length < 3 || typeof value !== 'number') return null;
  const low = sorted[Math.floor(sorted.length / 3)];
  const high = sorted[Math.floor((2 * sorted.length) / 3)];
  return value <= low ? 'low' : value <= high ? 'mid' : 'high';
}

/**
 * Acompanhamento: como estão hoje os alunos que receberam intervenção, e como
 * estão os que estavam no mesmo patamar e não receberam.
 *
 * O grupo de comparação **não é randomizado** — quem recebeu foi escolhido pelo
 * professor, provavelmente pelos mesmos sinais que não aparecem aqui. Ele serve
 * para dar escala à variação, não para atribuir causa.
 */
function computeFollowup(dataset, registry, snapshotsUsed) {
  const entries = registry.entries || [];
  if (!entries.length) {
    return { available: false, reason: 'noEntries', groups: [], entries: [] };
  }

  const bySnapshot = new Map();
  entries.forEach(entry => {
    if (!entry.snapshotId) return;
    if (!bySnapshot.has(entry.snapshotId)) bySnapshot.set(entry.snapshotId, []);
    bySnapshot.get(entry.snapshotId).push(entry);
  });

  const groups = [];
  const detailed = [];

  bySnapshot.forEach((groupEntries, snapshotId) => {
    const snapshot = (registry.snapshots || {})[snapshotId];
    if (!snapshot) return;

    // Mesma importação: ainda não houve um "depois" para observar.
    const stale = snapshot.importedAt === dataset.importedAt;

    const intervened = new Set(groupEntries.map(entry => String(entry.userId)));
    const population = Object.values(snapshot.students)
      .map(student => student.avgPercent)
      .filter(value => typeof value === 'number');

    const deltaOf = (key) => {
      const before = snapshot.students[key]?.avgPercent ?? null;
      const after = studentAverage(dataset, key);
      if (before === null || after === null) return null;
      return { before, after, delta: round(after - before) };
    };

    const treated = [];
    const control = [];

    Object.keys(snapshot.students).forEach(key => {
      const movement = deltaOf(key);
      if (!movement) return;
      const band = tercile(snapshot.students[key].avgPercent, population);
      if (intervened.has(key)) treated.push({ key, band, ...movement });
      else control.push({ key, band, ...movement });
    });

    // Só entram na comparação os não intervindos das mesmas faixas.
    const treatedBands = new Set(treated.map(item => item.band).filter(Boolean));
    const matched = control.filter(item => treatedBands.has(item.band));

    groups.push({
      snapshotId,
      snapshotAt: snapshot.at,
      stale,
      bands: [...treatedBands],
      treated: {
        n: treated.length,
        meanBefore: round(mean(treated.map(item => item.before))),
        meanAfter: round(mean(treated.map(item => item.after))),
        meanDelta: round(mean(treated.map(item => item.delta)))
      },
      comparison: {
        n: matched.length,
        meanBefore: round(mean(matched.map(item => item.before))),
        meanAfter: round(mean(matched.map(item => item.after))),
        meanDelta: round(mean(matched.map(item => item.delta)))
      }
    });

    groupEntries.forEach(entry => {
      const movement = deltaOf(String(entry.userId));
      detailed.push({ ...entry, movement, stale });
    });
  });

  return {
    available: groups.some(group => !group.stale),
    reason: groups.every(group => group.stale) ? 'sameImport' : null,
    groups,
    entries: detailed,
    snapshotsUsed: snapshotsUsed ?? bySnapshot.size
  };
}

/** Cria a entrada e, se ainda não houver retrato desta importação, cria um. */
function addEntry(registry, { dataset, indicators, mastery, entry }) {
  const next = { ...emptyRegistry(), ...registry };
  next.snapshots = { ...next.snapshots };
  next.entries = [...(next.entries || [])];

  let snapshotId = Object.keys(next.snapshots)
    .find(id => next.snapshots[id].importedAt === dataset.importedAt);

  if (!snapshotId) {
    snapshotId = `snap_${dataset.importedAt}`;
    next.snapshots[snapshotId] = buildSnapshot(dataset, indicators, mastery);
  }

  const snapshot = next.snapshots[snapshotId];
  const key = String(entry.userId);

  next.entries.push({
    id: randomId(),
    userId: entry.userId,
    name: entry.name || null,
    createdAt: Date.now(),
    pattern: entry.pattern || null,
    topic: entry.topic || null,
    action: ACTIONS.includes(entry.action) ? entry.action : 'other',
    note: String(entry.note || '').slice(0, 2000),
    status: STATUSES.includes(entry.status) ? entry.status : 'planned',
    snapshotId,
    baseline: {
      importedAt: dataset.importedAt,
      avgPercent: snapshot.students[key]?.avgPercent ?? null,
      indicators: snapshot.students[key]?.indicators ?? {},
      topics: snapshot.students[key]?.topics ?? {}
    }
  });

  return next;
}

function updateEntry(registry, id, patch) {
  const next = { ...emptyRegistry(), ...registry };
  next.entries = (next.entries || []).map(entry => {
    if (entry.id !== id) return entry;
    return {
      ...entry,
      status: STATUSES.includes(patch.status) ? patch.status : entry.status,
      note: patch.note === undefined ? entry.note : String(patch.note).slice(0, 2000),
      updatedAt: Date.now()
    };
  });
  return next;
}

function removeEntry(registry, id) {
  const next = { ...emptyRegistry(), ...registry };
  next.entries = (next.entries || []).filter(entry => entry.id !== id);

  // Retrato sem nenhuma intervenção apontando para ele vira peso morto.
  const used = new Set(next.entries.map(entry => entry.snapshotId));
  next.snapshots = Object.fromEntries(
    Object.entries(next.snapshots || {}).filter(([id2]) => used.has(id2))
  );
  return next;
}

module.exports = {
  emptyRegistry,
  buildSnapshot,
  computeFollowup,
  addEntry,
  updateEntry,
  removeEntry,
  studentAverage,
  tercile,
  ACTIONS,
  STATUSES
};
