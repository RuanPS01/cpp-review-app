Nesta pasta de trabalho tenho a submisão de código C++ de prova (Prova 2) de 2 turmas: A, G e I. 
A organizaçõa da pastas está na sequência: <turma>/<questao>/<aluno>/<data-hora>/<arquivo-cpp> 
Exemplo: "Provas_Alunos\Prova2_Turma_A\QUESTÃO 1\guerzoni_matheus@gec_inatel_br Matheus de Souza Guerzoni Ribeiro 965 guerzoni_matheus@gec_inatel_br\2026-03-16-19-48-10" 
 
Seu objetivo de ação atual é: corrigir o código de cada aluno com base nas informações a baixo de correção e questões de cada prova de cada turma. 
 
Na mesma pasta de trabalho atual tenho 2 arquivos de planilha que possui o nome de cada aluno e 4 colunas (Q1, Q2, Q3 e Q4) que consistem nas notas de 0 a 100 de cada questão. Você deve preencher essa planilha que ela irá calcular a nota final de cada aluno com base nas notas individuais de cada questão. 
Os arquivos estão separados por turma: 
Notas_Pv1_C02_Turma_A.xlsx 
Notas_Pv1_C02_Turma_G.xlsx 
Notas_Pv1_C02_Turma_I.xlsx 
 
As planilhas também possuem uma coluna de comentários, onde pretendo colocar observações do que estava errado, de forma objetiva. 
 
Com base nas informações abaixo faça as correções conforme solicitado. 
 
# Avaliação de prova 
 
Foi realizada a Prova 2 de Algoritmos e Estrutura de dados I. Na pasta de trabalho atual temos as submissões de resposta das turmas: 
- Turma A; 
- Turma G;
- Turma I;

 
Linguagem de programação utilizada: C++ (Sem o uso de POO) 
 
Conteúdo de Prova: 
- Variáveis (Tipagem, Declaração, Atribuição, nomenclatura); 
- Entrada e Saída (cin, cout) 
- Operadores e Operações (Operadores Aritméticos, Lógicos, Relacionais e Bibliotecas <iomanip> (fixed << setprecision) e <cmath>) 
- Estruturas de Decisão (if, if-else, switch) 
 
A prova consiste em implementar os códigos para a solução de 4 questões. Os códigos submetidos passam por uma bateria de testes que simula entradas específicas e espera saída específicas. Na pasta de trabalho atual temos as submissões em pastas separadas por aluno com o nome do formato "<email> <nome>" onde dentro dessas pastas estão outras duas pastas, uma que contém o código em cpp e outra com txt das saídas dos testes automatizados. 
 
As pastas dos alunos estão divididas em 3 subpastas, cada uma de uma turma; 
 
Para definir um padrão de correção coerente com todas as entregas, abaixo se encontram as regras principais de análise das submissões: 
--- 
# Sistema de correção 
 
Pontuações e exceções: 
- Cada questão deve ser pontuada de 0 a 100; 
- O resultado final é a média simples entre as notas das questões sem diferença de pesos; 
- Um código implementado pelo aluno não necessariamente deve rodar para receber pontuações, a proximidade com a resposta correta deve ser considerada; 
- Estruturas base obrigatórias para a criação de um código, rendem apenas 1 ponto na questão (1 de 100). 
- Uma questão terá pontuação 0 se: 
	* Se for uma implementação para tentativa de burlar o teste automatizado, simulando saídas específicas para entradas específicas, ou seja colocando apenas ifs e couts sem lógica de implementação; 
	* Se foi implementada utilizando estruturas de código que não fazem parte do conteúdo de prova; 
- O aluno pode escolher  
 
Regras de correção para desconto de pontuação. Considerando que cada questão vale de 0 a 100, uma questão não terá 100 quando os descontos dos erros abaixo acontecerem: 
- (-5 pontos) - Se uma estrutura de repetição está com a quantidade de repetições incorretas (apenas erro de quantidade), ou apenas com condição inversa; 
- (-10 pontos) - Se há pequenos erros de identação de código; 
- (-20 pontos) - Se todo o código está sem identação; 
- (-10 pontos) - Se foi utilizada tipagem de variável errada para o problema proposto; 
- (-10 pontos) - Se o código está praticamente correto perânte ao que a questão pede, porém com erro de sintaxe (Exemplos: acesso a uma variável que não existe por erro de digitação; "ponto-e-vírgula" faltante; chave ou parêntezes de abertura ou fechamento faltante; caractere de operador relacional faltante) 
- (-30 pontos) - Se a lógica do que foi implementado está inversa com o que foi pedido na questão (Exemplo: a questão pediu valor maior, e retornar o menor e vice versa)  
- (-30 pontos) - Se uma operação matemática que foi solicitada pela questão possui erros de lógica matemática implementada; 
- (-10 pontos) - Se a saída de resultado do código está diferente (visualmente) ou faltante para o resultado esperado (Ex: é esperado "X = " e o terminal mostrou "valor-> ") 
- (-80 pontos) - Se o código possui lógica inconsistente ou que não condiz com o que foi pedido mas possui demais implementações realizadas corretamente como a entrada e saída de informações e demais estruturas; 
 
Situações conhecidas: 
- Caso uma implementação de código não faça sentido diante da programação, a questão deverá ser pontuada até no máximo 20 pontos de acordo com as estruturas que foram implementadas corretamente diante ao que foi pedido pela questão. 
	Exemplo de erros: `int 2.0;` ou `int (A < 2); {}` ou `2 = X;` ou `cin >> 1.0;` 
	  
- Caso a implementação esteja incompleta, exemplo: somente os cin de entrada, ou somente as saídas, não contendo a lógica central do que foi pedido, a pontuação máxima diante do que foi feito deve ser até 10 pontos somente. 

- Caso hava mais erros de código que não foram citados aqui mas podem ser avaliados, pondere e desconte de 5 a 10 pontos da questão conforme a criticidade  do erro de implementação.

- Não há notas negativas

- Se uma questão teve bastantes erros mas teve alguma implementação que faça sentido, mesmo que minimamente, ou seja, ela não é completamente 0, mesmo que a subtração dos pontos citados acima chegue em 0. Ou seja, pondere o grau de assertividade geral caso as subtrações dos critérios não se aplique corretamente.
--- 
 
# Informações de prova de cada turma: 
Os enunciados das questões de cada turma está na subpasta principal no mesmo nível das pastas das respostas, nos arquivos markdown (md). 
--- 
 
# Com essas informações em mãos faça a correção de cada aluno, em cada questão, de cada turma, e preencha as planilhas com a nota de cada questão e os comentários dos erros cometidos.