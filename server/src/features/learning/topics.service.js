// Domínio conceitual: transforma notas por questão em evidência por conceito.
//
// Função pura sobre o dataset de estatísticas + o mapeamento questão→conceito.
// Roda a cada requisição, então mudar as regras aqui vale imediatamente para
// importações antigas, sem re-importar nada do Moodle.
//
// A regra que atravessa o arquivo: com 2–4 questões por conceito o número é
// grosseiro, então nada aqui finge precisão. Conceito com pouca evidência é
// declarado sem evidência, não recebe 0%.

const {
  submissionPercent, PASS_THRESHOLD, mean, median, round, rate
} = require('../statistics/statistics.service');

/** A partir daqui o conceito é considerado dominado. */
const MASTERY_THRESHOLD = 80;

/** Abaixo disso não há itens suficientes para afirmar nada sobre o conceito. */
const MIN_ITEMS_FOR_EVIDENCE = 2;

const STATUS = {
  MASTERED: 'mastered',
  PARTIAL: 'partial',
  GAP: 'gap',
  INSUFFICIENT: 'insufficient'
};

function classify(masteryPercent, itemCount) {
  if (itemCount < MIN_ITEMS_FOR_EVIDENCE || masteryPercent === null) return STATUS.INSUFFICIENT;
  if (masteryPercent >= MASTERY_THRESHOLD) return STATUS.MASTERED;
  if (masteryPercent >= PASS_THRESHOLD) return STATUS.PARTIAL;
  return STATUS.GAP;
}

/**
 * O conceito aparece no código do aluno? Usa o detector estático de
 * codeMetrics.js, que diz apenas se a construção apareceu no texto — não se
 * foi usada corretamente. É exatamente essa modéstia que torna o cruzamento
 * útil: construção ausente + nota baixa é um problema diferente de construção
 * presente + nota baixa.
 *
 * @returns {boolean|null} null quando o conceito não tem sinal estático confiável
 */
function detectCodeSignal(student, questionKeys, codeSignals) {
  if (!codeSignals || codeSignals.length === 0) return null;

  let sawAnyCode = false;
  for (const questionKey of questionKeys) {
    const concepts = student.questions?.[questionKey]?.codeMetrics?.concepts;
    if (!concepts) continue;
    sawAnyCode = true;
    if (codeSignals.some(signal => concepts[signal])) return true;
  }

  // Sem nenhum código analisado não dá para afirmar ausência.
  return sawAnyCode ? false : null;
}

/**
 * @param {object} dataset  stats_{turma}.json
 * @param {object} taxonomy taxonomia global vinculada
 * @param {object} mapping  { q1: [{code, weight}] }
 */
function computeMastery(dataset, taxonomy, mapping) {
  const questions = dataset?.questions || [];
  const students = dataset?.students || [];
  const topics = taxonomy?.topics || [];
  const questionByKey = new Map(questions.map(q => [q.key, q]));

  // conceito → questões que o avaliam, com o peso de cada uma
  const topicQuestions = new Map(topics.map(topic => [topic.code, []]));
  Object.entries(mapping || {}).forEach(([questionKey, entries]) => {
    if (!questionByKey.has(questionKey)) return;
    (entries || []).forEach(entry => {
      const list = topicQuestions.get(entry.code);
      if (list) list.push({ questionKey, weight: entry.weight });
    });
  });

  const studentRows = students.map(student => {
    const topicResults = {};

    topics.forEach(topic => {
      const items = topicQuestions.get(topic.code) || [];

      const evidence = items.map(item => {
        const question = questionByKey.get(item.questionKey);
        const submission = student.questions?.[item.questionKey];
        return {
          questionKey: item.questionKey,
          questionName: question?.name || item.questionKey,
          weight: item.weight,
          submitted: Boolean(submission?.submitted),
          percent: round(submissionPercent(submission, question))
        };
      });

      const graded = evidence.filter(e => e.percent !== null);
      const weightSum = graded.reduce((acc, e) => acc + e.weight, 0);
      const masteryPercent = weightSum > 0
        ? round(graded.reduce((acc, e) => acc + e.percent * e.weight, 0) / weightSum)
        : null;

      const percents = graded.map(e => e.percent);
      const status = classify(masteryPercent, graded.length);
      const codeSignalSeen = detectCodeSignal(student, items.map(i => i.questionKey), topic.codeSignals);

      topicResults[topic.code] = {
        mastery: status === STATUS.INSUFFICIENT ? null : masteryPercent,
        status,
        itemCount: graded.length,
        mappedCount: items.length,
        // Dispersão entre as questões do conceito: uma média de 60% vinda de
        // 20% e 100% conta uma história diferente de duas notas de 60%.
        spread: percents.length > 1 ? round(Math.max(...percents) - Math.min(...percents)) : null,
        codeSignalSeen,
        // Nota baixa e a construção sequer aparece: não chegou a tentar usar.
        untried: (status === STATUS.GAP || status === STATUS.PARTIAL) && codeSignalSeen === false,
        evidence
      };
    });

    return {
      userId: student.userId,
      folderName: student.folderName,
      name: student.name,
      email: student.email || null,
      topics: topicResults
    };
  });

  const topicRows = topics.map(topic => {
    const items = topicQuestions.get(topic.code) || [];
    const results = studentRows.map(row => row.topics[topic.code]);
    const withEvidence = results.filter(r => r.status !== STATUS.INSUFFICIENT);
    const masteries = withEvidence.map(r => r.mastery);
    const untriedCount = results.filter(r => r.untried).length;
    const notMastered = withEvidence.filter(r => r.status !== STATUS.MASTERED).length;

    return {
      code: topic.code,
      name: topic.name,
      description: topic.description || '',
      codeSignals: topic.codeSignals || [],
      questionKeys: items.map(i => i.questionKey),
      questionCount: items.length,
      studentsWithEvidence: withEvidence.length,
      totalStudents: studentRows.length,
      avgMastery: round(mean(masteries)),
      medianMastery: round(median(masteries)),
      distribution: {
        mastered: results.filter(r => r.status === STATUS.MASTERED).length,
        partial: results.filter(r => r.status === STATUS.PARTIAL).length,
        gap: results.filter(r => r.status === STATUS.GAP).length,
        insufficient: results.filter(r => r.status === STATUS.INSUFFICIENT).length
      },
      untriedCount,
      // Entre quem não domina o conceito, quantos sequer usaram a construção.
      untriedRate: rate(untriedCount, notMastered)
    };
  });

  const mappedKeys = new Set(Object.keys(mapping || {}).filter(key => (mapping[key] || []).length > 0));

  return {
    taxonomyId: taxonomy?.id || null,
    taxonomyName: taxonomy?.name || null,
    thresholds: { mastered: MASTERY_THRESHOLD, partial: PASS_THRESHOLD, minItems: MIN_ITEMS_FOR_EVIDENCE },
    topics: topicRows,
    students: studentRows,
    coverage: {
      mappedQuestions: mappedKeys.size,
      totalQuestions: questions.length,
      unmappedQuestions: questions.filter(q => !mappedKeys.has(q.key)).map(q => ({ key: q.key, name: q.name }))
    }
  };
}

module.exports = { computeMastery, STATUS, MASTERY_THRESHOLD, MIN_ITEMS_FOR_EVIDENCE };
