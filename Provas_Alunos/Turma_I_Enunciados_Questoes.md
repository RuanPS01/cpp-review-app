QUESTÃO 1
=========

Faça um programa que leia vários números inteiros e mostre a quantidade de números divisíveis por 3.

Entrada

A entrada consiste de duas linhas:

- a primeira linha contém apenas um inteiro N, que corresponde à quantidade de números a serem analisados

- a segunda contém N números inteiros. 

##### Saída

Na saída, o programa deve mostrar a quantidade de números divisíveis por 3.

| Exemplos de entrada               | Exemplos de saída |
| --------------------------------- | ----------------- |
| 10<br/>2 3 5 6 9 12 -11 -9 -21 36 | 7                 |

Execution files
---------------

#### vpl_evaluate.cases

```
case = 0
input= 10 2 3 5 6 9 12 -11 -9 -21 36
output="7"
grade reduction =100%

case = 1
input= 5 1 2 4 5 7
output="0"
grade reduction =100%

case = 2
input= 6 3 6 9 12 15 18
output="6"
grade reduction =100%

case = 3
input= 4 -3 -6 -8 2
output="2"
grade reduction =100%

case = 4
input= 1 0
output="1"
grade reduction =100%

case = 5
input= 5 0 1 2 3 4
output="2"
grade reduction =100%

case = 6
input= 3 -1 -2 -4
output="0"
grade reduction =100%

case = 7
input= 8 30 -30 27 -27 14 16 19 21
output="5"
grade reduction =100%

case = 8
input= 1 3
output="1"
grade reduction =100%

case = 9
input= 7 9 8 7 6 5 4 3
output="3"
grade reduction =100%
```

---

QUESTÃO 2
=========

Faça um programa que leia a altura de N pessoas e retorne::

a. A menor altura do grupo;

b. A maior altura do grupo;

Entrada

A entrada tem 2 linhas:

- a primeira linha tem um único inteiro N, que corresponde ao número de pessoas a serem cadastradas;

- a segunda linha contém N números reais, que correspondem às alturas de cada pessoa.

##### Saída

A saída tem 2 linhas: 

- na primeira linha, deve ser mostrada a altura da pessoa mais baixa

- na segunda linha, deve ser mostrada a altura da pessoa mais alta, como no exemplo abaixo:

Observação: as alturas devem ser mostradas com 2 casas decimais.

| Exemplo de entrada        | Exemplo de saída                     |
| ------------------------- | ------------------------------------ |
| 4<br/>1.70 1.55 1.90 2.10 | Menor altura: 1.55Maior altura: 2.10 |

Execution files
---------------

#### vpl_evaluate.cases

```
case = 0
input= 4
1.70 1.55 1.90 2.10
output="Menor altura: 1.55
Maior altura: 2.10"
grade reduction =100%

case = 1
input= 3
1.60 1.75 1.68
output="Menor altura: 1.60
Maior altura: 1.75"
grade reduction =100%

case = 2
input= 5
1.50 1.50 1.50 1.50 1.50
output="Menor altura: 1.50
Maior altura: 1.50"
grade reduction =100%

case = 3
input= 6
1.82 1.95 1.88 1.70 2.00 1.76
output="Menor altura: 1.70
Maior altura: 2.00"
grade reduction =100%

case = 4
input= 2
1.65 1.80
output="Menor altura: 1.65
Maior altura: 1.80"
grade reduction =100%

case = 5
input= 7
1.55 1.60 1.58 1.62 1.59 1.61 1.57
output="Menor altura: 1.55
Maior altura: 1.62"
grade reduction =100%
```

---

QUESTÃO 3
=========

Imagine um restaurante que possui um sistema de votação eletrônica para que os clientes avaliem a qualidade da comida e do serviço. O sistema funciona da seguinte maneira:

* Cada cliente recebe um cartão com um código único.
* O cliente insere o código no terminal de votação e digita sua avaliação, que pode ser de 1 a 5 estrelas.
* A avaliação é armazenada eletronicamente e o sistema emite um relatório com a porcentagem de avaliações com 1, 2, 3, 4 ou 5 estrelas

##### Entrada

A entrada consiste uma única linha com números inteiros, separados por espaços em branco, que correspondem às avaliações dos clientes. O final desta linha irá conter o número 6, indicando o término da entrada de dados.

##### Saída

Na saída, o programa deve mostrar as porcentagens de avaliações com 1, 2, 3, 4 e 5 estrelas, conforme o exemplo abaixo. As porcentagens devem ser mostradas com 2 casas decimais.

| Exemplo de entrada    | Exemplo de saída                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| 3 2 2 3 3 4 4 4 4 5 6 | 1 estrela: 0%<br>2 estrelas: 20.00%<br>3 estrrelas: 30.00%<br>4 estrelas: 40.00%<br>5 estrelas: 10.00% |

Execution files
---------------

#### vpl_evaluate.cases

```
case = 0
input= 3 2 2 3 3 4 4 4 4 5 6
output="1 estrela: 0.00%
2 estrelas: 20.00%
3 estrelas: 30.00%
4 estrelas: 40.00%
5 estrelas: 10.00%"
grade reduction =100%

case = 1
input= 1 1 1 1 1 6
output="1 estrela: 100.00%
2 estrelas: 0.00%
3 estrelas: 0.00%
4 estrelas: 0.00%
5 estrelas: 0.00%"
grade reduction =100%

case = 2
input= 2 2 2 3 3 3 4 4 5 5 5 6
output="1 estrela: 0.00%
2 estrelas: 27.27%
3 estrelas: 27.27%
4 estrelas: 18.18%
5 estrelas: 27.27%"
grade reduction =100%

case = 3
input= 5 5 5 5 5 5 6
output="1 estrela: 0.00%
2 estrelas: 0.00%
3 estrelas: 0.00%
4 estrelas: 0.00%
5 estrelas: 100.00%"
grade reduction =100%

case = 4
input= 1 2 3 4 5 6
output="1 estrela: 20.00%
2 estrelas: 20.00%
3 estrelas: 20.00%
4 estrelas: 20.00%
5 estrelas: 20.00%"
grade reduction =100%

case = 5
input= 3 3 3 3 3 3 6
output="1 estrela: 0.00%
2 estrelas: 0.00%
3 estrelas: 100.00%
4 estrelas: 0.00%
5 estrelas: 0.00%"
grade reduction =100%

case = 6
input= 2 2 4 4 5 5 5 6
output="1 estrela: 0.00%
2 estrelas: 28.57%
3 estrelas: 0.00%
4 estrelas: 28.57%
5 estrelas: 42.86%"
grade reduction =100%

case = 7
input= 1 1 6
output="1 estrela: 100.00%
2 estrelas: 0.00%
3 estrelas: 0.00%
4 estrelas: 0.00%
5 estrelas: 0.00%"
grade reduction =100%

case = 8
input= 4 4 4 4 6
output="1 estrela: 0.00%
2 estrelas: 0.00%
3 estrelas: 0.00%
4 estrelas: 100.00%
5 estrelas: 0.00%"
grade reduction =100%

case = 9
input= 3 3 6
output="1 estrela: 0.00%
2 estrelas: 0.00%
3 estrelas: 100.00%
4 estrelas: 0.00%
5 estrelas: 0.00%"
grade reduction =100%

case = 10
input= 1 2 3 4 6
output="1 estrela: 25.00%
2 estrelas: 25.00%
3 estrelas: 25.00%
4 estrelas: 25.00%
5 estrelas: 0.00%"
grade reduction =100%

```

---

QUESTÃO 4
=========

Don Raffoni é um homem muito organizado. Ele anota todos os clientes a quem empresta dinheiro. Quando um cliente paga sua dívida, ele apaga seu nome da sua lista de devedores.

Cada cliente é identificado por um número para preservar sua identidade.

Ele pediu para que você o ajudasse a entrar na era da informática, e então você deve fazer um programa para cadastrar todos os devedores de Don Rafoni e inseri-los em um vetor de inteiros. 

Depois o seu programa deve ler o número de um cliente que pagou e substituir o seu identificador no vetor pelo número -1.

Ao final, o programa deve mostrar o vetor modificado. 

Entrada

A entrada consiste 3 linhas:

- A primeira tem um único inteiro N, que corresponde ao número de registros de clientes que pediram dinheiro emprestado a Don Raffoni;

- A segunda linha contêm os ids dos clientes que pediram dinheiro emprestado a Don Raffoni;

- A última linha tem o id do cliente que pagou todos os empréstimos solicitados.

##### Saída

Na saída, o programa deve mostrar os elementos do vetor depois da remoção de todos os registros do cliente que quitou suas dívidas.

| **Exemplo de entrada** | **Exemplo de saída** |
| ---------------------- | -------------------- |
| 7                      | 1 4 3 5 -1 -1 3      |
| 1 4 3 5 7 7 3          |                      |
| 7                      |                      |

Execution files
---------------

#### vpl_evaluate.cases

```
case = 0
input=5
6 2 7 4 5 
7
output="6 2 -1 4 5 "
grade reduction=100%

case = 1
input=1
8
8
output="-1 "
grade reduction=100%

case = 2
input=4
10 20 30 40 
10
output="-1 20 30 40 "
grade reduction=100%

case = 3
input=4
10 20 30 40
40
output="10 20 30 -1 "
grade reduction=100%

case = 4
input=6
1 2 3 4 5 6
3
output="1 2 -1 4 5 6 "
grade reduction=100%

case = 5
input=5
9 9 9 9 9
9
output="-1 -1 -1 -1 -1 "
grade reduction=100%

case = 6
input=5
3 6 9 12 15
8
output="3 6 9 12 15 "
grade reduction=100%

case = 7
input=3
-5 7 2 
-5
output="-1 7 2 "
grade reduction=100%

case = 8
input=6
11 22 33 44 55 66
55
output="11 22 33 44 -1 66 "
grade reduction=100%

case = 9
input=2
100 200 
200
output="100 -1 "
grade reduction=100%

case = 10
input=4
1 2 1 2
1
output="-1 2 -1 2 "
grade reduction=100%

case = 11
input=6
4 7 4 8 4 9
4
output="-1 7 -1 8 -1 9 "
grade reduction=100%

case = 12
input=4
5 6 7 8
9
output="5 6 7 8 "
grade reduction=100%
```


