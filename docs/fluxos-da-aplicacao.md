# Fluxos da Aplicação

Diagramas de sequência dos principais fluxos de uso, cobrindo frontend, backend, disco e serviços externos.

## Visão dos atores

| Ator | Papel |
|------|-------|
| **Professor** | Usuário final |
| **Renderer** | SPA React (client) |
| **Main** | Processo principal Electron |
| **Server** | Backend Express/Socket.IO (:3001) |
| **Disco** | `data/` (JSON + `.cpp`) |
| **IA** | Provedor selecionado (Ollama/OpenAI/Gemini/Claude) |
| **Moodle** | Servidor Moodle/VPL |

---

## 1. Importação via ZIP

```mermaid
sequenceDiagram
    actor Prof as Professor
    participant R as Renderer
    participant S as Server
    participant D as Disco

    Prof->>R: arrasta ZIP + define turma + folderTemplate
    R->>S: POST /api/import (multipart)
    S->>S: extrai ZIP (fallback CP850)
    S->>S: parseFolderWithTemplate por pasta
    S->>S: findCppInDir (localiza .cpp)
    S->>D: grava grades_turma_{turma}.json
    S->>D: extrai .cpp em turma_{turma}/...
    S->>S: remove ZIP temporário
    S-->>R: { ok, turma }
    R->>R: navega para TablePage
```

---

## 2. Revisão e Correção de um Aluno

```mermaid
sequenceDiagram
    actor Prof as Professor
    participant R as Renderer (ReviewPage)
    participant S as Server
    participant D as Disco

    Prof->>R: seleciona aluno/questão
    R->>S: GET /api/code?path=...
    S->>D: lê arquivo .cpp (confinado a DATA_DIR)
    S-->>R: conteúdo do código
    R->>R: exibe no Monaco + enunciado (marked)
    Prof->>R: ajusta nota + comentário (Ctrl+S)
    R->>S: POST /api/update-grade
    S->>D: atualiza grades_turma_{turma}.json
    S->>S: recalcula flag reviewed do aluno
    S-->>R: ok
    R->>R: toast + atualiza estado local
```

---

## 3. Execução Interativa de Código (Terminal)

```mermaid
sequenceDiagram
    actor Prof as Professor
    participant R as Renderer (TerminalPanel)
    participant S as Server (socket.js)
    participant D as Disco

    Prof->>R: clica "Rodar Código"
    R-->>S: emit run-code { filePath, codeOverride? }
    alt codeOverride presente
        S->>D: grava arquivo temporário _test
    end
    S->>S: g++ compila
    alt erro de compilação
        S-->>R: terminal-data (erro) + limpa temp
    else sucesso
        S->>S: abre PTY (cmd.exe / bash)
        S->>S: executa binário (após ~500ms)
        loop interação
            S-->>R: terminal-data (stdout/stderr)
            Prof->>R: digita entrada
            R-->>S: emit terminal-input
        end
        S-->>R: terminal-data (exit code)
        S->>D: limpa binário/temp após 1s
    end
```

---

## 4. Execução de Casos de Teste (VPL)

```mermaid
sequenceDiagram
    actor Prof as Professor
    participant R as Renderer
    participant S as Server (tests)
    participant D as Disco

    Prof->>R: clica "Rodar Testes"
    R->>S: POST /api/run-tests { turma, studentId, questionNum, filePath, code? }
    S->>D: lê testcases.json
    opt code fornecido
        S->>D: cria arquivo _test_suite.cpp
    end
    S->>S: g++ compila
    loop cada caso de teste
        S->>S: executa (stdin = input, timeout 2s)
        S->>S: compara esperado x obtido
    end
    S->>D: limpa temporários
    S-->>R: { success, results[] }
    R->>R: overlay com tabela pass/fail
```

---

## 5. Análise por IA — Individual

```mermaid
sequenceDiagram
    actor Prof as Professor
    participant R as Renderer (ReviewPage)
    participant S as Server (ai)
    participant D as Disco
    participant IA as Provedor IA

    Prof->>R: clica "Analisar com IA"
    R->>S: POST /api/analyze { turma, questionNum, code }
    S->>D: lê settings.json + statements.json
    S->>S: monta system prompt (critérios + enunciado)
    S->>IA: chamada conforme provider
    IA-->>S: resposta (texto/JSON)
    S->>S: extrai JSON via regex
    S-->>R: { score, comment }
    R->>R: modal de preview (aplicar / copiar / descartar)
    opt aplicar
        R->>S: POST /api/update-grade
        S->>D: grava nota
    end
```

---

## 6. Análise por IA — Global (em lote)

```mermaid
sequenceDiagram
    actor Prof as Professor
    participant R as Renderer (useGlobalAI)
    participant S as Server
    participant IA as Provedor IA
    participant D as Disco

    Prof->>R: "Análise IA Global" (opção: só não revisados)
    R->>R: initAnalysis → fila de AnalysisItem
    loop cada item
        R->>R: status = analyzing
        R->>S: POST /api/analyze
        S->>IA: análise
        IA-->>S: resultado
        S-->>R: { score, comment }
        R->>R: status = success / error · atualiza progresso
    end
    Prof->>R: "Aplicar Todos"
    loop cada sucesso
        R->>S: POST /api/update-grade
        S->>D: grava nota
    end
    R->>R: retry de erros/restantes se necessário
```

> O cancelamento usa `AbortController`; o estado é mantido por turma, permitindo retomar (`resumePendingAnalysis`).

---

## 7. Importação via Moodle / VPL

Combina REST API e fallback por cookie (capturado pelo processo Electron).

```mermaid
sequenceDiagram
    actor Prof as Professor
    participant R as Renderer (MoodleImportWizard)
    participant M as Main (Electron)
    participant Mo as Moodle/VPL
    participant S as Server
    participant D as Disco

    Prof->>R: informa URL + credenciais
    alt via REST API (token)
        R->>Mo: getToken / searchCourses / getCourseContents
        Mo-->>R: cursos e seções
        R->>Mo: getVplInfo / getStudentSubmission
        Mo-->>R: enunciados + submissões
        R->>S: POST /api/import-moodle
    else via cookie (permissões restritas)
        R->>M: window.moodleAuth.captureCookie(url, creds)
        M->>Mo: abre login, auto-preenche, captura MoodleSession
        M-->>R: { cookie, userAgent }
        R->>S: POST /api/import-moodle-cookies { cookie, baseUrl, ... }
        S->>Mo: busca páginas VPL (scraping)
        Mo-->>S: HTML (enunciado + casos de teste)
        S->>M: (download ZIP via IPC) ou S baixa
    end
    S->>D: grava grades_turma + statements.json + testcases.json
    S-->>R: resumo (turma, questões, alunos)
    Prof->>R: confirma (ou cancela → apaga turma)
```

Ver [Integração Moodle/VPL](moodle-vpl-integration-guide.md) para detalhes.

---

## 8. Exportação e Importação de Notas

```mermaid
sequenceDiagram
    actor Prof as Professor
    participant R as Renderer (TablePage)
    participant S as Server
    participant D as Disco

    rect rgb(20,40,60)
    note over Prof,D: Exportar
    Prof->>R: "Exportar" (Excel ou JSON)
    alt Excel
        R->>R: gera .xlsx (xlsx) e baixa
    else JSON
        R->>S: GET /api/export-grades/:turma
        S->>D: lê grades_turma_{turma}.json
        S-->>R: JSON → download
    end
    end

    rect rgb(40,30,60)
    note over Prof,D: Importar
    Prof->>R: seleciona JSON de notas
    R->>S: POST /api/import-grades
    S->>D: mescla por folder_name/id (score+comment)
    S-->>R: ok
    end
```

---

## Resumo dos Fluxos

```mermaid
graph LR
    Import["Importar<br/>(ZIP / Moodle)"] --> Table["Tabela de Notas"]
    Table --> Review["Revisar Aluno"]
    Review --> Run["Rodar / Testar Código"]
    Review --> AI["Analisar com IA"]
    Table --> GlobalAI["IA Global"]
    Review --> Save["Salvar Nota"]
    GlobalAI --> Save
    AI --> Save
    Save --> Export["Exportar Notas"]
```
