# Web Services do Moodle — referência função a função

Detalhamento das funções de Web Service relevantes para extração de dados
pedagógicos. O contrato HTTP (envelope, formatos, exemplos executáveis) está em
[`moodle-api.yaml`](moodle-api.yaml); aqui ficam os parâmetros campo a campo, o
retorno, a capacidade exigida, o custo e a armadilha de cada uma.

Convenção de níveis ([USADA] / [CERTA] / [CONFIRMAR]) descrita no
[README](README.md#níveis-de-confiança).

---

## O modelo, em uma página

Tudo passa por **um** endpoint:

```
POST /webservice/rest/server.php
Content-Type: application/x-www-form-urlencoded

wstoken=...&wsfunction=core_course_get_contents&moodlewsrestformat=json&courseid=42
```

Três fatos que determinam quase todo o comportamento da integração:

1. **A função tem que estar no serviço externo.** Token válido não significa
   função disponível. O administrador adiciona funções uma a uma ao serviço; é a
   causa de praticamente todo `accessexception` que este projeto trata.
2. **Erro vem com HTTP 200.** A resposta de falha é
   `{exception, errorcode, message}` com status 200. Quem checar só o status vai
   tratar erro como sucesso.
3. **Arrays usam a notação de colchetes do PHP**, achatada no corpo do formulário:
   `courseids[0]=42`, `options[0][name]=onlyactive`.

> **Limitação do cliente atual:** `moodleCall()` faz `String(v)` em cada valor,
> ou seja, só monta parâmetros escalares. Funções que exigem array
> (`mod_assign_get_assignments`, `core_user_get_users_by_field`) precisam das
> chaves montadas na mão — é o principal ajuste necessário para usar as funções
> marcadas [CERTA] abaixo.

### Primeira chamada de qualquer integração

```
wsfunction=core_webservice_get_site_info
```

Devolve `functions[]` com **exatamente** o que o token pode chamar, além de
`release` (versão do Moodle) e a identidade do usuário. Descobrir a função
faltando aqui custa uma requisição; descobrir no meio de uma importação de 60
alunos custa a importação inteira.

O projeto ainda não faz essa chamada: ele descobre a indisponibilidade **falhando**
(`vplInfoAvailable = false` após a primeira exceção). Funciona, mas gasta uma
chamada com erro e não permite avisar o professor antes de começar.

---

## Núcleo — cursos e estrutura

### `core_course_search_courses` — [USADA]

Busca cursos por texto.

| Parâmetro | Tipo | Obrig. | Nota |
|-----------|------|--------|------|
| `criterianame` | string | sim | `search`, `modulelist`, `blocklist`, `tagid` |
| `criteriavalue` | string | sim | Texto buscado; vazio devolve os primeiros cursos |
| `page` / `perpage` | int | não | `perpage=0` usa o padrão do site |

**Retorno:** `{total, courses[{id, fullname, shortname, categoryid, summary}], warnings[]}`

**Capacidade:** nenhuma especial — busca respeita a visibilidade do curso para o usuário.

**Uso no projeto:** `searchCourses()`. Também chamada com `criteriavalue` vazio
como **teste de token** logo após o login, em `MoodleImportWizard`.

**Armadilha:** devolve apenas cursos visíveis ao usuário do token. Curso oculto
não aparece — se o professor não acha a prova, verifique a visibilidade antes de
suspeitar da integração.

---

### `core_course_get_contents` — [USADA]

Seções do curso com suas atividades. **A função mais importante do fluxo**: é dela
que sai o `cmid` de cada atividade VPL, que todas as rotas do VPL exigem.

| Parâmetro | Tipo | Obrig. |
|-----------|------|--------|
| `courseid` | int | sim |
| `options[n][name]` / `options[n][value]` | string | não |

Opções [CERTA]: `excludemodules`, `excludecontents`, `includestealthmodules`,
`sectionid`, `sectionnumber`, `cmid`, `modname`, `modid`.

**Retorno:** array de seções, cada uma com `modules[]`.

| Campo do módulo | Uso |
|-----------------|-----|
| `id` | **cmid** — chave de todas as rotas do VPL |
| `instance` | Id da instância (`mdl_vpl.id`) — não serve nas rotas do VPL |
| `modname` | O projeto filtra `vpl` |
| `name` | Nome da questão |
| `dates[]` | `{label, timestamp}` — origem do prazo |

**Capacidade:** `moodle/course:view` (ou estar matriculado).

**Armadilha — o rótulo da data é traduzido.** `dates[]` não tem campo semântico:
distinguir abertura de prazo depende de casar o texto de `label` ("Prazo:",
"Due:", "Opens:"). O projeto faz esse casamento por regex em
`harvester.parseActivityDates` e mantém `mod/vpl/view.php` como segunda fonte
justamente por isso.

**Filtrar no servidor sai mais barato:** `options[0][name]=modname` +
`options[0][value]=vpl` evita transferir o curso inteiro quando só interessam
atividades VPL. O projeto hoje traz tudo e filtra no cliente.

---

### `core_course_get_courses_by_field` — [CERTA]

| Parâmetro | Valores de `field` |
|-----------|--------------------|
| `field` | `` (todos), `id`, `ids`, `shortname`, `idnumber`, `category` |
| `value` | valor correspondente |

Mais preciso que a busca textual quando o id ou o shortname já é conhecido — o
caminho certo para reimportar a mesma prova sem depender do professor achar o
curso na lista.

---

### `core_course_get_course_module` — [CERTA]

`cmid` → metadados da atividade, incluindo `instance`, `modname`, `section` e o
`availability`. Resolve a confusão **cmid vs instance** quando só um dos dois é
conhecido.

---

## Núcleo — pessoas

### `core_enrol_get_enrolled_users` — [USADA]

Matriculados no curso. É a única fonte de **quem deveria ter entregado** — sem ela
não existe taxa de entrega, aluno inativo nem score de risco por ausência.

| Parâmetro | Tipo | Obrig. |
|-----------|------|--------|
| `courseid` | int | sim |
| `options[n][name]` / `options[n][value]` | string | não |

Opções [CERTA]: `withcapability`, `groupid`, `onlyactive`, `userfields`,
`limitfrom`, `limitnumber`, `sortby`, `sortdirection`.

**Retorno (campos que o projeto consome):**

| Campo | Uso na análise |
|-------|----------------|
| `id` | `userid` — chave de junção com tudo do VPL |
| `fullname`, `firstname`, `lastname` | Identificação; casamento com a pasta do ZIP |
| `email` | Chave de junção mais confiável entre turmas |
| `idnumber` | Matrícula institucional, quando preenchida |
| `lastaccess` | Último acesso ao **site** |
| `lastcourseaccess` | Último acesso a **este curso** — sinal de engajamento sem entrega |
| `groups[]` | `{id, name}` |
| `roles[]` | `{roleid, shortname, name}` |

**Capacidade:** `moodle/course:viewparticipants` + `moodle/user:viewdetails`.

**Armadilhas:**

- **Traz todos os papéis**, incluindo professores e tutores. O projeto filtra
  `roles[].shortname === 'student'` **no cliente** — se a instância renomeou o
  papel (`aluno`, `estudante`), o filtro devolve zero e a importação segue sem
  matriculados, apenas com quem entregou. Vale conferir o `shortname` real.
- **`email` pode vir ausente** por política de privacidade do site, mesmo com
  permissão de ver participantes. Quando isso acontece, o casamento entre turmas
  cai para nome, que é mais frágil.
- **Sem paginação por padrão.** Um curso com 2000 matriculados devolve 2000
  registros em um JSON. Use `limitfrom`/`limitnumber` acima de algumas centenas.
- **`onlyactive=1` muda o denominador.** Sem ele, matrículas suspensas entram na
  conta — é uma das origens dos cadastros que o filtro *"ignorar alunos sem
  histórico"* descarta depois. Passar `onlyactive` resolveria parte do problema na
  origem.

---

### `core_user_get_users_by_field` — [CERTA]

| `field` | `id`, `idnumber`, `username`, `email` |
| `values[n]` | lista de valores |

Resolve identidade em lote. **Endereça diretamente uma fragilidade atual:** o
casamento entre a pasta do ZIP e o aluno do Moodle hoje é heurístico
(e-mail → nome → matrícula, em `statistics.controller.js` → `matchStudent`).
Com esta função, a matrícula extraída do nome da pasta pode ser resolvida em
`userid` de forma determinística.

---

### `core_enrol_get_users_courses` — [CERTA]

`userid` → cursos do aluno. Caminho inverso do anterior; útil para acompanhar um
aluno específico ao longo de vários cursos.

---

### `core_group_get_course_groups` / `core_group_get_course_user_groups` — [CERTA]

Grupos do curso e grupos de um aluno. Em geral **dispensáveis**:
`core_enrol_get_enrolled_users` já devolve `groups[]` por aluno, o que o projeto
aproveita.

---

## Notas

### `gradereport_user_get_grade_items` — [USADA]

Livro de notas estruturado. Com `userid=0`, **a turma inteira em uma chamada** —
o melhor custo-benefício de nota em todo o catálogo.

| Parâmetro | Tipo | Nota |
|-----------|------|------|
| `courseid` | int | — |
| `userid` | int | `0` = todos (exige `moodle/grade:viewall`) |
| `groupid` | int | opcional |

**Retorno:** `usergrades[{courseid, userid, userfullname, gradeitems[]}]`.

| Campo do item | Uso |
|---------------|-----|
| `cmid` | **A ponte com a atividade.** `null` em categorias e no total do curso |
| `graderaw` | Nota numérica crua; `null` = sem nota lançada |
| `grademax` / `grademin` | Base para normalizar em percentual |
| `itemmodule` | `vpl`, `assign`, `quiz`, vazio em itens calculados |
| `gradeformatted`, `percentageformatted` | Texto localizado — não parseie, use `graderaw` |

**Capacidade:** `gradereport/user:view`; para outros usuários, `moodle/grade:viewall`.

**Uso no projeto:** `getCourseGradeItems()`, como **fallback de nota** quando
`mod_vpl_*` está bloqueado. O código ignora itens sem `cmid`, o que descarta
corretamente categorias e o total do curso.

**Armadilha:** a nota do livro de notas pode **divergir** da nota do VPL — o
professor pode ter ajustado manualmente, ou a atividade pode ter regra de redução
por atraso aplicada no gradebook. Quando as duas fontes existem, o projeto prefere
`mod_vpl_get_result` e só usa esta se a outra faltar. A divergência entre a nota
automática e a lançada é, ela mesma, uma métrica exposta na tela.

---

### `gradereport_user_get_grades_table` — [CERTA]

Mesma informação, porém **já renderizada em HTML dentro das células**. Existe para
alimentar a interface. Prefira `..._get_grade_items`, que devolve números.

---

### `gradereport_overview_get_course_grades` — [CERTA]

Nota final do aluno em cada curso em que está matriculado. Visão de "boletim",
não de atividade.

---

## VPL

O plugin VPL expõe **cinco** funções de Web Service. Duas são de escrita e estão
documentadas aqui apenas para que ninguém as chame por engano ao explorar a API.

> Confirme a lista real da sua instância com `core_webservice_get_site_info` →
> `functions[]`. A instalação do plugin não habilita nada automaticamente: cada
> função precisa ser adicionada ao serviço externo.

### `mod_vpl_info` — [USADA]

Metadados da atividade. `id` é o **cmid**.

**Retorno (campos consumidos):**

| Campo | Uso |
|-------|-----|
| `name` | Nome da atividade |
| `intro` | **Enunciado em HTML** |
| `grade` | Nota máxima. Valor negativo indica *escala* em vez de nota numérica |
| `startdate`, `duedate` | Segundos — o projeto multiplica por 1000 |
| `executionfiles[]` | `{name, data, encoding}` — os **casos de teste** vêm aqui |

Os casos de teste estão em `executionfiles[]` no arquivo `vpl_evaluate.cases`,
no formato:

```
Case = Soma simples
Input = 3
1 2 3
Output = 6
Grade reduction = 20%
```

Parser em `client/src/services/moodle.ts` → `parseCases()`; o formato completo
está documentado na
[seção 10 do guia de integração](../moodle-vpl-integration-guide.md).

**Capacidade:** `mod/vpl:view`.

**Armadilha:** `grade` negativo (escala) faria a normalização percentual explodir.
O projeto trata isso em `questionMaxGrade()`, que cai para 10 quando o valor não é
positivo.

---

### `mod_vpl_open` — [USADA]

Arquivos submetidos por um aluno. Sem `userid`, devolve a submissão do dono do
token.

**Retorno:** `files[{name, data, encoding}]` — `encoding: 0` = texto,
`1` = base64.

**Capacidade:** `mod/vpl:view`; para ler outro usuário, `mod/vpl:grade`.

**Uso no projeto:** `getStudentSubmission()`, na importação de correção.

**Por que não é o caminho principal:** uma chamada por aluno × atividade. O ZIP
de `downloadallsubmissions.php` traz o mesmo conteúdo em **uma** requisição e
ainda inclui o carimbo exato da submissão no nome da pasta. Em uma turma de 60
alunos com 4 questões, são 240 chamadas contra 4.

---

### `mod_vpl_get_result` — [USADA]

**A fonte mais rica de todo o catálogo** e a única que entrega:

- os **casos de teste que falharam**, por aluno;
- a **saída do compilador**, e portanto os erros de compilação.

**Retorno:**

| Campo | Formato | Interpretação |
|-------|---------|---------------|
| `grade` | string | Pode vir localizada (vírgula decimal) |
| `compilation` | string | Saída do compilador |
| `evaluation` | string | Saída do avaliador |
| `execution` | string | Saída da execução |

`moodleHarvester.parseEvaluation` interpreta esse texto:

- nota: `Grade :=>> 9.00`
- casos reprovados: `Case = Nome (FAILED)`; quando ausente, comentários iniciados
  por `-`
- erros de compilação: `arquivo:linha:coluna: error: mensagem`

**Capacidade:** `mod/vpl:grade` para ler o resultado de outro usuário.

**Custo — a chamada mais cara do projeto:** N alunos × M atividades. 60 alunos ×
4 questões = 240 requisições sequenciais. Por isso:

- é uma **opção** no assistente ("Buscar avaliação automática por aluno");
- se a **primeira** chamada falhar, a varredura é abortada — falha na primeira
  quase sempre significa serviço bloqueado, e não vale colecionar 239 erros.

**Armadilha:** devolve o resultado da **última avaliação**, não da última
submissão. Um aluno que submeteu depois da avaliação tem `grade` desatualizada em
relação ao código do ZIP.

---

### `mod_vpl_evaluate` — [CERTA] · escrita

Dispara a avaliação automática no jail do VPL. **Não use para extração:** gera
carga real de execução no servidor e pode sobrescrever a avaliação existente.

Cenário legítimo: reavaliar uma turma após corrigir os casos de teste. Mesmo aí,
prefira fazê-lo pela interface, onde o VPL controla a fila.

### `mod_vpl_save` — [CERTA] · escrita

Grava uma submissão em nome do aluno (`files[n][name|data|encoding]`). Fora do
escopo de extração.

---

## Outros módulos — não usados, mas certos

O projeto é centrado em VPL. Para quem avalia com outros módulos, os equivalentes
diretos:

### Tarefa (`mod_assign`) — [CERTA]

| Função | Entrega |
|--------|---------|
| `mod_assign_get_assignments` | Tarefas do curso, prazos, configuração (`courseids[n]`) |
| `mod_assign_get_submissions` | Entregas por tarefa, data e estado (`assignmentids[n]`) |
| `mod_assign_get_grades` | Notas por tarefa |
| `mod_assign_save_grade` | **Escrita** — lançar nota |

`assignmentids` é o id da **instância**, não o cmid. O análogo do ZIP do VPL é
`/mod/assign/view.php?id={cmid}&action=downloadall`.

### Questionário (`mod_quiz`) — [CERTA]

| Função | Entrega |
|--------|---------|
| `mod_quiz_get_quizzes_by_courses` | Questionários do curso |
| `mod_quiz_get_user_attempts` | Tentativas de um aluno (`status`: `all`, `finished`, `unfinished`) |
| `mod_quiz_get_attempt_review` | Resposta e nota **por questão** de uma tentativa |

`get_attempt_review` é o análogo mais próximo de `mod_vpl_get_result`: permite
análise de itens por questão, como o `question_failed_cases.csv` faz para o VPL.

### Fórum (`mod_forum`) — [CERTA]

`mod_forum_get_forums_by_courses` e `mod_forum_get_forum_discussions` dão
participação em discussão — uma dimensão de engajamento que o app não mede hoje e
que não exige nenhum dado novo de permissão.

### Conclusão (`core_completion`) — [CERTA]

`core_completion_get_activities_completion_status` (por aluno) e
`core_completion_get_course_completion_status`. Só úteis se o curso tiver
rastreamento de conclusão configurado — em cursos de programação normalmente não
tem, o que reduz o valor prático.

### Arquivos (`core_files`) — [CERTA]

`core_files_get_files` lista o conteúdo de uma área de arquivos, necessário para
descobrir o que baixar via `pluginfile.php`. Dispensável no VPL, cujos arquivos
vêm embutidos em base64 nas respostas.

---

## Erros e diagnóstico

Todos chegam com **HTTP 200**.

| `errorcode` | Significado | O que fazer |
|-------------|-------------|-------------|
| `accessexception` | Função não está no serviço externo | Adicionar a função ao serviço; **é o caso mais comum** |
| `invalidtoken` | Token inválido, revogado ou expirado | Reemitir pelo `login/token.php` |
| `nopermissions` | Token válido, usuário sem a capacidade | Verificar o papel no curso |
| `invalidrecord` | Id inexistente | Quase sempre **cmid vs instance** trocados |
| `invalidparameter` | Parâmetro com tipo ou nome errado | Conferir a notação de array |
| `enabledpolicyservicerequired` | Serviço não habilitado para o usuário | Habilitar Web Services / o serviço |
| `webservicesnotenabled` | Web Services desligados no site | Configuração global do admin |
| `sitepolicynotagreed` | Usuário não aceitou a política do site | Aceitar pela interface, uma vez |

### Como o projeto degrada

Nenhuma dessas falhas derruba a importação. O padrão, em três níveis:

1. **Fonte opcional falha** → entra em `warnings`, a tela mostra o aviso e a fonte
   fica marcada como indisponível no painel.
2. **Fonte tem substituto** → cai para a alternativa (WS bloqueado →
   espelhamento de página).
3. **Falha na primeira chamada de um laço N×M** → aborta o laço inteiro, em vez de
   iterar colecionando erros.

É o que permite importar com o Web Service quase todo bloqueado, perdendo apenas
casos reprovados e erros de compilação — as duas coisas que **só** `mod_vpl_get_result`
entrega.
