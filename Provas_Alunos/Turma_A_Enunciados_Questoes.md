# QUESTÃO 1

Uma **progressão aritmética** (**PA**) é toda sequência numérica em que cada um de seus termos, a partir do segundo, é igual ao anterior somado a uma constante R, denominada **razão da progressão aritmética**.

**Exemplos**

2, 5, 8, 11, 14, ... é uma PA de valor inicial A = 2 e razão R = 3;

10, 8, 6, 4, 2, 0, ... é uma PA de valor inicial A = 10 e razão R = -2.

Escreva um programa que leia um valor inicial A e uma razão R e imprima uma seqüência em P.A. contendo N valores.

Entrada

A entrada consiste de uma única linha contendo 3 inteiros, que correspondem aos valores de N, A e R, respectivamente. 

##### Saída

Na saída, o programa deve mostrar os N primeiros termos da PA em uma única linha.

 

| Exemplos de entrada | Exemplos de saída |
| ------------------- | ----------------- |
| 4 2 3               | 2 5 8 11          |
| 6 5 -2              | 5 3 1 -1 -3 -5    |

Execution files
---------------

#### vpl_evaluate.cases

```
case = 0
input = 4 2 3
output = "2 5 8 11 "
grade reduction = 100%

case = 1
input = 6 5 -2
output = "5 3 1 -1 -3 -5 "
grade reduction = 100%

case = 2
input = 1 10 7
output = "10 "
grade reduction = 100%

case = 3
input = 5 0 0
output = "0 0 0 0 0 "
grade reduction = 100%

case = 4
input = 7 -3 4
output = "-3 1 5 9 13 17 21 "
grade reduction = 100%
```

---

# QUESTÃO 2

Faça um programa que leia um valor inteiro X (1 <= X <= 1000), e mostre os valores ímpares de 1 a X, incluindo X se for o caso.

Entrada

A entrada consiste de  um único inteiro X.

##### Saída

Na saída, o programa deve mostrar todos os números ímpares de 1 a X, conforme os exemplos  abaixo.

| Exemplos de entrada | Exemplos de saída |
| ------------------- | ----------------- |
| 10                  | 1 3 5 7 9         |
| 7                   | 1 3 5 7           |

Execution files
---------------

#### vpl_evaluate.cases

```
case = 0
input = 10
output = "1 3 5 7 9 "
grade reduction = 100%

case = 1
input = 7
output = "1 3 5 7 "
grade reduction = 100%

case = 2
input = 1
output = "1 "
grade reduction = 100%

case = 3
input = 2
output = "1 "
grade reduction = 100%

case = 4
input = 15
output = "1 3 5 7 9 11 13 15 "
grade reduction = 100%
```

---

# QUESTÃO 3

Em um jogo de aventura, um personagem atravessa várias cavernas e encontra baús com moedas de ouro. Em cada caverna, o jogador informa quantas moedas encontrou. O funcionamento do sistema é o seguinte:

Cada valor digitado representa a quantidade de moedas encontradas em uma caverna.  
O programa deve continuar lendo os valores enquanto a quantidade digitada for diferente de 0.

Ao final, o programa deve informar:

* a quantidade total de moedas coletadas;

* a quantidade de cavernas em que o jogador encontrou exatamente 10 moedas.

##### Entrada

A entrada consiste em uma única linha com números inteiros, separados por espaços em branco, que correspondem às quantidades de moedas encontradas nas cavernas. O final da entrada será indicado pelo número 0, que não deve ser considerado nos cálculos.

##### Saída

Na saída, o programa deve mostrar o total de moedas coletadas e a quantidade de cavernas em que foram encontradas exatamente 10 moedas, conforme o exemplo abaixo.

| **Exemplo de entrada** | **Exemplo de saída**      |
| ---------------------- | ------------------------- |
| 8 10 15 10 7 0         | Total de moedas: 50       |
|                        | Cavernas com 10 moedas: 2 |

Execution files
---------------

#### vpl_evaluate.cases

```
case = 0
input= 8 10 15 10 7 0
output="Total de moedas: 50
Cavernas com 10 moedas: 2"
grade reduction =100%

case = 1
input= 10 10 10 10 0
output="Total de moedas: 40
Cavernas com 10 moedas: 4"
grade reduction =100%

case = 2
input= 5 7 8 12 3 0
output="Total de moedas: 35
Cavernas com 10 moedas: 0"
grade reduction =100%

case = 3
input= 10 0
output="Total de moedas: 10
Cavernas com 10 moedas: 1"
grade reduction =100%

case = 4
input= 1 2 3 4 5 0
output="Total de moedas: 15
Cavernas com 10 moedas: 0"
grade reduction =100%

case = 5
input= 20 30 10 40 10 0
output="Total de moedas: 110
Cavernas com 10 moedas: 2"
grade reduction =100%

case = 6
input= 9 10 11 10 9 10 0
output="Total de moedas: 59
Cavernas com 10 moedas: 3"
grade reduction =100%

case = 7
input= 0
output="Total de moedas: 0
Cavernas com 10 moedas: 0"
grade reduction =100%
```

---

# QUESTÃO 4

Faça um programa que leia vários números inteiros e os armazene em um vetor.

Depois, o programa deve ler uma palavra que pode ser **positivos** ou **negativos**, e retornar a média dos números positivos ou negativos, conforme a palavra lida.

Entrada

A entrada consiste de duas linhas:

- a primeira irá conter vários números inteiros, e termina com o elemento 0, que não deve ser inserido no vetor

- a segunda linha tem uma única palavra, que pode ser **positvos** ou **negativos**.

##### Saída

Na saída, o programa deve mostrar a média dos números positivos ou negativos do vetor, com 3 casas decimais.

| Exemplo de entrada        | Exemplo de saída |
| ------------------------- | ---------------- |
| 1 -3 -2 4 -5 7 0positivos | media = 4.000    |
| -2 1 9 -7 4 0negativos    | media = -4.500   |

Execution files
---------------

#### vpl_evaluate.cases

```
case = 0
input=1 -3 -2 4 -5 7 0
positivos
output="media = 4.000"
grade reduction=100%

case = 1
input=-2 1 9 -7 4 0
negativos
output="media = -4.500"
grade reduction=100%

case = 2
input=5 0
positivos
output="media = 5.000"
grade reduction=100%

case = 3
input=-8 0
negativos
output="media = -8.000"
grade reduction=100%

case = 4
input=2 4 6 8 10 0
positivos
output="media = 6.000"
grade reduction=100%

case = 5
input=-1 -2 -3 -4 -5 0
negativos
output="media = -3.000"
grade reduction=100%

case = 6
input=1 2 5 -1 -2 0
positivos
output="media = 2.667"
grade reduction=100%

case = 7
input=-1 -2 -4 3 8 0
negativos
output="media = -2.333"
grade reduction=100%

case = 8
input=3 3 3 -2 -2 0
positivos
output="media = 3.000"
grade reduction=100%

case = 9
input=1 2 3 0
positivos
output="media = 2.000"
grade reduction=100%

case = 10
input=10 -5 8 -3 6 -7 4 -1 0
negativos
output="media = -4.000"
grade reduction=100%

case = 11
input=5 -10 15 -20 0
negativos
output="media = -15.000"
grade reduction=100%

case = 12
input=1 2 0
positivos
output="media = 1.500"
grade reduction=100%
```



