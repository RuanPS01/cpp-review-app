// O pacote consolidado — o que os três projetos querem junto.
//
// Cada projeto tem um terço do mesmo aluno: este app tem o comportamento no
// Moodle e o domínio conceitual, o PortalHelper tem a nota formal e a
// frequência, a tutoria socrática tem a intervenção. A chave que liga os três é
// a **matrícula**.
//
// O PortalHelper ainda não tem schema — o repositório dele entrega dados
// simulados e o DISCOVERY.md é um passeio pela navegação do portal. Não dá para
// exportar "no formato dele". Então o pacote é **autodescrito**: vai com um
// dicionário de dados e um LEIA-ME, e quem o ler não precisa combinar formato
// com ninguém antes.
//
// A declaração das colunas é única (`TABLES`) e serve tanto para escrever o CSV
// quanto para gerar o dicionário. Se fossem duas listas, o dicionário passaria a
// mentir sobre os dados no primeiro campo novo — o que é pior que não ter.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const { DATA_DIR } = require('../../config/env');
const { statisticsPaths, readJsonFile, isDatasetFile } = require('../statistics/statistics.paths');
const { STATS_DIR } = require('../../config/env');
const { computeIndicators, DIMENSIONS } = require('./indicators.service');
const { computeMastery } = require('./topics.service');
const taxonomyService = require('./taxonomy.service');
const outcomeService = require('./outcome.service');
const { studentAverage } = require('./interventions.service');

const SCHEMA_VERSION = 1;
const SALT_FILE = path.join(DATA_DIR, 'export-salt.txt');

// ---------------------------------------------------------------------------
// Pseudonimização
// ---------------------------------------------------------------------------

/**
 * O sal vive fora do pacote e é gerado uma vez por instalação.
 *
 * É ele que faz o mesmo aluno manter o mesmo identificador entre exportações —
 * sem isso a base longitudinal não liga nada — sem que o identificador possa
 * ser revertido por quem recebe o pacote.
 */
function readSalt() {
  if (!fs.existsSync(SALT_FILE)) {
    fs.writeFileSync(SALT_FILE, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  }
  return fs.readFileSync(SALT_FILE, 'utf8').trim();
}

function pseudonym(registration, salt) {
  if (!registration) return '';
  return crypto.createHash('sha256').update(`${salt}:${registration}`).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * Ausência vira **célula vazia**, nunca zero.
 *
 * É a mesma regra do resto do módulo, e por acaso é também o que um modelo de
 * árvore quer: o XGBoost trata ausente nativamente, enquanto um zero imputado
 * vira um ponto de corte real e o modelo aprende a distinguir "não mediu" de
 * "mediu zero" como se fossem a mesma coisa.
 */
function cell(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  const text = String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(columns, rows) {
  const header = columns.map(column => cell(column.name)).join(',');
  const body = rows.map(row => columns.map(column => cell(row[column.name])).join(','));
  return [header, ...body].join('\n');
}

// ---------------------------------------------------------------------------
// Declaração das tabelas
// ---------------------------------------------------------------------------

const UNITS = {
  activeDays: 'dias', eventsPerWeek: 'eventos/semana', activitiesViewed: 'atividades',
  submissionRate: '%', medianGapDays: 'dias', longestSilenceDays: 'dias',
  activeWeeksRatio: '%', attemptsToFirstPass: 'tentativas', gainFirstToLast: 'p.p.',
  recoveryRate: '%', stalledCount: 'questões', avgMastery: '%', gapTopics: 'conceitos',
  firstAttemptPassRate: '%', medianLeadHours: 'horas', lastMinuteRate: '%',
  distributedPractice: '%'
};

const INDICATOR_KEYS = {
  engagement: ['activeDays', 'eventsPerWeek', 'activitiesViewed', 'submissionRate'],
  regularity: ['medianGapDays', 'longestSilenceDays', 'activeWeeksRatio'],
  persistence: ['attemptsToFirstPass', 'gainFirstToLast', 'recoveryRate', 'stalledCount'],
  learning: ['avgMastery', 'gapTopics', 'firstAttemptPassRate'],
  selfRegulation: ['medianLeadHours', 'lastMinuteRate', 'distributedPractice']
};

/** A que família a coluna pertence — o que impede treinar com a resposta dentro. */
const INDICATOR_FAMILY = {
  activeDays: 'comportamento', eventsPerWeek: 'comportamento', activitiesViewed: 'comportamento',
  medianGapDays: 'comportamento', longestSilenceDays: 'comportamento', activeWeeksRatio: 'comportamento',
  medianLeadHours: 'comportamento', lastMinuteRate: 'comportamento', distributedPractice: 'comportamento',
  submissionRate: 'desempenho', attemptsToFirstPass: 'desempenho', gainFirstToLast: 'desempenho',
  recoveryRate: 'desempenho', stalledCount: 'desempenho', avgMastery: 'desempenho',
  gapTopics: 'desempenho', firstAttemptPassRate: 'desempenho'
};

const column = (name, type, familia, fonte, unidade, vazio, observacao) =>
  ({ name, type, familia, fonte, unidade: unidade || '', vazio: vazio || '', observacao: observacao || '' });

/**
 * Indicadores que caem para um substituto mais pobre quando não há logs.
 *
 * Sem os logs, "dias com atividade" vira "dias em que houve entrega" — um
 * número real, mas de outra coisa. No app a ressalva aparece ao lado do
 * rótulo; num CSV ela sumiria, e o valor passaria por medida de log. A coluna
 * `fonte_logs` diz por linha qual dos dois é, e o dicionário diz o que isso
 * muda.
 */
const PROXY_WITHOUT_LOGS = new Set([
  'activeDays', 'medianGapDays', 'longestSilenceDays', 'activeWeeksRatio', 'distributedPractice'
]);

function studentColumns() {
  const columns = [
    column('turma', 'texto', 'identificacao', 'app', '', 'nunca'),
    column('periodo', 'texto', 'contexto', 'app', '', 'quando a turma não tem período declarado'),
    column('aluno_id', 'texto', 'identificacao', 'moodle', '', 'aluno sem matrícula no Moodle'),
    column('nome', 'texto', 'identificacao', 'moodle', '', 'exportação pseudonimizada'),
    column('email', 'texto', 'identificacao', 'moodle', '', 'exportação pseudonimizada'),
    column('questoes_na_turma', 'inteiro', 'contexto', 'app', 'questões', 'nunca'),
    column('media_percentual', 'decimal', 'desempenho', 'vpl', '%', 'aluno sem nenhuma entrega')
  ];

  DIMENSIONS.forEach(dimension => {
    INDICATOR_KEYS[dimension].forEach(key => {
      columns.push(column(
        `${dimension}__${key}`, 'decimal', INDICATOR_FAMILY[key], 'moodle/vpl',
        UNITS[key] || '', 'indicador não medido nesta turma (sem logs, sem histórico ou sem taxonomia)',
        PROXY_WITHOUT_LOGS.has(key)
          ? 'quando fonte_logs=false, sai das datas de entrega e não dos logs de acesso — é outro dado com o mesmo nome'
          : ''
      ));
    });
    columns.push(column(
      `escore__${dimension}`, 'decimal', 'contexto', 'app', 'percentil 0-100',
      'nenhum indicador da dimensão disponível'
    ));
  });

  columns.push(
    column('desfecho_tipo', 'texto', 'desfecho', 'app', '', 'turma sem desfecho configurado'),
    column('desfecho_fonte', 'texto', 'desfecho', 'app', '', 'turma sem desfecho configurado'),
    column('desfecho_valor', 'decimal', 'desfecho', 'portal/professor', 'nota % ou 0/1', 'aluno sem desfecho'),
    column('nota_portal', 'decimal', 'desfecho', 'portal', '%', 'sem planilha ou aluno sem linha'),
    column('faltas_portal', 'inteiro', 'desfecho', 'portal', 'faltas', 'sem planilha ou aluno sem linha'),
    column('fonte_logs', 'booleano', 'contexto', 'app', '', 'nunca'),
    column('fonte_historico', 'booleano', 'contexto', 'app', '', 'nunca'),
    column('fonte_taxonomia', 'booleano', 'contexto', 'app', '', 'nunca')
  );

  return columns;
}

const TABLES = {
  'alunos.csv': { grain: 'turma × aluno', columns: studentColumns() },
  'conceitos.csv': {
    grain: 'turma × aluno × conceito',
    columns: [
      column('turma', 'texto', 'identificacao', 'app', '', 'nunca'),
      column('aluno_id', 'texto', 'identificacao', 'moodle', '', 'aluno sem matrícula'),
      column('conceito', 'texto', 'identificacao', 'taxonomia', '', 'nunca'),
      column('conceito_nome', 'texto', 'contexto', 'taxonomia', '', 'nunca'),
      column('dominio', 'decimal', 'desempenho', 'vpl', '%', 'evidência insuficiente (menos de 2 questões)'),
      column('situacao', 'texto', 'desempenho', 'app', '', 'nunca'),
      column('questoes_avaliadas', 'inteiro', 'contexto', 'app', 'questões', 'nunca'),
      column('nao_tentou', 'booleano', 'desempenho', 'vpl+parser', '', 'conceito sem sinal estático confiável')
    ]
  },
  'trajetorias.csv': {
    grain: 'turma × aluno × questão × tentativa',
    columns: [
      column('turma', 'texto', 'identificacao', 'app', '', 'nunca'),
      column('aluno_id', 'texto', 'identificacao', 'moodle', '', 'aluno sem matrícula'),
      column('questao', 'texto', 'identificacao', 'vpl', '', 'nunca'),
      column('tentativa', 'inteiro', 'identificacao', 'vpl', '', 'nunca'),
      column('nota_percentual', 'decimal', 'desempenho', 'vpl', '%', 'tentativa sem nota registrada'),
      column('enviado_em', 'data', 'contexto', 'vpl', 'ISO 8601', 'tentativa sem data')
    ]
  },
  'atividade_diaria.csv': {
    grain: 'turma × aluno × dia',
    columns: [
      column('turma', 'texto', 'identificacao', 'app', '', 'nunca'),
      column('aluno_id', 'texto', 'identificacao', 'moodle', '', 'aluno sem matrícula'),
      column('dia', 'data', 'identificacao', 'moodle', 'ISO 8601', 'nunca'),
      column('eventos', 'inteiro', 'comportamento', 'moodle', 'eventos', 'nunca')
    ]
  },
  'intervencoes.csv': {
    grain: 'uma linha por intervenção',
    columns: [
      column('turma', 'texto', 'identificacao', 'app', '', 'nunca'),
      column('aluno_id', 'texto', 'identificacao', 'moodle', '', 'aluno sem matrícula'),
      column('registrada_em', 'data', 'contexto', 'app', 'ISO 8601', 'nunca'),
      column('padrao', 'texto', 'contexto', 'app', '', 'intervenção não motivada por um padrão'),
      column('conceito', 'texto', 'contexto', 'taxonomia', '', 'intervenção não ligada a um conceito'),
      column('acao', 'texto', 'contexto', 'app', '', 'nunca'),
      column('situacao', 'texto', 'contexto', 'app', '', 'nunca'),
      column('media_antes', 'decimal', 'desempenho', 'vpl', '%', 'aluno sem entrega no momento do registro'),
      column('media_depois', 'decimal', 'desempenho', 'vpl', '%', 'ainda não houve reimportação da turma')
    ]
  },
  'turmas.csv': {
    grain: 'uma linha por turma',
    columns: [
      column('turma', 'texto', 'identificacao', 'app', '', 'nunca'),
      column('curso', 'texto', 'contexto', 'moodle', '', 'nunca'),
      column('periodo', 'texto', 'contexto', 'app', '', 'turma sem período declarado'),
      column('importada_em', 'data', 'contexto', 'app', 'ISO 8601', 'nunca'),
      column('alunos', 'inteiro', 'contexto', 'app', 'alunos', 'nunca'),
      column('questoes', 'inteiro', 'contexto', 'app', 'questões', 'nunca'),
      column('tem_logs', 'booleano', 'contexto', 'app', '', 'nunca'),
      column('tem_historico', 'booleano', 'contexto', 'app', '', 'nunca'),
      column('tem_taxonomia', 'booleano', 'contexto', 'app', '', 'nunca'),
      column('tem_planilha_portal', 'booleano', 'contexto', 'app', '', 'nunca'),
      column('casamento_portal', 'decimal', 'contexto', 'app', '%', 'turma sem planilha importada')
    ]
  }
};

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

function listTurmas() {
  return fs.readdirSync(STATS_DIR)
    .filter(isDatasetFile)
    .map(file => {
      try { return JSON.parse(fs.readFileSync(path.join(STATS_DIR, file), 'utf8')).turma; }
      catch (err) { return null; }
    })
    .filter(Boolean);
}

const isoDay = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : '');
const isoStamp = (ms) => (ms ? new Date(ms).toISOString() : '');

function buildPackage({ turmas, pseudonymize = true }) {
  const salt = pseudonymize ? readSalt() : null;
  const rows = {
    'alunos.csv': [], 'conceitos.csv': [], 'trajetorias.csv': [],
    'atividade_diaria.csv': [], 'intervencoes.csv': [], 'turmas.csv': []
  };
  const warnings = [];
  const perTurma = [];

  (turmas || []).forEach(turma => {
    const paths = statisticsPaths(turma);
    const dataset = readJsonFile(paths.dataset, null);
    if (!dataset) { warnings.push(`Turma "${turma}" não encontrada; ficou de fora.`); return; }

    const activity = readJsonFile(paths.activity, null);
    const academic = readJsonFile(paths.academic, null);
    const outcomeConfig = readJsonFile(paths.outcome, null);
    const registry = readJsonFile(paths.interventions, null);

    const stored = taxonomyService.readMapping(turma);
    const taxonomy = stored.taxonomyId ? taxonomyService.getTaxonomy(stored.taxonomyId) : null;
    const mastery = taxonomy
      ? { bound: true, ...computeMastery(dataset, taxonomy, stored.mapping) }
      : { bound: false, topics: [], students: [] };

    const indicators = computeIndicators(dataset, activity, mastery);
    const outcome = outcomeService.resolveOutcome(dataset, outcomeConfig, academic);
    const periodo = outcomeConfig?.periodoLetivo || dataset.sectionName || '';

    const idOf = (student) => {
      const registration = student.idNumber || '';
      if (!registration) return '';
      return pseudonymize ? pseudonym(registration, salt) : registration;
    };

    const indicatorByUser = new Map((indicators.students || [])
      .map(row => [String(row.userId ?? row.folderName), row]));
    const masteryByUser = new Map((mastery.students || [])
      .map(row => [String(row.userId ?? row.folderName), row]));

    if (!activity) warnings.push(`"${turma}": sem logs coletados — as colunas de engajamento saem vazias.`);
    if (!dataset.deepHistory) warnings.push(`"${turma}": sem histórico profundo — persistência e trajetórias saem vazias.`);
    if (!taxonomy) warnings.push(`"${turma}": sem taxonomia vinculada — conceitos.csv fica vazio para esta turma.`);

    (dataset.students || []).forEach(student => {
      const key = String(student.userId ?? student.folderName);
      const alunoId = idOf(student);
      const row = indicatorByUser.get(key);
      const academicRow = academic?.students?.[key];

      const record = {
        turma,
        periodo,
        aluno_id: alunoId,
        nome: pseudonymize ? null : student.name,
        email: pseudonymize ? null : student.email,
        questoes_na_turma: (dataset.questions || []).length,
        media_percentual: studentAverage(dataset, key),
        desfecho_tipo: outcome.available ? outcome.kind : null,
        desfecho_fonte: outcome.available ? outcome.source : null,
        desfecho_valor: outcome.values.get(key) ?? null,
        nota_portal: academicRow?.gradePercent ?? null,
        faltas_portal: academicRow?.absences ?? null,
        fonte_logs: Boolean(indicators.sources.logs),
        fonte_historico: Boolean(indicators.sources.history),
        fonte_taxonomia: Boolean(indicators.sources.taxonomy)
      };

      DIMENSIONS.forEach(dimension => {
        INDICATOR_KEYS[dimension].forEach(indicatorKey => {
          const entry = row?.dimensions?.[dimension]?.[indicatorKey];
          record[`${dimension}__${indicatorKey}`] = entry?.available ? entry.value : null;
        });
        const score = row?.scores?.[dimension];
        record[`escore__${dimension}`] = score?.available ? score.value : null;
      });

      rows['alunos.csv'].push(record);

      // Conceitos — longo, porque o conjunto muda de turma para turma.
      const masteryRow = masteryByUser.get(key);
      if (masteryRow) {
        (mastery.topics || []).forEach(topic => {
          const result = masteryRow.topics[topic.code];
          if (!result) return;
          rows['conceitos.csv'].push({
            turma, aluno_id: alunoId,
            conceito: topic.code, conceito_nome: topic.name,
            dominio: result.mastery,
            situacao: result.status,
            questoes_avaliadas: result.itemCount,
            nao_tentou: topic.codeSignals.length ? result.untried : null
          });
        });
      }

      // Trajetórias — a curva por tentativa, que nenhum dos outros projetos tem.
      const maxByKey = new Map((dataset.questions || [])
        .map(q => [q.key, q.maxGrade && q.maxGrade > 0 ? q.maxGrade : 10]));
      Object.entries(student.questions || {}).forEach(([questionKey, submission]) => {
        (submission?.history || []).forEach((attempt, index) => {
          rows['trajetorias.csv'].push({
            turma, aluno_id: alunoId, questao: questionKey, tentativa: index + 1,
            nota_percentual: typeof attempt.grade === 'number'
              ? Math.round((attempt.grade / (maxByKey.get(questionKey) || 10)) * 1000) / 10
              : null,
            enviado_em: isoStamp(attempt.submittedAt)
          });
        });
      });

      // Atividade diária — já agregada na coleta; o evento bruto nunca sai daqui.
      const access = activity?.byStudent?.[key];
      if (access) {
        Object.entries(access.days || {}).forEach(([day, count]) => {
          rows['atividade_diaria.csv'].push({ turma, aluno_id: alunoId, dia: day, eventos: count });
        });
      }
    });

    // Intervenções, com o antes gravado e o depois recalculado.
    (registry?.entries || []).forEach(entry => {
      const student = (dataset.students || [])
        .find(s => String(s.userId) === String(entry.userId));
      const key = String(entry.userId);
      const snapshot = registry.snapshots?.[entry.snapshotId];
      const moved = snapshot && snapshot.importedAt !== dataset.importedAt;
      rows['intervencoes.csv'].push({
        turma,
        aluno_id: student ? idOf(student) : '',
        registrada_em: isoStamp(entry.createdAt),
        padrao: entry.pattern,
        conceito: entry.topic,
        acao: entry.action,
        situacao: entry.status,
        media_antes: entry.baseline?.avgPercent ?? null,
        media_depois: moved ? studentAverage(dataset, key) : null
      });
    });

    rows['turmas.csv'].push({
      turma,
      curso: dataset.courseName || '',
      periodo,
      importada_em: isoStamp(dataset.importedAt),
      alunos: (dataset.students || []).length,
      questoes: (dataset.questions || []).length,
      tem_logs: Boolean(activity?.sources?.logs),
      tem_historico: Boolean(dataset.deepHistory),
      tem_taxonomia: Boolean(taxonomy),
      tem_planilha_portal: Boolean(academic),
      casamento_portal: academic?.match?.matchRate ?? null
    });

    perTurma.push({ turma, alunos: (dataset.students || []).length });
  });

  return { rows, warnings, perTurma, pseudonymize };
}

// ---------------------------------------------------------------------------
// Dicionário e leia-me
// ---------------------------------------------------------------------------

function dictionaryCsv() {
  const columns = [
    { name: 'tabela' }, { name: 'coluna' }, { name: 'tipo' },
    { name: 'familia' }, { name: 'fonte' }, { name: 'unidade' }, { name: 'quando_fica_vazio' },
    { name: 'observacao' }
  ];
  const rows = [];
  Object.entries(TABLES).forEach(([table, spec]) => {
    spec.columns.forEach(item => rows.push({
      tabela: table, coluna: item.name, tipo: item.type, familia: item.familia,
      fonte: item.fonte, unidade: item.unidade, quando_fica_vazio: item.vazio,
      observacao: item.observacao
    }));
  });
  return toCsv(columns, rows);
}

function readme({ rows, perTurma, pseudonymize, warnings }) {
  const totalStudents = rows['alunos.csv'].length;
  const lines = [
    '# Base consolidada — Análises de Aprendizado',
    '',
    `Gerado em ${new Date().toISOString()} · schema v${SCHEMA_VERSION}`,
    '',
    '## O que é isto',
    '',
    'Um retrato do comportamento dos alunos no Moodle, do domínio conceitual deles e do',
    'desfecho formal, empilhado por turma e por período. Serve para juntar o que três',
    'projetos têm separado: o comportamento (este app), a nota e a frequência (portal),',
    'e a intervenção pedagógica.',
    '',
    `**Chave de junção: \`aluno_id\`.** ${pseudonymize
      ? 'Aqui ele é a matrícula passada por um hash com sal. O mesmo aluno mantém o mesmo id entre exportações, então a ligação longitudinal funciona — mas o id não volta a ser matrícula sem o sal, que não está neste pacote.'
      : 'Aqui ele é a **matrícula em claro**, e o pacote carrega nome e e-mail. Trate-o como dado pessoal.'}`,
    '',
    '## Tabelas',
    '',
    ...Object.entries(TABLES).map(([table, spec]) =>
      `- \`${table}\` — ${spec.grain} · ${rows[table].length} linhas`),
    '- `dicionario.csv` — o que cada coluna é, de onde vem e quando fica vazia',
    '',
    '## Cinco armadilhas',
    '',
    '### 1. Célula vazia não é zero',
    '',
    'Uma célula vazia quer dizer **não medido**, e o motivo está no dicionário. Um aluno',
    'sem entrega não tem antecedência nem ganho; uma turma sem logs não tem dias ativos.',
    'Preencher com zero transforma ausência em desempenho ruim e contamina qualquer',
    'comparação. Em pandas, `pd.read_csv` já traz isso como `NaN`; não use `fillna(0)`.',
    'Modelos de árvore (XGBoost, LightGBM) tratam ausente nativamente — deixe assim.',
    '',
    '### 2. Não treine com a resposta dentro das features',
    '',
    'A coluna `familia` do dicionário separa `comportamento`, `desempenho`, `desfecho` e',
    '`contexto`. As colunas de `desempenho` saem das mesmas notas do VPL que compõem o',
    'desfecho: um modelo que as use vai acertar por construção e não terá descoberto nada.',
    'Para uma pergunta de alerta precoce, use só `comportamento`.',
    '',
    '### 3. Confira `fonte_logs` antes de usar engajamento ou regularidade',
    '',
    'Quando `fonte_logs` é `false`, a turma não teve os logs do Moodle coletados e as',
    'colunas de dias ativos, intervalo e silêncio saem das **datas de entrega** — um',
    'número real, mas de outra coisa, com o mesmo nome. Empilhar as duas origens na mesma',
    'coluna sem separar mistura duas medidas. A coluna `observacao` do dicionário marca',
    'quais colunas têm esse comportamento.',
    '',
    '### 4. Uma turma não é uma base',
    '',
    `Este pacote tem ${totalStudents} linhas de aluno em ${perTurma.length} turma(s)`,
    `(${perTurma.map(item => `${item.turma}: ${item.alunos}`).join(', ')}).`,
    'Com dezenas de linhas e mais de vinte colunas, qualquer modelo decora. Acumule',
    'semestres antes de treinar, e valide separando por turma — nunca embaralhando linhas',
    'da mesma turma entre treino e teste, porque alunos da mesma turma compartilham',
    'professor, prova e calendário.',
    '',
    '### 5. Quem melhorou depois de uma intervenção talvez melhorasse sozinho',
    '',
    'Em `intervencoes.csv`, o aluno foi escolhido por estar pior. Regressão à média basta',
    'para produzir melhora sem que a intervenção tenha feito nada. As colunas `media_antes`',
    'e `media_depois` servem para acompanhar, não para atribuir efeito.',
    '',
    '## Carregando',
    '',
    '```python',
    'import pandas as pd',
    '',
    'alunos = pd.read_csv("alunos.csv")            # vazio já vira NaN',
    'dicionario = pd.read_csv("dicionario.csv")',
    '',
    '# só as colunas que não compartilham origem com o desfecho',
    'comportamentais = dicionario.query(',
    '    "tabela == \'alunos.csv\' and familia == \'comportamento\'"',
    ')["coluna"].tolist()',
    '',
    'X = alunos[comportamentais]',
    'y = alunos["desfecho_valor"]',
    '```',
    ''
  ];

  if (warnings.length) {
    lines.push('## O que faltou', '');
    warnings.forEach(warning => lines.push(`- ${warning}`));
    lines.push('');
  }

  return lines.join('\n');
}

/** Monta o `.zip` e devolve o buffer. */
function buildZip({ turmas, pseudonymize = true }) {
  const result = buildPackage({ turmas, pseudonymize });
  const zip = new AdmZip();

  Object.entries(TABLES).forEach(([table, spec]) => {
    zip.addFile(table, Buffer.from(toCsv(spec.columns, result.rows[table]), 'utf8'));
  });
  zip.addFile('dicionario.csv', Buffer.from(dictionaryCsv(), 'utf8'));
  zip.addFile('LEIA-ME.md', Buffer.from(readme(result), 'utf8'));
  zip.addFile('manifesto.json', Buffer.from(JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    generatedAt: Date.now(),
    pseudonymized: pseudonymize,
    turmas: result.perTurma,
    rowCounts: Object.fromEntries(Object.entries(result.rows).map(([table, list]) => [table, list.length])),
    warnings: result.warnings
  }, null, 2), 'utf8'));

  return { buffer: zip.toBuffer(), summary: {
    turmas: result.perTurma,
    rowCounts: Object.fromEntries(Object.entries(result.rows).map(([t, l]) => [t, l.length])),
    warnings: result.warnings
  } };
}

module.exports = {
  buildZip, buildPackage, dictionaryCsv, readme, listTurmas,
  readSalt, pseudonym, toCsv, cell, TABLES, SCHEMA_VERSION
};
