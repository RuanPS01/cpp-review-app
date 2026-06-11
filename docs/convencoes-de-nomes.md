# Convenções de Nomes

Padrões de nomenclatura observados no projeto, por área. Seguir estas convenções mantém o código previsível e consistente.

## Arquivos e Pastas de Código

### Backend (`/server`)
| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Módulo de feature | pasta `kebab`/lowercase por domínio | `features/grades/` |
| Rotas | `{feature}.routes.js` | `grades.routes.js` |
| Controller | `{feature}.controller.js` | `grades.controller.js` |
| Infra/núcleo | lowercase descritivo | `core/socket.js`, `config/env.js` |
| Utilitário | `camelCase.js` | `fileHelpers.js` |
| Estilo de módulo | CommonJS (`require`/`module.exports`) | — |

### Frontend (`/client`)
| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Componente / Página | `PascalCase.tsx` | `ReviewPage.tsx`, `Modal.tsx` |
| Hook | `useCamelCase.ts` | `useReviewLogic.ts` |
| Serviço | `camelCase.ts` | `api.ts`, `moodle.ts` |
| Tipos | `index.ts` em `types/` | `types/index.ts` |
| Estilo de módulo | ESM (`import`/`export`) | — |

## Código

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| Componentes React | `PascalCase` | `<MoodleImportWizard />` |
| Hooks | prefixo `use` + `camelCase` | `useGlobalAI` |
| Variáveis e funções | `camelCase` | `selectedTurma`, `handleSave` |
| Handlers de evento | prefixo `handle` | `handleEditChange`, `handleRunTests` |
| Tipos / Interfaces | `PascalCase` | `Student`, `AISettings`, `AnalysisItem` |
| Constantes de config | `UPPER_SNAKE_CASE` | `DATA_DIR`, `DEFAULT_SETTINGS` |
| Endpoints de socket | `kebab-case` | `run-code`, `terminal-input` |

## Rotas REST

- Prefixo único `/api`.
- Recursos em `kebab-case`: `/update-grade`, `/import-moodle-cookies`, `/run-tests`, `/export-grades/:turma`.
- Parâmetros de rota nomeados: `/turma/:name`, `/export-grades/:turma`.
- Parâmetros de turma frequentemente passados via query string em GETs: `/weights?turma=...`, `/statements?turma=...`.

## Dados em Disco

| Item | Padrão | Exemplo |
|------|--------|---------|
| Arquivo de notas | `grades_turma_{Turma}.json` | `grades_turma_Prova 1.json` |
| Pasta da turma | `turma_{Turma}/` | `turma_Prova 1/` |
| Recursos da turma | `statements.json`, `testcases.json`, `weights.json` | — |
| Chave de questão | `q{n}` (alguns endpoints aceitam também `{n}`) | `q1`, `q2` |
| Identificador de aluno | `folder_name` (estável) | `john_doe_12345` |

## Template de Pastas de Alunos

Tokens usados em `folderTemplate` para extrair metadados na importação ([fileHelpers.js](../server/src/utils/fileHelpers.js)):

| Token | Significado | Captura |
|-------|-------------|---------|
| `[NAME]` | Nome do aluno | sim |
| `[ID]` | Matrícula (dígitos) | sim |
| `[EMAIL]` | E-mail | sim |
| `[IGNORE]` | Segmento ignorado | não |

Exemplo de template: `[NAME] [ID] [EMAIL]` ou `[EMAIL] [NAME] [ID]`.

## Idiomas no Código

- **Código, identificadores e nomes de arquivo:** inglês (`updateGrade`, `ReviewPage`).
- **Documentação e textos de UI:** português (com i18n pt-BR / en-US para a interface).
- **Dados de domínio** (nome de turma, enunciados): conforme o usuário/origem (Moodle).

## Versionamento

- Versão única e sincronizada entre raiz, `client` e `server` no `package.json` (atualmente **2.2.1**).
- Branches de trabalho seguem `feature/...` e `fix/...` (ex: `feature/backend-reorganization`).
- Commits seguem **Conventional Commits** (`feat:`, `fix:`, `refactor:`).
