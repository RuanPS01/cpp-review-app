# Implementação do Editor de Código

Este documento descreve como o editor de código foi implementado na aplicação, garantindo uma experiência de desenvolvimento rica com destaque de sintaxe e funcionalidades de edição.

## Biblioteca Principal

O editor é construído sobre a biblioteca:
- **@monaco-editor/react** (v4.7.0): Uma implementação em React do **Monaco Editor**, o motor que alimenta o VS Code.

## Configuração e Integração

O editor está centralizado no componente `ReviewPage.tsx` e é envolvido por uma `div` com a classe `monaco-wrapper` para garantir o controle de layout.

### 1. Instalação e Configuração
O componente `Editor` é configurado com as seguintes propriedades principais:

```tsx
<Editor
    height="100%"
    defaultLanguage="cpp"
    theme={theme === 'dark' ? 'vs-dark' : 'light'}
    value={tempCode}
    onChange={(value) => setTempCode(value || '')}
    options={{
        fontSize: 14,
        fontFamily: "monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        renderLineHighlight: 'all',
        tabSize: 4,
        padding: { top: 16, bottom: 16 },
        automaticLayout: true,
        fontLigatures: false,
    }}
/>
```

### 2. Funcionalidades de Interface
- **Side-by-Side View:** O editor pode ser dividido com o enunciado da questão. Isso é controlado pelo estado `showSideBySide` e permite que o usuário redimensione o painel do enunciado arrastando uma divisória.
- **Temas Dinâmicos:** Alterna entre `vs-dark` e `light` sincronizado com o tema global.
- **Destaque de Mudanças:** Quando o código no editor difere do arquivo original no disco, um banner de aviso aparece na parte inferior com a opção de descartar as alterações locais.

## Gestão de Estado e Persistência

A lógica é orquestrada pelo hook `useReviewLogic.ts`.

1. **Estado `tempCode`:** Armazena as edições em tempo real. Não é salvo no disco automaticamente para evitar sobrescritas indesejadas.
2. **Atalhos de Teclado:** O editor suporta `Ctrl+S` (ou `Cmd+S`) para salvar a nota e o comentário atual, facilitando o fluxo de trabalho.
3. **Persistência via API:** Ao salvar, o conteúdo de `tempCode` pode ser enviado para o servidor para atualizar o arquivo do aluno no sistema de arquivos.

## Execução e Testes Integrados

O editor não é apenas um visualizador, ele está conectado às ferramentas de execução:

### Terminal Integrado
Ao clicar em "Rodar Código", o componente `TerminalPanel.tsx` é ativado, utilizando `xterm.js` para abrir uma conexão WebSocket com o backend. O código editado (mesmo o temporário) é enviado para o servidor, compilado e executado em um ambiente isolado.

### Overlay de Resultados (VPL)
Se houver casos de teste configurados para a questão (estilo VPL), o sistema permite rodar todos os testes em lote.
- Os resultados aparecem em um overlay de tela cheia com efeito de desfoque de fundo (`backdrop-blur`).
- Exibe status (Pass/Fail/Timeout), entrada, saída esperada e saída obtida em uma tabela detalhada.

## Customização Visual
O editor é envolto em uma estrutura que remove as bordas padrão do Monaco para que ele se funda perfeitamente com a estética "sem bordas" da aplicação, mantendo apenas as divisórias de painéis principais.
