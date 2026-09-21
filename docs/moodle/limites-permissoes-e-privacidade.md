# Limites, permissões e privacidade

O que cada rota exige de permissão, quanto custa em requisições e volume, e o que
o conjunto todo implica em termos de dados pessoais. É o documento a ler antes de
automatizar qualquer coisa nova contra o Moodle da instituição.

Convenção de níveis ([USADA] / [CERTA] / [CONFIRMAR]) no
[README](README.md#níveis-de-confiança).

---

## 1. Capacidades exigidas por rota

Capacidades ("capabilities") são as permissões nomeadas do Moodle, concedidas pelo
papel no contexto. Token válido **não** substitui capacidade: o Web Service
executa como o usuário dono do token e é barrado pelas mesmas regras da interface.

### Web Service

| Função | Capacidade | Nível |
|--------|-----------|-------|
| `core_webservice_get_site_info` | nenhuma além de WS habilitado | [CERTA] |
| `core_course_search_courses` | visibilidade do curso | [CERTA] |
| `core_course_get_contents` | `moodle/course:view` ou matrícula | [CERTA] |
| `core_enrol_get_enrolled_users` | `moodle/course:viewparticipants` + `moodle/user:viewdetails` | [CERTA] |
| `core_user_get_users_by_field` | `moodle/user:viewdetails` (no contexto) | [CERTA] |
| `gradereport_user_get_grade_items` | `gradereport/user:view`; outros usuários: `moodle/grade:viewall` | [CERTA] |
| `mod_vpl_info` | `mod/vpl:view` | [CERTA] |
| `mod_vpl_open` (outro usuário) | `mod/vpl:grade` | [CERTA] |
| `mod_vpl_get_result` (outro usuário) | `mod/vpl:grade` | [CERTA] |
| `mod_vpl_evaluate` / `mod_vpl_save` | `mod/vpl:grade` / `mod/vpl:submit` | [CONFIRMAR] |
| Emitir token (`/login/token.php`) | `moodle/webservice:createtoken` | [CERTA] |

### Páginas e arquivos (sessão)

| Rota | Capacidade | Nível |
|------|-----------|-------|
| `mod/vpl/view.php` | `mod/vpl:view` | [CERTA] |
| `mod/vpl/views/submissionslist.php` | `mod/vpl:grade` | [CERTA] |
| `mod/vpl/views/downloadallsubmissions.php` | `mod/vpl:grade` | [CERTA] |
| `mod/vpl/views/previoussubmissionslist.php` | `mod/vpl:grade` | [CERTA] |
| `/grade/export/*` | `moodle/grade:export` + `gradeexport/{formato}:view` | [CERTA] |
| `/report/log/index.php` | `report/log:view` (curso) / `report/log:viewtoday` | [CERTA] |
| `/report/participation/index.php` | `report/participation:view` | [CERTA] |
| `/backup/backup.php` com dados de usuário | `moodle/backup:backupcourse` + `moodle/backup:userinfo` | [CERTA] |

### O modo de falha silenciosa que mais engana

Faltar `mod/vpl:grade` **não gera erro**. A página
`submissionslist.php` existe para o aluno também — ela apenas mostra o próprio
histórico. Uma importação feita sem essa capacidade termina "com sucesso" e uma
turma de um aluno.

Sintoma: importação rápida demais, um único registro, taxa de entrega 100%. Antes
de suspeitar do parser, confira o papel no curso.

O mesmo vale para `moodle/grade:viewall`: sem ela,
`gradereport_user_get_grade_items` com `userid=0` devolve apenas o próprio usuário
em vez de erro.

---

## 2. Custo: o que é barato e o que é N×M

Com **A** atividades e **E** alunos matriculados:

| Operação | Requisições | Ordem |
|----------|-------------|-------|
| Token + busca de curso + conteúdos | 3 | constante |
| `core_enrol_get_enrolled_users` | 1 | constante |
| `gradereport_user_get_grade_items` (`userid=0`) | 1 | **constante — a turma inteira** |
| `mod_vpl_info` | A | linear |
| `mod/vpl/view.php` | A | linear |
| `submissionslist.php` | A | linear |
| `downloadallsubmissions.php` (ZIP) | A | **linear, e traz E códigos** |
| `mod_vpl_get_result` | **A × E** | quadrático |
| `previoussubmissionslist.php` | **A × E** | quadrático |
| `mod_vpl_open` | A × E | quadrático (evitado pelo ZIP) |

Turma de 60 alunos com 4 questões:

| Configuração | Requisições |
|--------------|-------------|
| Mínima (sem avaliação automática, sem histórico) | ~20 |
| Com avaliação automática | ~260 |
| Com avaliação automática **e** histórico completo | ~500 |

Daí as três decisões de projeto:

1. **ZIP em vez de `mod_vpl_open`** — 4 requisições em vez de 240, e ainda com o
   carimbo exato da submissão.
2. **Avaliação automática e histórico são opcionais** na interface, com o custo
   explicado no rótulo.
3. **Aborta o laço na primeira falha** — falha na primeira chamada de um laço N×M
   significa serviço bloqueado; iterar coleciona 239 erros idênticos e gasta o
   tempo do professor.

### Não existe limite de taxa padrão, e isso não é permissão

O Moodle não impõe *rate limit* nas rotas de Web Service por padrão. Mas o
servidor da instituição tem CPU finita, pode estar atrás de WAF que interpreta
centenas de requisições sequenciais como abuso, e outras pessoas estão usando o
ambiente. As requisições do projeto são **sequenciais de propósito**: paralelizar
reduziria o tempo de importação e aumentaria a chance de derrubar (ou ser
bloqueado por) o ambiente compartilhado.

### Volumes que surpreendem

| Dado | Ordem de grandeza |
|------|-------------------|
| ZIP de submissões | alguns MB por atividade; cresce com o número de arquivos por aluno |
| Código armazenado por submissão | truncado em **20.000 caracteres** (`MAX_STORED_CODE_CHARS`) |
| `core_enrol_get_enrolled_users` sem paginação | um registro por matriculado, tudo em um JSON |
| Log de eventos de um curso ativo | **milhares de linhas por semana** — sempre filtrar |
| Corpo aceito pelo servidor do app | 50 MB (`body-parser` em `app.js`) |

---

## 3. Dados pessoais

### O que é coletado e onde fica

| Dado | Origem | Onde é gravado |
|------|--------|----------------|
| Nome, e-mail, matrícula, login | `core_enrol_get_enrolled_users` | `data/statistics/stats_{turma}.json` |
| Grupos, último acesso ao curso | idem | idem |
| Notas por atividade | VPL, livro de notas | idem |
| **Código-fonte** | ZIP de submissões | idem (truncado em 20.000 caracteres) |
| Horários de submissão | ZIP, lista de submissões, histórico | idem |
| Saída de compilador e avaliador | `mod_vpl_get_result` | idem |

O diretório de dados fica **apenas no disco local** e está fora do controle de
versão (`server/data/` no `.gitignore`). Nada é enviado para serviço externo —
com **uma exceção que precisa ser dita**: quando o professor gera uma análise de
IA com um provedor de nuvem (OpenAI, Gemini, Claude), os dados daquele recorte
saem da máquina. `statistics.prompts.js` limita o que vai: métricas agregadas e
amostras de código truncadas. Ainda assim:

- o **nome do aluno** vai no prompt do diagnóstico individual;
- a lista de alunos sinalizados vai no plano de intervenção;
- **com o provedor Ollama nada sai da máquina** — é a configuração indicada quando
  a instituição não autoriza processamento externo de dados de alunos.

### Exportações em CSV

Os arquivos gerados pela aba de Estatísticas contêm `student_key`, `student_name`
e `email` — identificadores diretos. O `LEIA-ME.md` incluído em cada ZIP avisa
isso na primeira seção. Recomendações que valem repetir aqui:

- não versione as exportações em repositório;
- para compartilhar resultado, pseudonimize: troque `student_key` por um índice e
  remova nome e e-mail (a chave é estável, então o mapeamento pode ficar em um
  arquivo separado e controlado);
- `submission_events.csv` e o log são os mais sensíveis: reconstroem rotina de
  estudo, inclusive madrugadas e fins de semana.

### Princípios que o projeto segue

1. **Só ler.** Nenhuma rota de escrita é chamada — nem `mod_vpl_save`, nem
   `mod_vpl_evaluate`, nem POST de formulário com `sesskey`. Uma ferramenta que
   não escreve não pode corromper o Moodle da instituição.
2. **Escopo herdado do Moodle.** Passando por HTTP com a credencial do professor,
   o app vê exatamente o que aquele professor pode ver. A fronteira de acesso é a
   do Moodle, não uma decisão do código.
3. **Nada de credencial persistida.** A senha é usada para obter o token e a
   sessão, e é limpa do estado (`setCredentials(prev => ({...prev, password: ''}))`)
   depois da importação. Token e cookie vivem em memória durante a sessão do app.
4. **Localidade por padrão.** Dados no disco do professor; IA local disponível.

### O que exige decisão institucional, não técnica

- **Finalidade e retenção.** Os datasets ficam no disco até serem removidos à mão.
  Não há expiração automática. Definir por quanto tempo se guarda dado de aluno é
  decisão da instituição.
- **Log de eventos.** Se a extensão descrita em
  [`extracao-por-arquivos.md`](extracao-por-arquivos.md#log-de-eventos) for
  implementada, o app passa a manter comportamento minuto a minuto de pessoas
  identificadas. Isso muda a natureza do tratamento e deve ser autorizado antes,
  não depois.
- **IA em nuvem com dados de aluno.** Enviar nome e código de aluno para um
  provedor externo é transferência de dado pessoal a terceiro. Ollama local existe
  exatamente para dispensar essa decisão.

---

## 4. Checagens antes de automatizar algo novo

1. **`core_webservice_get_site_info` primeiro.** `functions[]` diz o que o token
   realmente alcança; `release` diz com qual versão você está lidando. Uma
   requisição que economiza uma importação inteira.
2. **Confirme a capacidade, não só o token.** Teste com o papel real do professor,
   em um curso real. Faltar `mod/vpl:grade` não dá erro — dá uma turma de um aluno.
3. **Meça o custo em requisições antes de escrever o laço.** Se for A × E, ele
   precisa ser opcional e precisa abortar na primeira falha.
4. **Valide conteúdo, não status.** ZIP que vem como HTML, erro que vem como 200.
5. **Registre a origem de cada campo.** Quem analisa o CSV meses depois precisa
   saber se um vazio é "não aconteceu" ou "não foi coletado". É o que as colunas de
   fonte e o guia do ZIP resolvem.
6. **Verifique o nível de confiança** desta documentação para a rota em questão. Se
   estiver [CONFIRMAR], inspecione o HTML ou a resposta na sua instância — o nome
   do parâmetro pode ter mudado de versão.
