# Identidade Visual, Padrão de Cores e Estilos

Este documento detalha a identidade visual do projeto, incluindo a paleta de cores, tipografia e os padrões de estilização utilizados para criar uma interface moderna e responsiva.

## Conceito Visual
A aplicação utiliza uma estética inspirada em interfaces de alta tecnologia e editores de código modernos, com foco em legibilidade, contraste e feedback visual imediato. Possui suporte nativo a temas **Dark** (padrão) e **Light**.

## Padrão de Cores (CSS Variables)

As cores são gerenciadas através de variáveis CSS definidas em `client/src/index.css`, permitindo a troca dinâmica de temas apenas alterando uma classe no elemento raiz (`html`).

### Tema Escuro (Dark) - Padrão
- **Background App (`--bg-app`):** `#000000` (Preto puro para alto contraste)
- **Painéis (`--bg-panel`):** `#171717`
- **Cards (`--bg-card`):** `#0a0a0a`
- **Inputs (`--bg-input`):** `#000000`
- **Botões (`--bg-button`):** `#262626`
- **Destaque (Accent) (`--accent`):** `#06b2d2` (Ciano vibrante)
- **Brilho (`--accent-glow`):** `rgba(6, 182, 212, 0.4)`
- **Texto Principal (`--text-main`):** `#d1d5db` (Cinza claro)
- **Texto Secundário (`--text-dim`):** `#737373`
- **Texto Brilhante (`--text-bright`):** `#ffffff`
- **Bordas Principal (`--border-main`):** `#262626`

### Tema Claro (Light)
- **Background App:** `#f5f5f5`
- **Painéis/Cards:** `#ffffff`
- **Destaque (Accent):** `#0891b2`
- **Texto Principal:** `#374151`
- **Texto Secundário:** `#6b7280`

## Tipografia
A aplicação utiliza duas famílias de fontes principais:
1. **Inter:** Fonte sans-serif moderna para toda a interface de UI, garantindo clareza e legibilidade.
2. **Fira Code / Monospace:** Utilizada para blocos de código, terminal e editor, suportando ligaduras para uma melhor experiência de leitura de código.

## Tecnologias de Estilização

### Tailwind CSS v4
O projeto utiliza a versão 4 do Tailwind CSS, que permite uma integração profunda com CSS nativo via o bloco `@theme`. As variáveis CSS são mapeadas para classes do Tailwind, permitindo o uso de utilitários como `bg-panel`, `text-accent`, `border-border-main`, etc.

```css
@theme {
  --color-app: var(--bg-app);
  --color-panel: var(--bg-panel);
  --color-accent: var(--accent);
  /* ... mapeamento completo em index.css */
}
```

### Animações CRT
Para dar um toque retrô e tecnológico, modais e elementos de alerta utilizam animações inspiradas em monitores CRT.
- **`animate-crt-open`:** Escala o elemento verticalmente e depois horizontalmente.
- **`animate-crt-close`:** O inverso da abertura, criando um efeito de desligamento.

```css
@keyframes crt-open {
  0% { transform: scaleY(0.005) scaleX(0); opacity: 0; }
  50% { transform: scaleY(0.005) scaleX(1); opacity: 1; }
  100% { transform: scaleY(1) scaleX(1); opacity: 1; }
}
```

## Elementos de Interface

### Glow Effects
Elementos ativos ou de destaque utilizam `box-shadow` com a variável `--accent-glow` para simular uma emissão de luz, reforçando a estética cyberpunk/high-tech.

### Glassmorphism
Uso de `backdrop-blur-md` e fundos semi-transparentes (ex: `bg-app/95`) em overlays como os resultados de testes e modais de análise, permitindo ver o contexto subjacente sem perder o foco.

### Scrollbars Personalizados
Estilizados globalmente para serem minimalistas:
- Largura: `6px` a `8px`.
- Track: Cor do background da aplicação.
- Thumb: Cor dos botões, tornando-se mais visível ao hover.

### Iconografia
Utiliza a biblioteca **Lucide React** para ícones consistentes, leves e customizáveis, geralmente seguindo a cor `--text-dim` e mudando para `--accent` em estados ativos.
