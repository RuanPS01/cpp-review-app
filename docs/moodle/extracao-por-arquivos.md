# Extração por arquivos — exportações prontas do Moodle

O Moodle já sabe exportar boa parte do que interessa: livro de notas, respostas de
questionário, log de eventos, e o curso inteiro em um backup. Nenhum desses
caminhos precisa de Web Service, nenhum sofre com N+1, e todos produzem arquivo —
o que os torna a melhor origem quando o volume é alto ou quando a análise vai
acontecer offline, em Python.

O projeto **não usa nenhum deles hoje**. Este documento existe para registrar o que
está disponível e o que cada um custaria integrar.

Convenção de níveis ([USADA] / [CERTA] / [CONFIRMAR]) no
[README](README.md#níveis-de-confiança).

---

## Livro de notas

**[CERTA]** a rota e o parâmetro `id`; **[CONFIRMAR]** os campos do formulário que dispara o download.

```
GET /grade/export/{txt|xls|ods|xml}/index.php?id={courseid}
```

| Formato | Saída |
|---------|-------|
| `txt` | CSV, com separador escolhido no formulário (vírgula, tab, ponto e vírgula) |
| `xls` | Excel |
| `ods` | OpenDocument |
| `xml` | XML do Moodle |

**Fluxo em duas etapas:** o `GET` devolve um formulário onde se escolhe quais itens
de nota exportar, se inclui feedback, o separador e o formato de nota; o `POST`
(com `sesskey`) devolve o arquivo.

Os **nomes dos campos do formulário variam entre versões** (`itemids[]`,
`export_feedback`, `separator`, `display`, `decimals`, `checkbox_controller1`…).
Por isso o nível é [CONFIRMAR]: leia o HTML do formulário na sua instância antes de
automatizar. A rota e o parâmetro `id` são estáveis.

**O que entrega, comparado ao Web Service:** a mesma informação de
`gradereport_user_get_grade_items`, em arquivo, **sem depender de o admin liberar
nada** — exportar notas é permissão de professor
(`moodle/grade:export` + `gradeexport/txt:view`).

**Quando compensa:** cursos grandes, ou quando o Web Service está totalmente
bloqueado. Para o volume típico deste projeto (uma prova, uma turma), o Web
Service em uma chamada com `userid=0` é mais simples.

**Armadilha:** o CSV traz notas **formatadas conforme o locale** — "9,00" com
vírgula decimal em pt-BR. Quem for ler em pandas precisa de `decimal=','`, ou
escolher no formulário o formato "nota real" com ponto.

---

## Tarefas (mod_assign)

**[CERTA]**

```
GET /mod/assign/view.php?id={cmid}&action=downloadall   → ZIP com todas as entregas
GET /mod/assign/view.php?id={cmid}&action=grading       → tabela de correção (HTML)
```

O `downloadall` é o **análogo exato** do
`mod/vpl/views/downloadallsubmissions.php` que o projeto já usa: uma requisição,
todas as entregas da turma. A estrutura interna do ZIP segue o padrão de
nomenclatura de pastas configurado na Tarefa (nome do aluno + id da entrega), e
**não** carrega o carimbo de tempo no nome como o VPL faz — a data tem que vir da
tabela de correção ou de `mod_assign_get_submissions`.

Para uma versão deste app que atendesse turmas avaliadas por Tarefa em vez de VPL,
este par (`downloadall` + `mod_assign_get_submissions`) cobriria código e metadados
com o mesmo desenho que já existe.

---

## Questionários

**[CERTA]** a rota e `mode`; **[CONFIRMAR]** os valores de `download` aceitos pela sua versão.

```
GET /mod/quiz/report.php?id={cmid}&mode={modo}&download={formato}
```

| `mode` | Conteúdo |
|--------|----------|
| `overview` | Uma linha por tentativa: aluno, início, duração, nota |
| `responses` | **Uma linha por tentativa com a resposta dada em cada questão** |
| `statistics` | Índices de dificuldade e discriminação **por questão**, já calculados |
| `grading` | Correção manual de questões abertas |

`download` aceita `csv`, `excel`, `ods` e outros formatos do `table_dataformat`,
com disponibilidade variando por versão — confirme na interface, onde o seletor
"Baixar dados da tabela como" lista exatamente o que aquela instância suporta.

**Dois destaques para análise:**

- `mode=responses` é o análogo de `submissions.csv` no mundo dos questionários:
  grão de tentativa × questão, pronto para pivotar.
- `mode=statistics` entrega **de graça** o que o
  [`LEIA-ME.md` das exportações](../estatisticas.md#7-exportação-em-csv) ensina a
  calcular em pandas: índice de dificuldade e de discriminação por questão. Vale
  como referência de validação — se o cálculo próprio divergir muito do que o
  Moodle reporta para um questionário equivalente, o cálculo está errado.

---

## Log de eventos

**[CERTA]** a rota e o modelo de filtros; **[CONFIRMAR]** os nomes exatos dos filtros na sua versão.

```
GET /report/log/index.php?id={courseid}&chooselog=1&logreader=logstore_standard&download=csv
```

Filtros úteis (nomes a confirmar na versão): `modid` (atividade), `user`, `date`
(timestamp do dia), `modaction` (`view`, `create`, `update`…).

### Por que este é o dado que mais falta

**Não existe função de Web Service para o log** no Moodle padrão. Este relatório e
a tabela `mdl_logstore_standard_log` são os únicos caminhos — e é a informação que
resolveria a maior ambiguidade das estatísticas atuais.

Hoje, dois alunos sem entrega recebem exatamente o mesmo diagnóstico ("nenhuma
entrega", risco 60):

| Aluno | O que o log mostraria | Intervenção correta |
|-------|-----------------------|---------------------|
| A | nunca abriu a atividade | contato, evasão provável |
| B | abriu 12 vezes, baixou o enunciado, nunca submeteu | dificuldade técnica ou conceitual — ajuda, não cobrança |

O score de risco atual não os separa. Com o log, entrariam pelo menos:

- **tempo até a primeira visualização** após a abertura da atividade;
- **número de visualizações antes da primeira submissão** — proxy de esforço de
  leitura;
- **abandono**: última interação de qualquer tipo, não só a última entrega;
- **sessões de trabalho**: agrupar eventos por proximidade temporal dá duração de
  estudo, que hoje é inferida grosseiramente do intervalo entre tentativas.

### Custo de integrar

Baixo no caminho por arquivo: uma requisição por curso, CSV pronto. O trabalho
real é o mapeamento — as colunas do log (`eventname`, `component`, `action`,
`target`, `objectid`, `contextinstanceid`) precisam ser casadas com o `cmid` da
atividade, e `eventname` é uma classe PHP
(`\mod_vpl\event\course_module_viewed`), não um rótulo estável de negócio.

**Volume:** um curso ativo gera milhares de linhas por semana. Filtrar por
atividade e por intervalo é obrigatório; baixar o log inteiro de um semestre não é
viável pela interface.

**Privacidade:** o log é o dado mais sensível de toda esta análise — reconstrói o
comportamento minuto a minuto de pessoas identificadas. Ver
[`limites-permissoes-e-privacidade.md`](limites-permissoes-e-privacidade.md).

---

## Outros relatórios de curso

**[CERTA]**

| Relatório | Rota | Entrega |
|-----------|------|---------|
| Participação | `/report/participation/index.php?id={courseid}` | Contagem de visualizações e ações por aluno em **uma** atividade, num intervalo — resumo pronto do log |
| Atividade do curso | `/report/outline/index.php?id={courseid}` | Visualizações por atividade, agregadas |
| Conclusão | `/report/progress/index.php?course={courseid}` | Matriz aluno × atividade de conclusão, com download em CSV |

**O relatório de Participação merece atenção**: entrega o essencial do log
(quantas visualizações, quantas ações, por aluno) **já agregado**, sem o custo de
volume nem a complexidade de mapear `eventname`. Para o caso de uso deste projeto
— separar "não tentou" de "tentou e travou" — pode ser suficiente, e é bem mais
barato que processar o log bruto.

---

## Backup do curso (`.mbz`)

**[CERTA]**

```
/backup/backup.php?id={courseid}     → assistente de backup, várias etapas com sesskey
/backup/restorefile.php?contextid=…  → área de arquivos de backup, para baixar o .mbz
```

O `.mbz` é um **tar comprimido** com o curso inteiro. Conteúdo relevante:

| Dentro do `.mbz` | Contém |
|------------------|--------|
| `moodle_backup.xml` | Manifesto: atividades, seções, versão do Moodle |
| `users.xml` | Usuários incluídos no backup |
| `grades.xml` / `gradebook.xml` | Itens de nota e notas |
| `logs.xml` | Log de eventos (quando marcado no assistente) |
| `activities/vpl_{cmid}/` | Configuração da atividade VPL, casos de teste e submissões |
| `files.xml` + `files/` | Arquivos, indexados por hash |

**A propriedade única:** é a **única forma de obter tudo de uma vez**, offline,
sem N+1 e sem depender de nenhuma configuração de Web Service. Para arquivamento
ou para uma análise retrospectiva de vários semestres, é o caminho certo.

**Custos reais:**

- o assistente tem **múltiplas etapas com `sesskey`**; automatizar é trabalhoso e
  frágil (o caminho estável é o CLI, ver
  [`extracao-direta.md`](extracao-direta.md#backup-por-cli));
- **incluir dados de usuário** exige a permissão `moodle/backup:userinfo`, que nem
  todo professor tem;
- o XML é **verboso e versionado** — o formato muda entre versões maiores do
  Moodle;
- gera arquivo grande e carga real no servidor.

**Recomendação:** trate o `.mbz` como caminho de arquivamento e de análise
histórica, não como fonte de importação recorrente.

---

## Comparação para decidir

| Caminho | Requisições | Depende do admin? | Formato | Melhor para |
|---------|-------------|-------------------|---------|-------------|
| Web Service | 1 por função (ou N×M) | **Sim** — função no serviço | JSON | Dados estruturados, importação recorrente |
| Espelhamento de páginas | 1 por página | Não | HTML | O que o WS não expõe |
| **ZIP de submissões** | **1 por atividade** | Não | ZIP | **Código de toda a turma** |
| Exportação de notas | 2 (form + arquivo) | Não | CSV/XLS | Livro de notas em volume |
| Relatório de questionário | 1 | Não | CSV | Análise de itens de quiz |
| Log / Participação | 1 por curso | Não | CSV | **Dados de acesso — sem alternativa** |
| Backup `.mbz` | várias etapas | Não (mas exige `backup:userinfo`) | tar+XML | Arquivamento, análise histórica |

## O que valeria integrar, em ordem

1. **Relatório de Participação** — resolve a ambiguidade "não tentou vs travou"
   com uma requisição e sem processar log bruto. Melhor retorno por esforço.
2. **Log de eventos filtrado por atividade** — a versão completa da mesma ideia:
   permite tempo até primeira visualização e sessões de trabalho.
3. **Exportação de notas em CSV** — só se o Web Service estiver bloqueado; caso
   contrário é redundante.
4. **Backup `.mbz`** — para manter uma série histórica entre semestres, não para o
   fluxo do dia a dia.
