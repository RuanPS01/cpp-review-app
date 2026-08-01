// Montagem dos prompts pedagógicos da tela de Estatísticas.
//
// Cada relatório recebe apenas o recorte de dados de que precisa: enviar o
// dataset inteiro estoura o contexto dos modelos locais (Ollama) e piora a
// qualidade da resposta. Os códigos são amostrados e truncados.

const MAX_CODE_CHARS = 2500;
const MAX_STATEMENT_CHARS = 1500;

const LANGUAGE_NAMES = {
  'pt-BR': 'português do Brasil',
  'en-US': 'English'
};

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text, limit) {
  const value = String(text || '');
  return value.length > limit ? `${value.slice(0, limit)}\n[...truncado...]` : value;
}

function systemPrompt(lang) {
  const language = LANGUAGE_NAMES[lang] || LANGUAGE_NAMES['pt-BR'];
  return [
    'Você é um assistente pedagógico especializado em ensino de programação em C++.',
    'Analisa dados reais de uma turma (entregas, notas automáticas do VPL/Moodle e código-fonte dos alunos).',
    `Responda SEMPRE em ${language}, em Markdown, com títulos curtos (##) e listas objetivas.`,
    'Regras: baseie-se apenas nos dados fornecidos; não invente números; quando um dado não estiver disponível, diga isso explicitamente.',
    'Seja específico e acionável — o leitor é o professor da turma, que precisa decidir o que fazer na próxima aula.',
    'Não exponha julgamentos sobre os alunos como pessoas; fale sobre evidências de aprendizagem e sobre intervenções.'
  ].join(' ');
}

/** Recorta o essencial das métricas para caber com folga no contexto do modelo. */
function summarizeMetrics(metrics) {
  return {
    turma: metrics.turma,
    curso: metrics.courseName,
    secao: metrics.sectionName,
    visaoGeral: metrics.overview,
    questoes: metrics.questions.map(q => ({
      questao: q.name,
      taxaEntrega: q.submissionRate,
      mediaPercentual: q.avgPercent,
      medianaPercentual: q.medianPercent,
      desvioPadrao: q.stdDevPercent,
      taxaAprovacao: q.passRate,
      indiceDificuldade: q.difficultyIndex,
      zeros: q.zeroCount,
      notasMaximas: q.perfectCount,
      taxaErroCompilacao: q.compileErrorRate,
      mediaTentativas: q.avgAttempts,
      entregasAtrasadas: q.lateCount,
      casosDeTesteQueMaisFalharam: q.topFailedCases.slice(0, 5),
      errosDeCompilacaoFrequentes: q.topCompileErrors.slice(0, 5)
    })),
    engajamento: {
      totalSubmissoes: metrics.engagement.totalSubmissions,
      alunosAtivos: metrics.engagement.activeStudents,
      alunosSemNenhumaEntrega: metrics.engagement.inactiveStudents,
      mediaTentativas: metrics.engagement.avgAttemptsPerSubmission,
      horaDePico: metrics.engagement.peakHour,
      antecedenciaDasEntregas: metrics.engagement.leadTimes.map(b => ({ faixa: b.label, quantidade: b.count }))
    },
    usoDeConceitos: metrics.conceptCoverage.map(c => ({ conceito: c.label, percentualDeAlunos: c.rate })),
    praticasDetectadas: metrics.smellCounts.map(s => ({ pratica: s.label, percentualDeSubmissoes: s.rate })),
    risco: metrics.overview.riskBuckets
  };
}

function buildOverviewPrompt({ metrics, lang }) {
  return {
    systemPrompt: systemPrompt(lang),
    userPrompt: [
      'Gere um diagnóstico geral da turma a partir dos dados abaixo.',
      '',
      'Estruture a resposta com estas seções:',
      '## Panorama — 3 a 5 frases interpretando os números principais.',
      '## Evidências de engajamento — o que os dados de entrega, tentativas e horários mostram.',
      '## Onde a turma está travando — conceitos e questões com maior dificuldade, citando os números.',
      '## Alunos que precisam de atenção — o que o perfil de risco indica (sem listar nomes, use os agregados).',
      '## Próximos passos — 3 a 5 ações concretas para a próxima aula.',
      '',
      'DADOS (JSON):',
      JSON.stringify(summarizeMetrics(metrics), null, 1)
    ].join('\n')
  };
}

function buildQuestionPrompt({ metrics, dataset, questionKey, lang }) {
  const question = metrics.questions.find(q => q.key === questionKey);
  const rawQuestion = (dataset.questions || []).find(q => q.key === questionKey);
  if (!question || !rawQuestion) throw new Error('Questão não encontrada no dataset.');

  // Amostra: as piores submissões revelam o erro conceitual; uma ou duas boas
  // servem de contraste para o modelo não confundir estilo com erro.
  const submissions = (dataset.students || [])
    .map(student => ({ student, submission: student.questions?.[questionKey] }))
    .filter(entry => entry.submission?.submitted && entry.submission.code)
    .sort((a, b) => (a.submission.grade ?? 0) - (b.submission.grade ?? 0));

  const sample = [...submissions.slice(0, 5), ...submissions.slice(-2)]
    .filter((entry, index, list) => list.findIndex(e => e.student.userId === entry.student.userId) === index);

  const codeBlocks = sample.map((entry, index) => [
    `### Amostra ${index + 1} — nota automática: ${entry.submission.grade ?? 'sem nota'} / ${question.maxGrade}`,
    entry.submission.failedCases?.length ? `Casos reprovados: ${entry.submission.failedCases.join(', ')}` : '',
    entry.submission.compileErrors?.length ? `Erros de compilação: ${entry.submission.compileErrors.join(' | ')}` : '',
    '```cpp',
    truncate(entry.submission.code, MAX_CODE_CHARS),
    '```'
  ].filter(Boolean).join('\n'));

  return {
    systemPrompt: systemPrompt(lang),
    userPrompt: [
      `Analise a dificuldade da questão "${question.name}" para esta turma.`,
      '',
      'Estruture a resposta com estas seções:',
      '## Diagnóstico da questão — o que os números dizem sobre a dificuldade.',
      '## Erros conceituais recorrentes — padrões observados nos códigos das amostras, com trechos citados.',
      '## O que os casos de teste reprovados revelam.',
      '## Como intervir — explicação, exercício ou material sugerido para corrigir a lacuna.',
      '',
      'ENUNCIADO:',
      truncate(stripHtml(rawQuestion.statement), MAX_STATEMENT_CHARS) || '(enunciado não capturado na importação)',
      '',
      'CASOS DE TESTE:',
      (rawQuestion.testCases || []).slice(0, 8).map(tc => `- ${tc.name}: entrada "${truncate(tc.input, 120)}" → saída "${truncate(tc.output, 120)}"`).join('\n')
        || '(casos de teste não capturados)',
      '',
      'MÉTRICAS DA QUESTÃO (JSON):',
      JSON.stringify(question, null, 1),
      '',
      'AMOSTRAS DE CÓDIGO DOS ALUNOS:',
      codeBlocks.join('\n\n') || '(nenhum código disponível para esta questão)'
    ].join('\n')
  };
}

function buildStudentPrompt({ metrics, dataset, userId, lang }) {
  const student = metrics.students.find(s => String(s.userId) === String(userId));
  const rawStudent = (dataset.students || []).find(s => String(s.userId) === String(userId));
  if (!student || !rawStudent) throw new Error('Aluno não encontrado no dataset.');

  const codeBlocks = (dataset.questions || [])
    .map(question => {
      const submission = rawStudent.questions?.[question.key];
      if (!submission?.code) return null;
      return [
        `### ${question.name} — nota automática: ${submission.grade ?? 'sem nota'}`,
        submission.failedCases?.length ? `Casos reprovados: ${submission.failedCases.join(', ')}` : '',
        '```cpp',
        truncate(submission.code, MAX_CODE_CHARS),
        '```'
      ].filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .slice(0, 5);

  return {
    systemPrompt: systemPrompt(lang),
    userPrompt: [
      `Faça um diagnóstico individual do aluno ${student.name}.`,
      '',
      'Estruture a resposta com estas seções:',
      '## Situação — leitura objetiva do desempenho e da participação.',
      '## Pontos fortes — o que o código mostra que o aluno já domina.',
      '## Dificuldades — lacunas conceituais evidenciadas pelo código e pelos casos reprovados.',
      '## Plano de apoio — 3 ações específicas para este aluno.',
      '',
      'MÉTRICAS DO ALUNO (JSON):',
      JSON.stringify({
        entregas: `${student.submittedCount}/${student.questionCount}`,
        mediaPercentual: student.avgPercent,
        melhorNota: student.bestPercent,
        piorNota: student.worstPercent,
        tentativasTotais: student.totalAttempts,
        entregasAtrasadas: student.lateCount,
        errosDeCompilacao: student.compileErrorCount,
        risco: student.risk,
        questoes: student.questions
      }, null, 1),
      '',
      'MÉDIA DA TURMA PARA COMPARAÇÃO:',
      JSON.stringify({ mediaTurma: metrics.overview.avgPercent, taxaEntregaTurma: metrics.overview.submissionRate }, null, 1),
      '',
      'CÓDIGOS DO ALUNO:',
      codeBlocks.join('\n\n') || '(nenhum código submetido)'
    ].join('\n')
  };
}

function buildAlertsPrompt({ metrics, lang }) {
  const alerts = metrics.alerts.slice(0, 25).map(student => ({
    nome: student.name,
    risco: student.risk.level,
    score: student.risk.score,
    motivos: student.risk.reasons.map(r => r.code),
    entregas: `${student.submittedCount}/${student.questionCount}`,
    mediaPercentual: student.avgPercent,
    atrasos: student.lateCount,
    ultimaEntrega: student.lastSubmissionAt
  }));

  return {
    systemPrompt: systemPrompt(lang),
    userPrompt: [
      'Monte um plano de intervenção para os alunos sinalizados abaixo.',
      '',
      'Estruture a resposta com estas seções:',
      '## Prioridade imediata — quem procurar primeiro e por quê.',
      '## Grupos com o mesmo problema — agrupe alunos que compartilham a mesma causa e proponha uma ação coletiva.',
      '## Mensagens sugeridas — um modelo curto de mensagem para cada grupo.',
      '## O que monitorar na próxima semana.',
      '',
      'CONTEXTO DA TURMA (JSON):',
      JSON.stringify({ visaoGeral: metrics.overview, risco: metrics.overview.riskBuckets }, null, 1),
      '',
      'ALUNOS SINALIZADOS (JSON):',
      JSON.stringify(alerts, null, 1)
    ].join('\n')
  };
}

const BUILDERS = {
  overview: buildOverviewPrompt,
  question: buildQuestionPrompt,
  student: buildStudentPrompt,
  alerts: buildAlertsPrompt
};

function buildPrompt(kind, context) {
  const builder = BUILDERS[kind];
  if (!builder) throw new Error(`Tipo de relatório desconhecido: ${kind}`);
  return builder(context);
}

module.exports = { buildPrompt, REPORT_KINDS: Object.keys(BUILDERS) };
