# Implementação de Visualização de Markdown e HTML

Este documento descreve como o projeto realiza a renderização de enunciados e conteúdos em formato Markdown e HTML na interface do usuário.

## Bibliotecas Utilizadas

A principal biblioteca utilizada para a conversão de Markdown para HTML é a:
- **marked** (v18.0.3): Um interpretador de Markdown de alto desempenho que converte texto puro em strings HTML.

## Fluxo de Implementação

### 1. Conversão e Renderização
A renderização ocorre principalmente na página de revisão (`ReviewPage.tsx`). O conteúdo do enunciado, que é armazenado como texto puro (Markdown), é processado pela biblioteca `marked` e inserido no DOM utilizando a propriedade `dangerouslySetInnerHTML` do React.

```tsx
import { marked } from 'marked';

// ... dentro do componente
<div className="markdown-content">
    <div dangerouslySetInnerHTML={{ __html: marked.parse(statements[`q${currentQ}`]) }} />
</div>
```

### 2. Painel de Visualização Redimensionável
O enunciado é exibido em um painel lateral que suporta:
- **Modo Lado a Lado:** Ativado via botão "Ver Enunciado".
- **Redimensionamento Dinâmico:** O usuário pode arrastar a borda direita do painel para ajustar a largura (entre 200px e 800px). Isso é implementado com eventos de `onMouseDown`, `onMouseMove` e `onMouseUp` globais para garantir suavidade.
- **Persistência:** A preferência de visualização (aberto/fechado) é salva no `localStorage`.

## Estilização Detalhada (CSS)

Como o conteúdo renderizado via `marked` não possui classes Tailwind, utilizamos seletores descendentes sob a classe `.markdown-content` definidos globalmente em `App.tsx`.

### Principais Regras de Estilo:
- **Estrutura:**
    - `h1, h2, h3`: Cores vibrantes (`--text-bright`), margens generosas e pesos de fonte negrito.
    - `p`: Altura de linha de `1.6` para melhor legibilidade.
    - `ul, ol`: Listas com recuo (`padding-left: 1.5rem`) e marcadores padrão.
- **Código:**
    - `code` (inline): Fundo `var(--bg-button)`, cor de destaque (`var(--accent)`) e bordas arredondadas.
    - `pre` (blocos): Fundo escuro puro, borda `1px solid var(--border-main)` e suporte a scroll horizontal automático.
- **Elementos Especiais:**
    - `blockquote`: Borda lateral de 4px com a cor de destaque e texto em itálico/cinza.
    - `table`: Tabelas ocupam 100% da largura, com bordas colapsadas e cabeçalhos destacados.
    - `img`: Responsivas (`max-width: 100%`) com bordas levemente arredondadas.
    - `a`: Links utilizam a cor de destaque e sublinhado para clara identificação.

## Suporte a HTML e Segurança
A aplicação suporta nativamente a exibição de conteúdos HTML complexos (comuns em exportações do Moodle/VPL), pois o `marked` preserva tags HTML válidas por padrão.

**Segurança:** O uso de `dangerouslySetInnerHTML` é aceitável neste contexto por tratar-se de uma ferramenta interna onde os enunciados são originados de fontes confiáveis (professores). Caso a aplicação venha a receber conteúdo de fontes desconhecidas, um sanitizador como `dompurify` deve ser integrado ao pipeline de renderização.
