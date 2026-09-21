# Extração direta — banco, `moodledata` e CLI

Caminhos que não passam por HTTP. São os mais completos e os mais rápidos, e os
que exigem mais: acesso de infraestrutura, não apenas credencial de professor.

Este projeto **não usa nenhum deles** e provavelmente não deve — é um app desktop
que roda na máquina do professor, e professor não tem (nem deveria ter) acesso ao
banco do Moodle. O documento existe porque, para uma análise institucional feita
com a TI, este é o caminho certo, e porque conhecer o modelo de dados esclarece o
que as rotas HTTP estão realmente devolvendo.

Convenção de níveis ([USADA] / [CERTA] / [CONFIRMAR]) no
[README](README.md#níveis-de-confiança).

---

## Leitura do banco em réplica — [CERTA] o modelo, [CONFIRMAR] colunas

**Regra número um: réplica somente leitura.** Consulta analítica em banco de
produção do Moodle derruba ambiente — as tabelas de log e de arquivos são grandes
e mal indexadas para esse tipo de acesso.

O prefixo `mdl_` é o padrão, mas é **configurável** (`$CFG->prefix` em
`config.php`). Confirme antes de escrever qualquer query.

### Tabelas de interesse

| Tabela | Contém | Equivale a |
|--------|--------|------------|
| `mdl_user` | Pessoas: `id`, `username`, `firstname`, `lastname`, `email`, `idnumber`, `lastaccess` | `core_enrol_get_enrolled_users` |
| `mdl_course` | Cursos: `id`, `fullname`, `shortname`, `idnumber`, `category` | `core_course_get_courses` |
| `mdl_course_modules` | Instâncias de atividade: `id` (= **cmid**), `course`, `module`, `instance`, `visible` | `core_course_get_contents` |
| `mdl_modules` | Tipos de módulo (`vpl`, `assign`, `quiz`) — junta com `course_modules.module` | — |
| `mdl_course_sections` | Seções: `id`, `course`, `section`, `name`, `sequence` | seções de `get_contents` |
| `mdl_context` | Contextos — necessário para permissões e arquivos | — |
| `mdl_role_assignments` + `mdl_role` | Quem é aluno, quem é professor, em qual contexto | `roles[]` |
| `mdl_user_enrolments` + `mdl_enrol` | Matrículas, com `status` (ativa/suspensa) e datas | `onlyactive` |
| `mdl_groups` + `mdl_groups_members` | Grupos | `groups[]` |
| `mdl_grade_items` | Itens de nota: `iteminstance`, `itemmodule`, `grademax` | `gradereport_user_get_grade_items` |
| `mdl_grade_grades` | Notas: `itemid`, `userid`, `finalgrade`, `timemodified` | idem |
| `mdl_vpl` | Atividades VPL: configuração, datas, nota máxima | `mod_vpl_info` |
| `mdl_vpl_submissions` | **Toda submissão, não só a última** | `mod_vpl_get_result` + histórico |
| `mdl_logstore_standard_log` | **Log de eventos completo** | *sem equivalente em WS* |
| `mdl_files` | Metadados de arquivos, com `contenthash` | `core_files_get_files` |

### `mdl_vpl_submissions` — a tabela central para este projeto

Colunas que interessam (nomes a **confirmar** com `DESCRIBE`, pois variam entre
versões do plugin):

| Coluna | Conteúdo |
|--------|----------|
| `id` | Id da submissão |
| `vpl` | FK para `mdl_vpl.id` — a **instância**, não o cmid |
| `userid` | Aluno |
| `datesubmitted` | **Carimbo unix da submissão** |
| `grade` | Nota da avaliação |
| `dategraded` | Quando foi avaliada |
| `grader` | Quem avaliou (0 = automático) |
| `nevaluations` | Número de avaliações |

**O ganho decisivo:** esta tabela tem **uma linha por submissão**, não por aluno.
É a fonte perfeita para a série temporal `submission_events.csv` — o mesmo dado que
hoje o projeto obtém, com custo N×M, raspando
`previoussubmissionslist.php` aluno por aluno.

Consulta equivalente ao que o app monta em dezenas de requisições:

```sql
-- Toda submissão de todas as atividades VPL de um curso, com aluno e atividade.
-- Confirme o prefixo (mdl_) e os nomes de coluna na sua instância.
SELECT  u.id                AS userid,
        u.email,
        u.idnumber,
        cm.id               AS cmid,
        v.name              AS atividade,
        s.id                AS submissionid,
        FROM_UNIXTIME(s.datesubmitted) AS enviado_em,
        s.grade,
        s.dategraded,
        s.grader
FROM       mdl_vpl_submissions s
JOIN       mdl_vpl            v  ON v.id = s.vpl
JOIN       mdl_course_modules cm ON cm.instance = v.id
JOIN       mdl_modules        m  ON m.id = cm.module AND m.name = 'vpl'
JOIN       mdl_user           u  ON u.id = s.userid
WHERE      v.course = :courseid
ORDER BY   s.datesubmitted;
```

Note o `JOIN` triplo `course_modules` → `modules` → `vpl`: é o que resolve
**cmid ↔ instance**, a confusão que gera a maior parte dos erros `invalidrecord`
nas rotas HTTP.

### `mdl_logstore_standard_log` — dados de acesso

A tabela que não tem equivalente em Web Service. Colunas principais:

| Coluna | Conteúdo |
|--------|----------|
| `eventname` | Classe PHP do evento (`\mod_vpl\event\course_module_viewed`) |
| `component` | `mod_vpl`, `core`, … |
| `action` / `target` | `viewed` / `course_module` |
| `userid` | Quem agiu |
| `courseid`, `contextinstanceid` | Onde — `contextinstanceid` é o **cmid** em contexto de módulo |
| `timecreated` | Quando (unix) |
| `origin`, `ip` | Como (web/cli/ws) e de onde |

```sql
-- Visualizações por aluno em cada atividade VPL, antes da primeira submissão.
SELECT l.userid, l.contextinstanceid AS cmid, COUNT(*) AS visualizacoes,
       FROM_UNIXTIME(MIN(l.timecreated)) AS primeira_visualizacao
FROM   mdl_logstore_standard_log l
WHERE  l.courseid = :courseid
  AND  l.component = 'mod_vpl'
  AND  l.action = 'viewed'
GROUP BY l.userid, l.contextinstanceid;
```

**Cuidados:** é a maior tabela do Moodle (dezenas de milhões de linhas em
instituições médias); sempre filtre por `courseid` **e** por intervalo de
`timecreated`. `eventname` é nome de classe PHP e muda entre versões — filtre por
`component` + `action`, que são mais estáveis.

---

## `moodledata` — arquivos no disco

O diretório de dados (`$CFG->dataroot`) guarda o conteúdo dos arquivos. Dois
esquemas convivem:

**Pool geral (`filedir/`)** — arquivos de todos os módulos, armazenados por hash
SHA-1 com sharding de dois níveis:

```
moodledata/filedir/ab/cd/abcdef0123456789...
```

O nome original, o dono e o contexto estão em `mdl_files` (`contenthash`,
`filename`, `component`, `filearea`, `itemid`). Sem a tabela, o disco é
ilegível — os arquivos não têm nome nem extensão.

**Diretório próprio do VPL** — [CONFIRMAR] o caminho exato na sua instalação: o
plugin mantém as submissões em uma árvore própria sob `moodledata`
(tipicamente `vpl_data/{vplid}/usersdata/{userid}/{submissionid}/`), fora do pool
de `mdl_files`.

Isso explica por que `mod_vpl_open` devolve os arquivos **embutidos em base64** em
vez de uma `fileurl`: eles não estão no repositório padrão de arquivos, e portanto
não são acessíveis por `pluginfile.php`.

**Recomendação:** não leia `moodledata` diretamente. Além de exigir acesso ao
sistema de arquivos do servidor, o mapeamento hash → arquivo depende do banco, e
qualquer erro de interpretação produz dados atribuídos ao aluno errado. Use o ZIP
do VPL.

---

## CLI do Moodle — [CERTA]

Scripts em `admin/cli/`, executados no servidor como o usuário do web server.
Relevantes para extração:

| Script | Uso |
|--------|-----|
| `admin/cli/cfg.php` | Lê/escreve configuração — útil para confirmar `prefix`, `dataroot`, `sessiontimeout` |
| `admin/cli/purge_caches.php` | Limpa cache após mudança direta no banco |
| `admin/cli/scheduled_task.php` | Executa uma tarefa agendada na hora |

### Backup por CLI

```bash
# Caminho estável para backup automatizado — sem o assistente de várias etapas.
php admin/cli/backup.php --courseid=42 --destination=/tmp/backups
```

É o modo confiável de obter `.mbz` em lote, sem lidar com `sesskey` nem com o
fluxo web descrito em
[`extracao-por-arquivos.md`](extracao-por-arquivos.md#backup-do-curso-mbz).

> `admin/cli/backup.php` existe nas versões atuais; confirme os parâmetros com
> `php admin/cli/backup.php --help` antes de agendar.

---

## `moosh` — [CERTA]

Ferramenta de linha de comando de terceiros, amplamente usada em administração de
Moodle. Executa no servidor, com acesso ao banco e ao `moodledata`.

```bash
moosh course-list                  # cursos
moosh user-list                    # usuários
moosh course-backup 42             # backup de um curso
moosh sql-run "SELECT ..."         # query arbitrária
```

Vale como atalho para exploração e para scripts de administração. Para extração
recorrente, uma query em réplica é mais previsível — `moosh` roda contra o banco
de produção.

---

## Quando usar cada um

| Situação | Caminho |
|----------|---------|
| App na máquina do professor (este projeto) | **HTTP**: Web Service + sessão |
| Análise institucional, vários cursos, com a TI | **Réplica do banco** |
| Série histórica entre semestres | **Backup `.mbz` por CLI** |
| Dados de acesso em volume | **`mdl_logstore_standard_log`** em réplica |
| Exploração pontual pelo administrador | `moosh` |
| Ler arquivo direto do disco | **Não faça** — use o ZIP do VPL |

## Por que este projeto fica no HTTP

Três razões, na ordem em que pesam:

1. **Quem usa é o professor**, e o professor tem credencial de professor — não
   tem, nem deve ter, acesso ao banco da instituição. Uma ferramenta que exigisse
   isso não seria instalável por quem precisa dela.
2. **O modelo de permissão do Moodle é a garantia de escopo.** Passando pelo HTTP,
   o app vê exatamente o que aquele professor pode ver, nada além. No banco, essa
   fronteira desaparece e passa a depender do cuidado de quem escreveu a query.
3. **Compatibilidade entre versões.** O contrato do Web Service é versionado; o
   esquema do banco não é. Uma atualização do Moodle quebraria queries
   silenciosamente, com dados errados em vez de erro.

O custo dessa escolha é conhecido e está registrado: chamadas N×M para histórico e
avaliação automática, e ausência total de dados de log. Se um dia essas lacunas
pesarem mais que os três motivos acima, o caminho da réplica está mapeado aqui.
