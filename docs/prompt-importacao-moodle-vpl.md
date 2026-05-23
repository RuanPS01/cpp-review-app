# Prompt — Módulo de Importação Automática via Moodle + VPL

## Contexto da Aplicação

Estou desenvolvendo uma aplicação desktop em **Electron + Vite + React + TypeScript** chamada (provisoriamente) de **corretor de provas**. A aplicação é destinada ao uso pessoal de um professor universitário do INATEL (Instituto Nacional de Telecomunicações) para corrigir provas de programação em C++ aplicadas via Moodle com o plugin VPL (Virtual Programming Lab).

A aplicação já possui um sistema de importação via **arquivo ZIP**, onde o professor exporta manualmente as submissões do Moodle e carrega no app. O objetivo agora é implementar um **novo módulo de importação direta via API do Moodle**, que substitua ou complemente esse fluxo manual.

---

## Objetivo do Módulo

Criar um módulo completo de importação automática que permita ao professor:

1. Configurar a conexão com o servidor Moodle (`moodle-teste.inatel.br`) usando um token de acesso
2. Navegar e selecionar a **turma/curso** desejada
3. Navegar e selecionar a **seção** (que no Moodle aparece visualmente como "subseção" dentro de outra seção, mas na API é tratada como seção independente de nível plano)
4. Ver a **lista de atividades VPL** (questões da prova) disponíveis nessa seção
5. Importar automaticamente, para cada questão:
   - O **enunciado completo** (retornado como HTML pelo campo `intro` da função `mod_vpl_info`)
   - Os **casos de teste** (arquivo `vpl_evaluate.cases` dentro do array `executionfiles` da função `mod_vpl_info`)
   - A **lista de alunos matriculados** na turma (função `core_enrol_get_enrolled_users`)
   - O **código `.cpp` submetido por cada aluno** (função `mod_vpl_open` com o `userid` de cada aluno)

---

## Contexto Técnico da API

### Servidor Moodle
- URL base: `https://moodle-teste.inatel.br`
- Endpoint REST: `https://moodle-teste.inatel.br/webservice/rest/server.php`
- Autenticação: token permanente passado como parâmetro `wstoken`
- Todas as respostas em JSON (`moodlewsrestformat=json`)
- O Moodle **sempre retorna HTTP 200**, mesmo em erro — checar campo `exception` na resposta

### Funções usadas

| Função | Finalidade |
|--------|-----------|
| `core_course_search_courses` | Buscar curso pelo nome parcial |
| `core_course_get_contents` | Listar todas as seções e módulos do curso |
| `core_enrol_get_enrolled_users` | Listar alunos matriculados |
| `mod_vpl_info` | Obter enunciado HTML + arquivos de execução + casos de teste |
| `mod_vpl_open` | Obter arquivos `.cpp` submetidos por um aluno |
| `mod_vpl_get_result` | Obter resultado da última avaliação automática (opcional) |

### Estrutura de seções no Moodle
O Moodle não possui hierarquia real de subseções. O que aparece visualmente como "subseção colapsável" (ex: "P2" dentro de "Provas") é, na API, uma **seção independente** com seus próprios módulos. A resposta de `core_course_get_contents` é sempre uma lista **plana** de seções. Filtrar pelo campo `name` da seção.

### Formato do `vpl_evaluate.cases`
```
Case = Nome do caso
Input = entrada linha 1
entrada linha 2
Output = saída esperada linha 1
saída esperada linha 2

Case = Próximo caso
...
```

### Estrutura da resposta de `mod_vpl_info`
```json
{
  "name": "QUESTÃO 1",
  "intro": "<p>Enunciado em HTML...</p>",
  "introformat": 1,
  "executionfiles": [
    { "name": "vpl_evaluate.cases", "encoding": 0, "data": "Case = ..." },
    { "name": "vpl_run.sh", "encoding": 0, "data": "#!/bin/bash\n..." }
  ],
  "startdate": 1745163000,
  "duedate": 1745165700
}
```

### Estrutura da resposta de `mod_vpl_open`
```json
{
  "files": [
    { "name": "main.cpp", "encoding": 0, "data": "#include <iostream>..." }
  ],
  "comments": ""
}
```
Se o aluno nunca submeteu, `files` retorna `[]` — não é erro.

---

## O que deve ser implementado

### 1. Serviço de cliente Moodle (`moodle-client.ts`)

Um módulo de funções assíncronas que encapsulam todas as chamadas à API. Deve incluir:

- Função genérica `moodleCall(token, func, params)` com tratamento de erro no campo `exception`
- `searchCourses(token, query)` — busca cursos pelo nome
- `getCourseContents(token, courseId)` — retorna seções do curso
- `getEnrolledStudents(token, courseId)` — retorna só alunos (filtrar `roles[].shortname === "student"`)
- `getVplInfo(token, cmid)` — retorna info da atividade incluindo enunciado e `executionfiles`
- `getStudentSubmission(token, cmid, userId)` — retorna arquivos `.cpp` do aluno
- `getStudentResult(token, cmid, userId)` — retorna resultado da avaliação (opcional, pode falhar silenciosamente)

### 2. Parser de casos de teste (`parse-cases.ts`)

Uma função `parseCases(content: string): TestCase[]` que converte o conteúdo do arquivo `vpl_evaluate.cases` para um array de objetos estruturados:

```typescript
interface TestCase {
  name: string;
  input: string;
  output: string;
  gradeReduction?: string;
}
```

Deve lidar corretamente com:
- Entradas e saídas multilinhas
- Campo `Grade reduction` opcional
- Blocos separados por linha em branco
- Case-insensitive nos campos (`Case =`, `case =`, `CASE =`)

### 3. Hook/store de importação (`useImport.ts` ou store Zustand/Redux)

Gerencia o estado do fluxo de importação em etapas:

```
IDLE → CONNECTING → SELECTING_COURSE → SELECTING_SECTION
     → LOADING_QUESTIONS → LOADING_SUBMISSIONS → DONE | ERROR
```

Deve expor:
- Estado atual do fluxo (etapa, progresso, erros)
- Lista de cursos encontrados
- Lista de seções do curso selecionado
- Lista de questões VPL da seção selecionada
- Função `startImport(config)` que executa o fluxo completo
- Resultado final no formato `ExamImport` (estrutura abaixo)

### 4. Estrutura de dados de saída

```typescript
interface ExamImport {
  courseId: number;
  courseName: string;
  sectionName: string;
  importedAt: number;
  questions: ExamQuestion[];
  studentSubmissions: StudentQuestionSubmission[];
}

interface ExamQuestion {
  cmid: number;
  instanceId: number;
  name: string;              // "QUESTÃO 1"
  description: string;       // HTML do enunciado
  startDate: number;
  dueDate: number;
  testCases: TestCase[];
  executionFiles: VplFile[]; // todos os arquivos brutos de execução
}

interface StudentQuestionSubmission {
  userId: number;
  fullName: string;
  email: string;
  questionCmid: number;      // qual questão
  files: VplFile[];          // arquivos submetidos (geralmente main.cpp)
  submitted: boolean;        // true se files.length > 0
  lastResult?: {
    compilation: string;
    evaluation: string;
    grade: string;
  };
}

interface VplFile {
  name: string;
  encoding: 0 | 1;           // 0 = texto UTF-8, 1 = Base64
  data: string;
}
```

### 5. Componente de UI do fluxo de importação (`MoodleImportWizard.tsx`)

Um wizard em etapas (pode ser um modal ou página dedicada) com as seguintes telas:

**Tela 1 — Configuração de conexão:**
- Campo de URL do servidor (pré-preenchido com `https://moodle-teste.inatel.br`)
- Campo de token de acesso
- Botão "Testar conexão" (chama `core_course_search_courses` com query vazia para validar)
- Opção de salvar configuração localmente (electron-store ou similar)

**Tela 2 — Seleção de curso:**
- Campo de busca com debounce
- Lista de resultados com `fullname` e `shortname`
- Seleção por clique

**Tela 3 — Seleção de seção:**
- Lista de seções do curso selecionado
- Mostrar o nome da seção e quantos VPLs ela contém
- Seleção por clique

**Tela 4 — Confirmação e progresso:**
- Lista das questões VPL encontradas na seção
- Número de alunos que serão consultados
- Barra de progresso durante o carregamento das submissões (pode ser lento — uma chamada por aluno por questão)
- Botão "Importar"

**Tela 5 — Resultado:**
- Resumo: X questões importadas, Y alunos, Z submeteram / W não submeteram
- Botão "Usar essa importação" que carrega os dados no estado principal do app

### 6. Considerações de performance

As chamadas `mod_vpl_open` são feitas **uma por aluno por questão**. Para uma turma de 40 alunos com 4 questões, são 160 chamadas HTTP. Implementar:

- Execução em paralelo com concorrência limitada (ex: máximo 5 chamadas simultâneas) usando um pool de Promises
- Indicador de progresso incremental (`X de Y submissões carregadas`)
- Timeout por chamada e retry em caso de falha de rede (1 retry)
- Opção de "pular alunos sem submissão" para acelerar quando se sabe que há faltantes

---

## Restrições e Observações

- A aplicação roda em **Electron**, então não há restrição de CORS — as chamadas HTTP podem ser feitas diretamente do processo renderer ou main (preferir main para segurança do token)
- O token de acesso deve ser armazenado de forma segura (não em localStorage — usar `electron-store` com encriptação ou o keychain do sistema operacional via `keytar`)
- O enunciado em HTML pode conter referências a imagens do Moodle via `pluginfile.php`. Essas URLs precisam do token para carregar. Ao renderizar o HTML no app, as URLs de imagem devem ser reescritas para incluir o token como parâmetro (`?token=TOKEN`)
- Casos de teste (`vpl_evaluate.cases`) podem estar vazios se o professor usou um script de avaliação customizado (`vpl_evaluate.sh`) em vez do sistema BIOTES padrão. Tratar esse caso com aviso ao usuário
- A função `mod_vpl_open` com `userid` de um aluno exige que o token pertença a um usuário com papel de **professor/grader** na atividade. Se retornar `accessdenied`, exibir mensagem clara
- Alunos filtrados devem excluir professores/monitores (filtrar por `roles[].shortname === "student"`)

---

## Contexto adicional do projeto

- Stack: Electron + Vite + React + TypeScript
- Gerenciamento de estado: (definir — sugestão: Zustand pela simplicidade)
- Estilização: (definir — provavelmente Tailwind CSS)
- O app já tem um sistema de visualização de código (`main.cpp` por aluno) e execução de testes baseado em import de ZIP — o módulo Moodle deve **alimentar o mesmo estado/store** que o import ZIP alimenta, para que o resto do app funcione sem modificações
- Idioma da UI: Português (pt-BR)
- O professor é o único usuário — não há multiusuário nem sessões

---

## Resultado esperado ao final da implementação

Ao clicar em "Importar do Moodle" no app, o professor deve ser capaz de:

1. Autenticar com seu token
2. Escolher `C02 – Algoritmos 2025/1` → seção `P2`
3. Ver que há 4 questões VPL: QUESTÃO 1, 2, 3 e 4
4. Clicar em Importar e aguardar o carregamento
5. Ter disponível no app, para cada questão:
   - O enunciado formatado em HTML/Markdown
   - Os casos de teste parseados e prontos para execução
   - O código `main.cpp` de cada aluno, organizados por aluno
6. O app então executa os casos de teste localmente em cada `main.cpp` e exibe os resultados — essa parte já existe no app e não precisa ser reimplementada
