# Guia de Integração Moodle + VPL
### Aplicação Electron para Correção de Provas — `moodle-teste.inatel.br`

---

## Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Configuração Necessária no Moodle](#2-configuração-necessária-no-moodle)
3. [Autenticação e Token](#3-autenticação-e-token)
4. [Endpoint Base e Padrão de Chamada](#4-endpoint-base-e-padrão-de-chamada)
5. [Fluxo de Navegação: Curso → Seção → Questões](#5-fluxo-de-navegação-curso--seção--questões)
6. [API Moodle Core — Funções e Formatos](#6-api-moodle-core--funções-e-formatos)
7. [API VPL — Funções e Formatos](#7-api-vpl--funções-e-formatos)
8. [Download de Arquivos (Submissões `.cpp`)](#8-download-de-arquivos-submissões-cpp)
9. [Obtenção de Enunciado e Casos de Teste](#9-obtenção-de-enunciado-e-casos-de-teste)
10. [Formato do Arquivo `vpl_evaluate.cases`](#10-formato-do-arquivo-vpl_evaluatecases)
11. [Estrutura de Dados Consolidada para a Aplicação](#11-estrutura-de-dados-consolidada-para-a-aplicação)
12. [Módulo TypeScript/JavaScript Sugerido](#12-módulo-typescriptjavascript-sugerido)
13. [Configuração do Admin — Checklist](#13-configuração-do-admin--checklist)
14. [Tratamento de Erros](#14-tratamento-de-erros)

---

## 1. Visão Geral da Arquitetura

```
Electron App
    │
    ├── Moodle REST API (core_*)
    │       └── https://moodle-teste.inatel.br/webservice/rest/server.php
    │
    └── VPL Web Service API (mod_vpl_*)
            └── https://moodle-teste.inatel.br/webservice/rest/server.php
                (mesmas funções, mesmo endpoint — VPL registra suas funções no core)
```

O VPL registra suas próprias funções (`mod_vpl_*`) dentro do sistema de Web Services do Moodle. Todas as chamadas usam o **mesmo endpoint REST**, apenas com funções diferentes. Não existe um endpoint separado para o VPL.

---

## 2. Configuração Necessária no Moodle

O administrador do Moodle precisa executar estes passos **uma única vez**:

### 2.1 Habilitar Web Services
`Administração do site → Plugins → Web Services → Gerenciar protocolos`
- Habilitar: **REST**

### 2.2 Criar Serviço Externo
`Administração do site → Plugins → Web Services → Serviços externos → Adicionar`
- Nome: `Corretor de Provas`
- Habilitar: ✅
- Usuários autorizados: adicionar o professor

### 2.3 Adicionar Funções ao Serviço

Funções necessárias para a aplicação:

| Função | Finalidade |
|--------|-----------|
| `core_course_search_courses` | Buscar curso pelo nome |
| `core_course_get_contents` | Listar seções e módulos |
| `core_enrol_get_enrolled_users` | Listar alunos da turma |
| `mod_vpl_open` | Abrir submissão de um aluno (pega arquivos) |
| `mod_vpl_get_result` | Obter resultado de avaliação anterior |
| `mod_vpl_info` | Obter info da atividade VPL (enunciado, configs) |

### 2.4 Gerar Token
`Administração do site → Plugins → Web Services → Gerenciar tokens → Criar token`
- Usuário: professor
- Serviço: `Corretor de Provas`

O token gerado é uma string como: `a1b2c3d4e5f6789012345678901234ab`

---

## 3. Autenticação e Token

### Opção A — Token permanente (recomendado para a aplicação)

O token é gerado pelo admin e inserido nas configurações do app. Não expira (a menos que revogado manualmente).

```typescript
const TOKEN = "a1b2c3d4e5f6789012345678901234ab"; // armazenado em config segura
```

### Opção B — Login programático (gera token de sessão)

```http
POST https://moodle-teste.inatel.br/login/token.php
Content-Type: application/x-www-form-urlencoded

username=professor&password=senha123&service=moodle_mobile_app
```

Resposta:
```json
{
  "token": "a1b2c3d4e5f6789012345678901234ab",
  "privatetoken": null
}
```

> **Atenção:** O token de sessão do VPL (gerado pelo próprio VPL por atividade) é diferente do token do Moodle Web Services. Para a aplicação, **use sempre o token permanente do Web Services**.

---

## 4. Endpoint Base e Padrão de Chamada

### URL Base
```
https://moodle-teste.inatel.br/webservice/rest/server.php
```

### Padrão de Request (POST recomendado)
```
POST /webservice/rest/server.php
Content-Type: application/x-www-form-urlencoded

wstoken=TOKEN&wsfunction=NOME_DA_FUNCAO&moodlewsrestformat=json&param1=valor1
```

### Padrão de Resposta — Sucesso
```json
{
  "campo1": "valor",
  "campo2": 123
}
```

### Padrão de Resposta — Erro
```json
{
  "exception": "moodle_exception",
  "errorcode": "invalidtoken",
  "message": "Invalid token - token not found",
  "debuginfo": "..."
}
```

> Atenção: O Moodle **sempre retorna HTTP 200** independente de erro. Checar a presença do campo `"exception"` na resposta é obrigatório.

---

## 5. Fluxo de Navegação: Curso → Seção → Questões

```
[1] core_course_search_courses  →  lista de cursos (com ID)
        ↓ courseid
[2] core_course_get_contents    →  lista de seções (plana, inclui "subseções visuais")
        ↓ filtrar por section.name == "P2" (ou nome desejado)
[3] section.modules             →  módulos dentro da seção
        ↓ filtrar por modname == "vpl"
[4] Para cada VPL (cmid):
        ├── mod_vpl_info        →  enunciado HTML + configs
        ├── core_enrol_get_enrolled_users → lista de alunos
        └── mod_vpl_open (por aluno) → arquivos .cpp submetidos
```

### Estrutura Visual vs Estrutura Real da API

O Moodle não tem hierarquia real de subseções. O que aparece visualmente como "subseção" (ex: P2 dentro de Provas) é uma seção independente na API:

```
Interface visual:          API (core_course_get_contents):
─────────────────          ───────────────────────────────
Provas (colapsável)   →    section[1]  name="Provas"     (vazia ou só rótulo)
  └── P1 Treino       →    section[2]  name="P1 Treino"
  └── P1              →    section[3]  name="P1"
  └── P2 Treino       →    section[4]  name="P2 Treino"
  └── P2              →    section[5]  name="P2"
        ├── QUESTÃO 1             modules[0]  modname="vpl"
        ├── QUESTÃO 2             modules[1]  modname="vpl"
        └── ...
```

---

## 6. API Moodle Core — Funções e Formatos

### `core_course_search_courses`

**Parâmetros:**
```
criterianame=search
criteriavalue=C02          ← busca parcial no nome
```

**Resposta:**
```json
{
  "total": 2,
  "courses": [
    {
      "id": 45,
      "fullname": "C02 – Algoritmos e Estruturas de Dados I 2025/1",
      "shortname": "C02-2025-1",
      "categoryid": 3,
      "summary": "<p>Ementa...</p>",
      "summaryformat": 1,
      "startdate": 1706745600,
      "enddate": 1717977600
    }
  ],
  "warnings": []
}
```

---

### `core_course_get_contents`

**Parâmetros:**
```
courseid=45
```

**Resposta:**
```json
[
  {
    "id": 101,
    "name": "Provas",
    "visible": 1,
    "summary": "",
    "summaryformat": 1,
    "section": 1,
    "hiddenbynumsections": 0,
    "uservisible": true,
    "modules": []
  },
  {
    "id": 105,
    "name": "P2",
    "visible": 1,
    "summary": "",
    "summaryformat": 1,
    "section": 5,
    "hiddenbynumsections": 0,
    "uservisible": true,
    "modules": [
      {
        "id": 310,
        "url": "https://moodle-teste.inatel.br/mod/vpl/view.php?id=310",
        "name": "QUESTÃO 1",
        "instance": 88,
        "visible": 1,
        "uservisible": true,
        "visibleoncoursepage": 1,
        "modicon": "https://moodle-teste.inatel.br/.../vpl/pix/icon.svg",
        "modname": "vpl",
        "modplural": "Virtual programming labs",
        "availability": null,
        "indent": 0,
        "onclick": "",
        "afterlink": null,
        "customdata": "\"\"",
        "completion": 0,
        "completiondata": null,
        "dates": [
          {
            "label": "Opened:",
            "timestamp": 1745163000
          },
          {
            "label": "Due:",
            "timestamp": 1745165700
          }
        ]
      }
    ]
  }
]
```

> **Campos importantes:**
> - `module.id` → **cmid** (course module ID) — usado em todas as chamadas VPL
> - `module.instance` → ID interno da atividade VPL na tabela `vpl`
> - `module.modname` → filtrar por `"vpl"`

---

### `core_enrol_get_enrolled_users`

**Parâmetros:**
```
courseid=45
```

**Resposta:**
```json
[
  {
    "id": 201,
    "username": "joao.silva",
    "firstname": "João",
    "lastname": "Silva",
    "fullname": "João Silva",
    "email": "joao.silva@aluno.inatel.br",
    "roles": [
      {
        "roleid": 5,
        "name": "Estudante",
        "shortname": "student"
      }
    ]
  }
]
```

> Para filtrar só alunos: `roles[].shortname == "student"`

---

## 7. API VPL — Funções e Formatos

O VPL registra suas funções no Web Services do Moodle a partir da versão 3.x. As funções relevantes são:

### `mod_vpl_info`

Retorna as informações completas de uma atividade VPL, incluindo o **enunciado em HTML**.

**Parâmetros:**
```
id=310        ← cmid
userid=-1     ← -1 = usuário autenticado; teacher pode passar userid específico
```

**Resposta:**
```json
{
  "name": "QUESTÃO 1",
  "intro": "<p>Escreva um programa em C++ que leia dois inteiros e imprima a soma...</p>",
  "introformat": 1,
  "reqpassword": 0,
  "example": 0,
  "restrictededitor": 0,
  "maxfiles": 1,
  "maxfilesize": 102400,
  "requirednet": "",
  "worktype": 0,
  "grade": 10,
  "startdate": 1745163000,
  "duedate": 1745165700,
  "timelimit": 0,
  "freeevaluations": 0,
  "reductionbyevaluation": "0",
  "run": 1,
  "debug": 0,
  "evaluate": 1,
  "automaticgrading": 1,
  "basedon": 0,
  "files": [
    {
      "name": "main.cpp",
      "encoding": 0,
      "data": ""
    }
  ],
  "executionfiles": [
    {
      "name": "vpl_evaluate.cases",
      "encoding": 0,
      "data": "Case = Caso 1\nInput = 3 5\nOutput = 8\n\nCase = Caso 2\nInput = -1 10\nOutput = 9\n"
    },
    {
      "name": "vpl_run.sh",
      "encoding": 0,
      "data": "#!/bin/bash\ng++ -o main main.cpp\n./main\n"
    }
  ],
  "warnings": []
}
```

> **Campo `executionfiles`:** Contém os arquivos de execução do VPL, incluindo os casos de teste (`vpl_evaluate.cases`). Este é o campo mais importante para a aplicação.

> **Campo `encoding`:** `0` = texto puro (UTF-8), `1` = Base64. A partir do VPL 4.1, arquivos binários são retornados em Base64.

---

### `mod_vpl_open`

Retorna os arquivos submetidos por um aluno específico.

**Parâmetros:**
```
id=310        ← cmid
userid=201    ← userid do aluno (teacher pode especificar qualquer aluno)
```

**Resposta:**
```json
{
  "files": [
    {
      "name": "main.cpp",
      "encoding": 0,
      "data": "#include <iostream>\nusing namespace std;\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    cout << a + b << endl;\n    return 0;\n}\n"
    }
  ],
  "comments": "",
  "warnings": []
}
```

> Se o aluno nunca submetiu, `files` retorna vazio `[]`.

---

### `mod_vpl_get_result`

Retorna o resultado da última avaliação automática de um aluno.

**Parâmetros:**
```
id=310        ← cmid
userid=201
```

**Resposta:**
```json
{
  "compilation": "",
  "evaluation": "Grade :=>> 8\n\nCase = Caso 1 (OK)\nCase = Caso 2 (FAILED)\n  Expected: 9\n  Got: 10\n",
  "grade": "8",
  "comments": "",
  "warnings": []
}
```

---

## 8. Download de Arquivos (Submissões `.cpp`)

### Como funciona

Os arquivos de submissão são retornados **diretamente no corpo da resposta JSON** pelo `mod_vpl_open`, no campo `files[].data`. Não é necessário fazer download separado — o conteúdo já vem inline.

Isso é diferente de outros módulos do Moodle que retornam URLs de `pluginfile.php`.

### Se precisar usar `pluginfile.php` (caso de outros tipos de arquivo)

```
GET https://moodle-teste.inatel.br/webservice/pluginfile.php/{contextid}/mod_vpl/submissions/{userid}/main.cpp?token=TOKEN
```

O `contextid` pode ser obtido via `core_context_get_with_capabilities` ou a partir dos dados do módulo.

---

## 9. Obtenção de Enunciado e Casos de Teste

### Enunciado

Vem no campo `intro` da resposta do `mod_vpl_info`. O formato é **HTML** (quando `introformat == 1`).

```javascript
const enunciado = vplInfo.intro; // string HTML
// Pode ser renderizado diretamente em um <div> via innerHTML
// ou convertido para Markdown com uma lib como turndown
```

### Casos de Teste

Vêm no array `executionfiles` da resposta do `mod_vpl_info`. O arquivo relevante é o `vpl_evaluate.cases`.

```javascript
const casesFile = vplInfo.executionfiles.find(f => f.name === "vpl_evaluate.cases");
const casesContent = casesFile?.data ?? "";
```

---

## 10. Formato do Arquivo `vpl_evaluate.cases`

Este é o formato padrão do avaliador BIOTES (padrão do VPL). Cada caso de teste segue este padrão:

```
Case = Nome do caso
Input = linha de entrada 1
linha de entrada 2
Output = linha esperada 1
linha esperada 2

Case = Próximo caso
Input = outra entrada
Output = outra saída esperada
```

### Exemplo real (soma de dois inteiros):

```
Case = Caso 1 - positivos
Input = 3 5
Output = 8

Case = Caso 2 - negativo e positivo
Input = -1 10
Output = 9

Case = Caso 3 - zeros
Input = 0 0
Output = 0
```

### Campos opcionais por caso:

```
Case = Caso com grade parcial
Grade reduction = 50%    ← reduz nota em 50% se falhar
Input = 10 20
Output = 30
```

### Parser JavaScript para `vpl_evaluate.cases`:

```typescript
interface TestCase {
  name: string;
  input: string;
  output: string;
  gradeReduction?: string;
}

function parseCases(content: string): TestCase[] {
  const cases: TestCase[] = [];
  const blocks = content.split(/\n(?=Case\s*=)/i).filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.split("\n");
    const tc: Partial<TestCase> = {};
    let currentField: "input" | "output" | null = null;
    const buffer: string[] = [];

    const flushBuffer = () => {
      if (currentField && buffer.length > 0) {
        tc[currentField] = buffer.join("\n").trimEnd();
        buffer.length = 0;
      }
    };

    for (const line of lines) {
      if (/^Case\s*=/i.test(line)) {
        tc.name = line.replace(/^Case\s*=\s*/i, "").trim();
        currentField = null;
      } else if (/^Input\s*=/i.test(line)) {
        flushBuffer();
        currentField = "input";
        const val = line.replace(/^Input\s*=\s*/i, "");
        if (val) buffer.push(val);
      } else if (/^Output\s*=/i.test(line)) {
        flushBuffer();
        currentField = "output";
        const val = line.replace(/^Output\s*=\s*/i, "");
        if (val) buffer.push(val);
      } else if (/^Grade reduction\s*=/i.test(line)) {
        tc.gradeReduction = line.replace(/^Grade reduction\s*=\s*/i, "").trim();
      } else if (currentField) {
        buffer.push(line);
      }
    }

    flushBuffer();

    if (tc.name && tc.input !== undefined && tc.output !== undefined) {
      cases.push(tc as TestCase);
    }
  }

  return cases;
}
```

---

## 11. Estrutura de Dados Consolidada para a Aplicação

### Tipo `ExamQuestion` (questão completa importada)

```typescript
interface ExamQuestion {
  cmid: number;              // ID do course module
  instanceId: number;        // ID interno VPL
  name: string;              // "QUESTÃO 1"
  description: string;       // HTML do enunciado
  startDate: number;         // timestamp unix
  dueDate: number;           // timestamp unix
  testCases: TestCase[];     // array parseado do vpl_evaluate.cases
  executionFiles: VplFile[]; // todos os arquivos de execução (vpl_run.sh, etc.)
}

interface VplFile {
  name: string;
  encoding: 0 | 1;          // 0 = texto, 1 = base64
  data: string;
}
```

### Tipo `StudentSubmission` (submissão de um aluno)

```typescript
interface StudentSubmission {
  userId: number;
  fullName: string;
  email: string;
  files: VplFile[];          // array de arquivos (geralmente só main.cpp)
  submittedAt?: number;      // timestamp — não retornado pelo mod_vpl_open,
                             // disponível via mod_vpl_get_result se avaliado
  lastResult?: {
    compilation: string;
    evaluation: string;
    grade: string;
  };
}
```

### Tipo `ExamImport` (dado completo importado para a aplicação)

```typescript
interface ExamImport {
  courseId: number;
  courseName: string;
  sectionName: string;      // ex: "P2"
  importedAt: number;       // timestamp da importação
  questions: ExamQuestion[];
  students: StudentSubmission[];  // cruzamento: submissions agrupadas por aluno
}
```

---

## 12. Módulo TypeScript/JavaScript Sugerido

```typescript
// moodle-client.ts

const BASE_URL = "https://moodle-teste.inatel.br";

async function moodleCall(token: string, func: string, params: Record<string, any> = {}) {
  const body = new URLSearchParams({
    wstoken: token,
    wsfunction: func,
    moodlewsrestformat: "json",
    ...Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ),
  });

  const res = await fetch(`${BASE_URL}/webservice/rest/server.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();

  if (data.exception) {
    throw new Error(`[${data.errorcode}] ${data.message}`);
  }

  return data;
}

// --- Funções de Alto Nível ---

export async function searchCourses(token: string, query: string) {
  return moodleCall(token, "core_course_search_courses", {
    criterianame: "search",
    criteriavalue: query,
  });
}

export async function getCourseContents(token: string, courseId: number) {
  return moodleCall(token, "core_course_get_contents", { courseid: courseId });
}

export async function getEnrolledStudents(token: string, courseId: number) {
  const users = await moodleCall(token, "core_enrol_get_enrolled_users", { courseid: courseId });
  return users.filter((u: any) => u.roles?.some((r: any) => r.shortname === "student"));
}

export async function getVplInfo(token: string, cmid: number) {
  return moodleCall(token, "mod_vpl_info", { id: cmid });
}

export async function getStudentSubmission(token: string, cmid: number, userId: number) {
  return moodleCall(token, "mod_vpl_open", { id: cmid, userid: userId });
}

export async function getStudentResult(token: string, cmid: number, userId: number) {
  return moodleCall(token, "mod_vpl_get_result", { id: cmid, userid: userId });
}

// --- Importação Completa de uma Seção de Prova ---

export async function importExamSection(
  token: string,
  courseId: number,
  sectionName: string, // ex: "P2"
): Promise<ExamImport> {

  // 1. Busca seções do curso
  const contents = await getCourseContents(token, courseId);
  const section = contents.find((s: any) => s.name.trim() === sectionName);
  if (!section) throw new Error(`Seção "${sectionName}" não encontrada`);

  // 2. Filtra módulos VPL
  const vplModules = section.modules.filter((m: any) => m.modname === "vpl");

  // 3. Para cada VPL, busca info (enunciado + casos de teste)
  const questions: ExamQuestion[] = await Promise.all(
    vplModules.map(async (mod: any) => {
      const info = await getVplInfo(token, mod.id);
      const casesFile = info.executionfiles?.find((f: any) => f.name === "vpl_evaluate.cases");
      return {
        cmid: mod.id,
        instanceId: mod.instance,
        name: mod.name,
        description: info.intro ?? "",
        startDate: info.startdate ?? 0,
        dueDate: info.duedate ?? 0,
        testCases: casesFile ? parseCases(casesFile.data) : [],
        executionFiles: info.executionfiles ?? [],
      };
    })
  );

  // 4. Busca alunos e submissões
  const students = await getEnrolledStudents(token, courseId);

  // 5. Para cada aluno, busca a submissão de cada questão
  const submissions: StudentSubmission[] = await Promise.all(
    students.map(async (student: any) => {
      const firstQuestion = questions[0]; // Pega submissão da 1ª questão como referência
      let files: VplFile[] = [];
      let lastResult = undefined;

      if (firstQuestion) {
        try {
          const sub = await getStudentSubmission(token, firstQuestion.cmid, student.id);
          files = sub.files ?? [];
        } catch (_) {
          // aluno não submeteu
        }

        try {
          const result = await getStudentResult(token, firstQuestion.cmid, student.id);
          lastResult = {
            compilation: result.compilation,
            evaluation: result.evaluation,
            grade: result.grade,
          };
        } catch (_) {
          // sem avaliação ainda
        }
      }

      return {
        userId: student.id,
        fullName: student.fullname,
        email: student.email,
        files,
        lastResult,
      };
    })
  );

  return {
    courseId,
    courseName: "",
    sectionName,
    importedAt: Date.now(),
    questions,
    students: submissions,
  };
}
```

---

## 13. Configuração do Admin — Checklist

Lista para enviar ao administrador do Moodle:

```
□ Habilitar Web Services REST
  Administração → Plugins → Web Services → Gerenciar protocolos → REST: ON

□ Criar Serviço Externo chamado "Corretor de Provas"
  Administração → Plugins → Web Services → Serviços externos → Adicionar

□ Adicionar as funções ao serviço:
  - core_course_search_courses
  - core_course_get_contents
  - core_enrol_get_enrolled_users
  - mod_vpl_info
  - mod_vpl_open
  - mod_vpl_get_result

□ Adicionar o professor como usuário autorizado do serviço

□ Gerar token para o professor
  Administração → Plugins → Web Services → Gerenciar tokens → Criar token
  Usuário: [professor] | Serviço: Corretor de Provas

□ Verificar versão do VPL instalada
  Deve ser 3.x ou superior para ter mod_vpl_* no Web Services
  Ideal: 4.1+ (suporte a userid nas funções e Base64 para binários)
```

---

## 14. Tratamento de Erros

### Erros comuns e como tratar

| `errorcode` | Causa | Solução |
|-------------|-------|---------|
| `invalidtoken` | Token inválido ou expirado | Verificar token nas configurações |
| `accessdenied` | Função não permitida no serviço | Admin deve adicionar a função ao serviço |
| `invalidparameter` | Parâmetro incorreto (ex: courseid errado) | Verificar IDs |
| `notavailable` | VPL com acesso restrito ou exemplo | Normal — pular essa atividade |
| `usernotincourse` | Usuário não matriculado no curso | Verificar matrícula |

### Padrão de resposta de erro
```json
{
  "exception": "moodle_exception",
  "errorcode": "accessdenied",
  "message": "Sorry, but you do not currently have permissions to do that (Access denied).",
  "debuginfo": "Required capability: moodle/webservice:createtoken"
}
```

### Verificação no código
```typescript
if (data.exception) {
  // Erro do Moodle — nunca chega com HTTP != 200
  throw new Error(`Moodle [${data.errorcode}]: ${data.message}`);
}
```

### Casos esperados sem erro
- `mod_vpl_open` com aluno que não submeteu → retorna `{ files: [], comments: "" }` — não é erro
- `mod_vpl_get_result` sem avaliação prévia → pode retornar campos vazios — tratar com defaults

---

*Guia gerado em maio de 2026 — baseado na documentação oficial do Moodle Web Services e no código-fonte do plugin VPL (jcrodriguez-dis/moodle-mod_vpl). Versão do VPL de referência: 4.1+*
