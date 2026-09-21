// Matemática da associação. Funções puras sobre vetores de números — nada de
// dataset, nada de I/O.
//
// Três decisões que o resto do arquivo depende:
//
// 1. **Postos médios, sempre.** O atalho `1 − 6Σd²/(n(n²−1))` só vale sem
//    empate, e aqui há empate o tempo todo (`stalledCount` é 0 para quase toda
//    a turma, `lastMinuteRate` costuma ser 0 ou 100). Ranqueamos com posto
//    médio e aplicamos Pearson sobre os postos, que é o Spearman correto.
//
// 2. **O bootstrap reamostra os PARES e reranqueia dentro de cada réplica.**
//    Ranquear uma vez e reamostrar os postos fixa as marginais e subestima a
//    variância — produz intervalo estreito e confiante que não se sustenta.
//
// 3. **A semente é determinística.** Um intervalo que muda a cada F5 destrói a
//    confiança mais rápido do que um intervalo largo. A semente sai da própria
//    turma e do indicador.

const EPS = 1e-9;

const B_DEFAULT = 2000;
/** Acima disso a réplica degenerada domina e o intervalo não significa nada. */
const MAX_DEGENERATE_SHARE = 0.10;
/** Abaixo disso o intervalo de 95% fica largo demais para prometer qualquer coisa. */
const MIN_PAIRS = 15;
/** Entre MIN_PAIRS e isto, o número sai marcado como amostra pequena. */
const SMALL_SAMPLE = 25;
/** Um indicador em que 90% da turma tem o mesmo valor é decidido por 4 alunos. */
const MAX_TIE_SHARE = 0.90;
/** Grupo menor de um desfecho binário: abaixo disso não há o que comparar. */
const MIN_GROUP = 5;

// ---------------------------------------------------------------------------
// Aleatoriedade determinística
// ---------------------------------------------------------------------------

/** Hash de string estável (FNV-1a de 32 bits), para semear o gerador. */
function hashSeed(text) {
  let hash = 0x811c9dc5;
  const value = String(text);
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Gerador pequeno e rápido; o importante é ser reprodutível, não criptográfico. */
function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Postos e correlação
// ---------------------------------------------------------------------------

/** Postos médios: cada bloco de empate recebe a média das posições que ocuparia. */
function midranks(values) {
  const order = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && Math.abs(values[order[j + 1]] - values[order[i]]) <= EPS) j += 1;
    const average = (i + j) / 2 + 1; // postos são 1-based
    for (let k = i; k <= j; k++) ranks[order[k]] = average;
    i = j + 1;
  }
  return ranks;
}

function pearson(x, y) {
  const n = x.length;
  if (n < 2) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  // Variância zero de qualquer lado: a correlação é indefinida, não é zero.
  if (sxx <= EPS || syy <= EPS) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Spearman corrigido para empates. `null` quando um dos lados não varia. */
function spearman(x, y) {
  if (x.length < 2) return null;
  return pearson(midranks(x), midranks(y));
}

/**
 * Delta de Cliff para desfecho binário.
 *
 * Contra um 0/1, o Spearman tem a magnitude limitada pela proporção dos grupos:
 * com 8 reprovados em 40, |ρ| não chega perto de 1 nem com separação perfeita, e
 * o teto muda de indicador para indicador. Comparar ρ entre indicadores passaria
 * a comparar atenuação, não associação.
 *
 * `δ = 2·AUC − 1`, onde AUC = P(x_pos > x_neg) + ½·P(empate). Os empates entram
 * pela metade automaticamente via posto médio.
 */
function cliffsDelta(values, flags) {
  const ranks = midranks(values);
  let sumPositive = 0;
  let nPositive = 0;
  for (let i = 0; i < flags.length; i++) {
    if (flags[i]) { sumPositive += ranks[i]; nPositive += 1; }
  }
  const nNegative = flags.length - nPositive;
  if (!nPositive || !nNegative) return null;

  const u = sumPositive - (nPositive * (nPositive + 1)) / 2;
  const auc = u / (nPositive * nNegative);
  return 2 * auc - 1;
}

// ---------------------------------------------------------------------------
// Estrutura do vetor
// ---------------------------------------------------------------------------

/** O que impede (ou não) o indicador de discriminar esta turma. */
function describeSpread(values) {
  const counts = new Map();
  values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  const largest = Math.max(0, ...counts.values());
  return {
    distinct: counts.size,
    maxTieShare: values.length ? largest / values.length : 1,
    onlyValue: counts.size === 1 ? values[0] : null
  };
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function quantile(sorted, fraction) {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/**
 * Intervalo percentílico de 95% por reamostragem dos pares.
 *
 * Percentílico e não BCa de propósito: o BCa exigiria jackknife mais correção
 * de aceleração — umas sessenta linhas de aproximação numérica — para refinar
 * um número que a própria tela já chama de exploratório, e degenera com a
 * frequência de empates que estes indicadores têm. A escolha fica dita no
 * payload (`ciMethod`) em vez de escondida.
 *
 * @param {(x:number[], y:number[]) => number|null} estimator
 * @param {boolean} stratify  reamostra cada grupo do desfecho separadamente
 */
function bootstrapInterval(x, y, estimator, { seed, resamples = B_DEFAULT, stratify = false }) {
  const random = mulberry32(hashSeed(seed));
  const n = x.length;

  // Índices por grupo, para a reamostragem estratificada. Sem estratificar, uma
  // réplica pode sair com zero reprovados e o delta fica indefinido.
  const positives = [];
  const negatives = [];
  if (stratify) {
    for (let i = 0; i < n; i++) (y[i] ? positives : negatives).push(i);
  }

  const estimates = [];
  let degenerate = 0;

  for (let b = 0; b < resamples; b++) {
    const sampleX = new Array(n);
    const sampleY = new Array(n);

    if (stratify) {
      let at = 0;
      [positives, negatives].forEach(group => {
        for (let k = 0; k < group.length; k++) {
          const index = group[Math.floor(random() * group.length)];
          sampleX[at] = x[index];
          sampleY[at] = y[index];
          at += 1;
        }
      });
    } else {
      for (let i = 0; i < n; i++) {
        const index = Math.floor(random() * n);
        sampleX[i] = x[index];
        sampleY[i] = y[index];
      }
    }

    // O estimador reranqueia por dentro — é o ponto do bootstrap de pares.
    const estimate = estimator(sampleX, sampleY);
    if (estimate === null || Number.isNaN(estimate)) degenerate += 1;
    else estimates.push(estimate);
  }

  const degenerateShare = degenerate / resamples;
  if (degenerateShare > MAX_DEGENERATE_SHARE || estimates.length < 2) {
    return { ci: null, degenerateShare, resamples, ciMethod: 'percentile', unstable: true };
  }

  estimates.sort((a, b) => a - b);
  return {
    ci: [quantile(estimates, 0.025), quantile(estimates, 0.975)],
    degenerateShare,
    resamples,
    ciMethod: 'percentile',
    unstable: false
  };
}

// ---------------------------------------------------------------------------
// Associação de um indicador
// ---------------------------------------------------------------------------

/**
 * Calcula a associação de um vetor de indicador com o desfecho, aplicando as
 * travas. Devolve sempre um objeto com `status` — um indicador que não dá para
 * medir é um resultado, não um erro, e a tela o mostra com o mesmo peso.
 *
 * @param {{x: number[], y: number[], binary: boolean, seed: string}} input
 */
function associate({ x, y, binary, seed }) {
  const n = x.length;
  const spread = describeSpread(x);
  const base = {
    n,
    distinct: spread.distinct,
    maxTieShare: Math.round(spread.maxTieShare * 100) / 100,
    onlyValue: spread.onlyValue,
    measure: binary ? 'cliffsDelta' : 'spearman',
    value: null,
    auc: null,
    ci: null,
    ciMethod: null,
    resamples: 0,
    smallSample: n < SMALL_SAMPLE
  };

  if (n < MIN_PAIRS) return { ...base, status: 'insufficientPairs' };
  if (spread.distinct === 1) return { ...base, status: 'constant' };
  if (spread.maxTieShare > MAX_TIE_SHARE) return { ...base, status: 'insufficientVariation' };

  let groups = null;
  if (binary) {
    const positive = y.reduce((acc, value) => acc + (value ? 1 : 0), 0);
    groups = { positive, negative: n - positive };
    if (Math.min(groups.positive, groups.negative) < MIN_GROUP) {
      return { ...base, groups, status: 'insufficientGroup' };
    }
  }

  const estimator = binary
    ? (sx, sy) => cliffsDelta(sx, sy)
    : (sx, sy) => spearman(sx, sy);

  const value = estimator(x, y);
  if (value === null) return { ...base, groups, status: 'undefined' };

  const interval = bootstrapInterval(x, y, estimator, { seed, stratify: binary });

  return {
    ...base,
    groups,
    value: Math.round(value * 1000) / 1000,
    auc: binary ? Math.round(((value + 1) / 2) * 1000) / 1000 : null,
    ci: interval.ci ? interval.ci.map(bound => Math.round(bound * 1000) / 1000) : null,
    ciMethod: interval.ciMethod,
    resamples: interval.resamples,
    degenerateShare: Math.round(interval.degenerateShare * 100) / 100,
    status: interval.unstable ? 'unstable' : 'ok'
  };
}

/**
 * Largura do intervalo — e **não** se ele cruza o zero.
 *
 * "O intervalo não cruza zero" é um p-valor pela porta dos fundos: reintroduz
 * exatamente o problema de comparações múltiplas que motivou tirar o p-valor.
 * A leitura honesta de um intervalo é o quanto ele deixa em aberto.
 */
function intervalWidth(ci) {
  if (!ci) return null;
  return Math.round((ci[1] - ci[0]) * 1000) / 1000;
}

module.exports = {
  midranks,
  pearson,
  spearman,
  cliffsDelta,
  describeSpread,
  bootstrapInterval,
  associate,
  intervalWidth,
  hashSeed,
  mulberry32,
  MIN_PAIRS,
  SMALL_SAMPLE,
  MAX_TIE_SHARE,
  MIN_GROUP
};
