// Prompt de sugestão do mapeamento questão→conceito.
//
// Mapear é trabalho manual do professor e a proposta de analytics aponta isso
// como possível gargalo. A IA propõe, o professor revisa: por isso cada
// sugestão carrega um `rationale` — sem a justificativa, aprovar em lote seria
// aprovar no escuro.

const MAX_STATEMENT_CHARS = 1200;
const MAX_TEST_CASES = 6;

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
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

/**
 * @param {object} options
 * @param {object} options.taxonomy conceitos já cadastrados
 * @param {object} options.metrics  saída de computeMetrics (traz conceptUsage por questão)
 * @param {object} options.dataset  dataset bruto (traz enunciado e casos de teste)
 */
function buildTaxonomySuggestionPrompt({ taxonomy, metrics, dataset }) {
  const questionMetrics = new Map((metrics?.questions || []).map(q => [q.key, q]));

  const questions = (dataset?.questions || []).map(question => {
    const stats = questionMetrics.get(question.key);

    // Evidência empírica: quais construções de C++ os alunos realmente usaram
    // nesta questão. Vale mais que o enunciado sozinho para inferir o conceito.
    const observed = Object.entries(stats?.conceptUsage || {})
      .filter(([, usage]) => usage.total > 0 && usage.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([key, usage]) => `${key} (${usage.count}/${usage.total} alunos)`);

    return {
      chave: question.key,
      nome: question.name,
      secao: question.section || null,
      enunciado: truncate(stripHtml(question.statement), MAX_STATEMENT_CHARS) || '(não capturado na importação)',
      casosDeTeste: (question.testCases || []).slice(0, MAX_TEST_CASES).map(tc => tc.name).filter(Boolean),
      construcoesObservadasNosCodigos: observed
    };
  });

  const systemPrompt = [
    'Você é um assistente pedagógico especializado em ensino de programação em C++.',
    'Sua tarefa é associar exercícios a conceitos de uma taxonomia curricular.',
    'Responda SOMENTE com JSON válido, sem texto antes ou depois, sem blocos de código markdown.',
    'Regras: use preferencialmente os conceitos já cadastrados; proponha um conceito novo apenas quando nenhum existente servir.',
    'Cada questão deve ter no máximo um conceito principal (weight 1) e até dois secundários (weight 0.5).',
    'O campo "rationale" é obrigatório e deve citar a evidência concreta que justifica a associação (trecho do enunciado, caso de teste ou construção observada).',
    'Não invente evidência: se o enunciado não foi capturado, diga isso no rationale e baseie-se nas construções observadas.'
  ].join(' ');

  const userPrompt = [
    'Associe cada questão aos conceitos da taxonomia.',
    '',
    'CONCEITOS JÁ CADASTRADOS (JSON):',
    JSON.stringify((taxonomy?.topics || []).map(t => ({ code: t.code, name: t.name, description: t.description })), null, 1),
    '',
    'QUESTÕES (JSON):',
    JSON.stringify(questions, null, 1),
    '',
    'Devolva exatamente este formato:',
    JSON.stringify({
      novosTopicos: [{ code: 'AL10', name: 'Nome do conceito', rationale: 'por que falta na taxonomia' }],
      mapeamento: {
        q1: [{ code: 'AL04', weight: 1, rationale: 'o enunciado pede soma acumulada em um laço' }]
      }
    }, null, 1)
  ].join('\n');

  return { systemPrompt, userPrompt };
}

// ---------------------------------------------------------------------------
// Pacote socrático
// ---------------------------------------------------------------------------

const MAX_CODE_CHARS = 1800;

/**
 * As regras negativas da proposta de tutoria socrática.
 *
 * São texto fixo de propósito: se a IA pudesse reescrevê-las, o pacote deixaria
 * de ser socrático no primeiro prompt em que o modelo achasse mais gentil dar a
 * resposta. Elas entram no `.md` verbatim, fora do que o modelo gera.
 */
const SOCRATIC_RULES = [
  'Não dê a resposta pronta nem escreva a solução completa, em nenhuma hipótese.',
  'Exija uma tentativa do aluno antes de qualquer dica, e parta do que ele escreveu.',
  'Uma pergunta por vez. Espere a resposta antes da próxima.',
  'Não confirme como correta uma solução incompleta: aponte o caso que ainda falha.',
  'Se o aluno pedir o código, recuse e devolva a pergunta que o aproxima do próximo passo.',
  'Trate o erro como informação, não como falha do aluno.'
];

/**
 * Perguntas-guia para o erro daquele aluno naquela questão.
 *
 * O que a IA gera é só isso: o diagnóstico e as perguntas. O enunciado, os
 * casos reprovados e o código vêm dos dados, e as regras vêm da constante
 * acima — nada disso passa pelo modelo, que não teria por que reescrevê-los.
 */
function buildSocraticPackagePrompt({ scope, topic, question, student, submission, lang = 'pt-BR' }) {
  const language = lang === 'en-US' ? 'English' : 'português do Brasil';

  const systemPrompt = [
    'Você ajuda um professor de programação em C++ a preparar uma sessão de tutoria socrática.',
    'Você NÃO conversa com o aluno: você escreve o roteiro que o professor vai usar.',
    'Nunca escreva código de solução, nem trechos que resolvam o exercício.',
    'Baseie-se apenas nos dados fornecidos; quando faltar um dado, diga que falta.',
    `Responda SEMPRE em ${language}, em Markdown, com títulos curtos (##).`,
    'Responda SOMENTE com JSON válido, sem texto antes ou depois, sem blocos de código markdown.'
  ].join(' ');

  const context = {
    escopo: scope,
    conceito: topic ? { codigo: topic.code, nome: topic.name, descricao: topic.description || null } : null,
    questao: question ? {
      nome: question.name,
      enunciado: truncate(stripHtml(question.statement), MAX_STATEMENT_CHARS),
      casosDeTeste: (question.testCases || []).slice(0, MAX_TEST_CASES).map(c => c.name)
    } : null,
    aluno: student ? { nome: student.name } : null,
    entrega: submission ? {
      nota: submission.grade,
      tentativas: submission.attempts,
      casosReprovados: submission.failedCases || [],
      errosDeCompilacao: (submission.compileErrors || []).slice(0, 5),
      codigo: truncate(submission.code, MAX_CODE_CHARS)
    } : null
  };

  const userPrompt = [
    scope === 'topic'
      ? 'Monte um roteiro de tutoria socrática sobre o conceito abaixo, para usar com a turma.'
      : 'Monte um roteiro de tutoria socrática para este aluno, a partir do erro dele nesta questão.',
    '',
    'DADOS (JSON):',
    JSON.stringify(context, null, 1),
    '',
    'Devolva exatamente este formato:',
    JSON.stringify({
      diagnostico: 'em uma ou duas frases, qual é a lacuna de entendimento provável e por quê',
      perguntas: [
        { pergunta: 'a pergunta a fazer', objetivo: 'o que ela verifica', seNaoSouber: 'a dica menor a dar, ainda sem resolver' }
      ],
      andaime: 'quanto apoio dar, e o que NÃO adiantar nesta sessão',
      sinalDeAvanco: 'o que o aluno precisa dizer ou escrever para considerar que entendeu'
    }, null, 1)
  ].join('\n');

  return { systemPrompt, userPrompt };
}

module.exports = { buildTaxonomySuggestionPrompt, buildSocraticPackagePrompt, SOCRATIC_RULES };
