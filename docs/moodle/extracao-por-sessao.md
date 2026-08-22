# Extração por sessão — sem Web Service

Como obter dados do Moodle usando apenas o **cookie de sessão** de um professor,
espelhando as páginas que ele já tem permissão para ver. É metade do pipeline
deste projeto e a única saída quando o administrador não habilita as funções
`mod_vpl_*` no serviço externo.

Convenção de níveis ([USADA] / [CERTA] / [CONFIRMAR]) no
[README](README.md#níveis-de-confiança).

---

## Por que este caminho existe

O Web Service é limitado pelo que o administrador liberou. A sessão é limitada
pelo que o **professor** pode ver — que é tudo que interessa numa análise de
turma. A troca é: em vez de JSON estável, HTML que muda com tema, versão e idioma.

| | Web Service | Sessão |
|---|---|---|
| Autenticação | `wstoken` | cookie `MoodleSession` |
| Alcance | só funções habilitadas | tudo que o professor vê |
| Formato | JSON versionado | HTML, ZIP, CSV |
| Estabilidade | contrato entre versões | **quebra com tema/idioma** |
| Dado exclusivo | casos reprovados, erros de compilação | **código de toda a turma em 1 request**, carimbo exato da submissão |

Nenhum dos dois substitui o outro. O projeto usa os dois na mesma importação.

---

## 1. Obter a sessão

### O caminho que o projeto usa — [USADA]

`electron-main.js`, handler IPC `open-moodle-login`:

1. Abre uma `BrowserWindow` real em `{baseUrl}/login/index.php`.
2. Se as credenciais foram informadas, injeta um script que preenche `#username`
   e `#password` e clica no botão de submit.
3. A cada `did-finish-load` e `did-navigate`, verifica:
   - a URL **deixou** de conter `login/index.php`, **e**
   - existe cookie `MoodleSession`.
4. Serializa **todos** os cookies (`nome=valor; nome=valor`) e captura o
   `User-Agent` real da janela.
5. Devolve `{cookie, userAgent}` ao renderer, que os envia ao servidor Node.

```js
// preload.js — a única superfície exposta ao renderer
contextBridge.exposeInMainWorld('moodleAuth', {
  captureCookie: (url, credentials) => ipcRenderer.invoke('open-moodle-login', url, credentials),
  downloadZIP: (url) => ipcRenderer.invoke('moodle-download-zip', url)
});
```

**Por que uma janela real, e não um POST no formulário:** SSO institucional, 2FA e
captcha. Quem resolve o desafio é o professor, na janela, com a interface de
verdade. Um `POST /login/index.php` exigiria replicar o `logintoken` anti-CSRF e
ainda assim quebraria em qualquer instância federada — é o caminho marcado
[CONFIRMAR] no [`moodle-api.yaml`](moodle-api.yaml).

**Detalhe que importa:** o `User-Agent` capturado é reenviado em todas as
requisições do servidor. Instâncias atrás de WAF costumam invalidar sessão usada
com User-Agent diferente do login.

### Ciclo de vida

- O cookie vale enquanto a sessão do Moodle valer (`sessiontimeout`, tipicamente
  algumas horas).
- **Não** é renovado pelo projeto: a importação inteira acontece na janela de
  validade da sessão capturada.
- Expiração é detectada pelo **redirecionamento para `login/index.php`**, que o
  `createSession` do harvester converte em erro explícito:

```js
if (nextUrl.includes('login/index.php')) throw new Error('Sessão inválida. Redirecionado para o login.');
```

Sem essa checagem, o parser receberia o HTML da página de login e devolveria
campos vazios silenciosamente — o pior modo de falha possível numa análise.

---

## 2. A sessão HTTP do servidor — [USADA]

`server/src/features/statistics/moodleHarvester.js` → `createSession()`.

Três comportamentos que fazem a diferença entre funcionar e não funcionar:

**Cabeçalhos de navegador completos.** Não é superstição: `Referer`,
`Sec-Fetch-*` e `Upgrade-Insecure-Requests` são exigidos por WAFs e por algumas
verificações do próprio Moodle. O `Referer` é sempre a página anterior do fluxo
real — `view.php` antes de `submissionslist.php`, esta antes do download.

**Redirecionamento manual (`redirect: 'manual'`).** O Moodle redireciona para o
login quando a sessão morre; seguir automaticamente esconderia a falha.

**Atualização incremental de cookies.** Cada resposta pode trazer `Set-Cookie`
(rotação de sessão, cookies de balanceador). O harvester faz o merge no mapa de
cookies em vez de substituir a string inteira:

```js
const setCookies = response.headers.getSetCookie
  ? response.headers.getSetCookie()
  : response.headers.get('set-cookie')?.split(',');
updateCookies(setCookies);
```

> `getSetCookie()` é a API correta para múltiplos `Set-Cookie`; o fallback por
> `split(',')` existe para runtimes antigos e é imperfeito (datas de expiração
> contêm vírgula). Em Node 20+ o primeiro ramo é sempre o usado.

---

## 3. Páginas do VPL

### `mod/vpl/view.php?id={cmid}` — [USADA]

Página da atividade. Substitui `mod_vpl_info`.

| Dado | Seletor / heurística | Função |
|------|----------------------|--------|
| Enunciado | `div#vpl_intro`; fallback `div.box.generalbox > div.no-overflow` | `parseStatement` |
| Casos de teste | `pre#codefileid1` (conteúdo de `vpl_evaluate.cases`) | `parseTestCases` |
| Datas | `<tr>` cujo rótulo casa *entrega/prazo/encerra* e *início/abertura/disponível* | `parseActivityDates` |
| Nota máxima | texto *"nota máxima"* / *"maximum grade"* / *"qualificação máxima"* + número | `parseMaxGrade` |

**Fragilidade explícita:** `#vpl_intro` e `#codefileid1` são ids do template do
VPL — estáveis entre versões do plugin, mas não garantidos. Os outros dois dados
saem de **texto traduzido**, e o parser cobre PT e EN. Outro idioma devolve `null`,
e o campo então vem do Web Service (se disponível) ou fica ausente.

### `mod/vpl/views/submissionslist.php` — [USADA]

A tabela mais valiosa do VPL: uma linha por aluno com data do último envio,
tentativas, nota e avaliação.

```
/mod/vpl/views/submissionslist.php?id={cmid}&showgrades=1&group=-1&tilast&tifirst&tperpage=5000&thiddenfields
```

| Parâmetro | Efeito | Uso no projeto |
|-----------|--------|----------------|
| `showgrades` | Inclui colunas de nota | `1` em estatísticas, `0` na importação de correção |
| `group=-1` | Todos os grupos | sempre |
| `tperpage=5000` | Linhas por página | turma inteira em **uma** resposta, sem paginar |
| `tilast` / `tifirst` (vazios) | Remove o filtro por inicial | evita herdar filtro da sessão |
| `thiddenfields` (vazio) | Revela colunas que o tema esconde | garante nota e data visíveis |

**Como o parser sobrevive à variação** (`parseSubmissionsList`):

1. Escolhe, entre todas as `<table>` da página, a que contém `userid=\d+` — é a
   tabela de alunos, independentemente de classe CSS.
2. Mapeia as colunas **pelo cabeçalho**, casando rótulos em PT e EN
   (`mapColumns`): nome, submissões, data, nota, avaliação.
3. Sem cabeçalho reconhecível, cai em heurísticas: a célula com link de aluno é o
   nome, a primeira data parseável é a submissão, o número isolado é a nota.
4. Extrai `userid` do **link**, não do texto — é a chave de junção com o Web
   Service, e é o único campo que não depende de tradução.

**Permissão:** `mod/vpl:grade`. Com papel de aluno, a página existe mas mostra
apenas o próprio histórico — a importação "funciona" e devolve um aluno. Se a
turma vier com um único registro, verifique o papel antes de suspeitar do parser.

### `mod/vpl/views/downloadallsubmissions.php?id={cmid}` — [USADA]

**A rota mais eficiente de todo o pipeline.** Um request traz o código-fonte de
toda a turma.

Estrutura do ZIP:

```
{pasta-do-aluno}/{AAAA-MM-DD-HH-MM-SS}/{arquivos}
```

Duas informações saem daí:

- **o código** de cada aluno — `readSubmissionsZip` reconhece
  `.cpp .cc .cxx .c .h .hpp` e mantém o **maior** deles como arquivo principal
  (heurística que acerta `main.cpp` sem depender do nome);
- **o carimbo exato da submissão**, no nome da pasta interna, com precisão de
  segundo. É a melhor fonte temporal do projeto: não depende de parsear data
  localizada, e alimenta o mapa de calor, a linha do tempo e a antecedência em
  relação ao prazo.

A pasta externa segue o template configurado no assistente
(`[EMAIL] [NAME] [ID]`), parseado por `parseFolderWithTemplate`.

**Detecção de falha — indispensável:** quando a sessão caiu ou falta permissão, o
Moodle responde **200 com HTML** em vez do ZIP. Verificação obrigatória antes de
descompactar:

```js
if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
  throw new Error('o Moodle devolveu HTML em vez do ZIP (sessão ou permissão)');
}
```

`0x50 0x4B` = `PK`, assinatura do ZIP. Sem essa checagem o `AdmZip` estoura com
uma mensagem incompreensível, e o professor não descobre que era a sessão.

**Download no Electron:** o handler IPC `moodle-download-zip` usa
`session.defaultSession.fetch`, que carrega os cookies da sessão do Electron
automaticamente. É por isso que o cookie capturado funciona sem ser reenviado a
mão nesse caminho.

### `mod/vpl/views/previoussubmissionslist.php?id={cmid}&userid={userid}` — [USADA] (opcional)

Histórico completo de tentativas de um aluno. **Única fonte de persistência**:
quantas vezes tentou e como a nota evoluiu.

Cada linha vira um evento em `submission_events.csv`, com `attempt_index` e
`is_final` — o que permite medir progresso dentro da mesma questão.

**Custo:** uma requisição por aluno × atividade. É a razão de ser opcional
("Buscar histórico completo de tentativas") e de a exportação registrar, no guia
do ZIP, se o histórico estava disponível naquele recorte.

O parser (`parsePreviousSubmissions`) é deliberadamente frouxo: pega a primeira
data parseável e o primeiro número não negativo de cada linha. Linhas de cabeçalho
sem link de submissão são descartadas.

### `mod/vpl/views/submissionview.php` — [CERTA], não usada

Uma submissão específica, com código e avaliação renderizados. É o destino dos
links de `submissionslist.php`.

Não usada porque o ZIP + a lista dão o mesmo conteúdo em lote. Serve para
inspeção pontual — conferir um caso suspeito sem reimportar.

### `mod/vpl/views/downloadsubmission.php` — [CERTA], não usada

ZIP de um único aluno. Para lote, `downloadallsubmissions.php` é sempre melhor.

---

## 4. Escrever pela sessão: `sesskey` — [CERTA]

Qualquer requisição que **altere** estado pela sessão precisa do token anti-CSRF
`sesskey`. Onde encontrá-lo em uma página autenticada:

- no JavaScript da página: `M.cfg.sesskey`;
- em um campo oculto de formulário: `<input type="hidden" name="sesskey" value="...">`.

```js
// extração do sesskey de um HTML já obtido
const sesskey = html.match(/"sesskey"\s*:\s*"([^"]+)"/)?.[1]
  || html.match(/name="sesskey" value="([^"]+)"/)?.[1];
```

O projeto **não** usa `sesskey`: ele só lê. Isso é uma propriedade de segurança
que vale preservar — uma ferramenta de análise que nunca escreve não pode corromper
o Moodle da instituição, e o professor não precisa confiar nela para isso.

Se algum dia for necessário escrever (lançar nota em lote, por exemplo), prefira
`mod_assign_save_grade` / a interface, não o POST de formulário: o Web Service tem
contrato, o formulário não.

---

## 5. API AJAX interna — [CERTA], não usada

```
POST /lib/ajax/service.php?sesskey={sesskey}&info={methodname}
Content-Type: application/json

[{"index":0,"methodname":"core_course_get_contents","args":{"courseid":42}}]
```

É como a própria interface do Moodle busca dados. Duas vantagens reais sobre
raspar HTML:

1. **Alcança métodos fora do serviço externo** — a autorização é a da sessão, não
   a do token. Um `core_course_get_contents` que o token não pode chamar funciona
   aqui.
2. **Aceita lote:** várias chamadas em um request, respostas na mesma ordem.

Duas ressalvas: é **API interna**, sem contrato de estabilidade entre versões, e
exige o `sesskey`.

**Quando usar:** se o Web Service estiver bloqueado e a alternativa for parsear
HTML, este endpoint é melhor — um JSON instável ainda é mais robusto que um
seletor de CSS. Seria o caminho natural para o projeto obter dados estruturados
em instâncias onde o admin não libera nada, e é a evolução mais promissora deste
documento.

---

## 6. Regras que este caminho impõe

Aprendidas na implementação, aplicáveis a qualquer extração por sessão:

1. **Nunca confie no status HTTP.** ZIP que vem como HTML, erro que vem como 200,
   login que vem como 303. Valide o **conteúdo**: assinatura de arquivo, presença
   da tabela esperada, ausência de formulário de login.
2. **Identifique colunas por cabeçalho, não por posição.** Temas reordenam e
   escondem colunas; a posição não é contrato.
3. **Extraia chaves de links, não de texto.** `userid=\d+` na URL sobrevive a
   qualquer tradução; "Nome completo" não.
4. **Todo parser devolve `null`, nunca lança.** Um campo ausente é um campo
   ausente; uma exceção derruba a importação inteira de 60 alunos por causa de uma
   célula.
5. **Registre a fonte de cada dado.** O painel mostra quais fontes estavam
   disponíveis, e o guia da exportação repete essa informação — sem isso, quem
   analisa o CSV não sabe se um campo vazio é "não aconteceu" ou "não foi coletado".
6. **Peça o máximo por request.** `tperpage=5000` em vez de paginar; ZIP da turma
   em vez de laço por aluno. Cada requisição a mais é tempo do professor esperando
   e carga no Moodle da instituição.
7. **Preserve o User-Agent do login.** Sessão usada com outro agente é sessão
   rejeitada em instâncias com WAF.
