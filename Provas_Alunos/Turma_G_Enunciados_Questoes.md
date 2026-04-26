# QUESTÃO 1

Faça um programa que leia vários números inteiros e mostre a quantidade de números pares, ímpares, positivos e negativos.

Entrada

A entrada consiste de duas linhas:

- a primeira linha contém apenas um inteiro N, que corresponde à quantidade de números a serem analisados

- a segunda contém N números inteiros. 

##### Saída

Na saída, o programa deve mostrar a quantidade de números pares, ímpares, positivos e negativos, como no exemplo abaixo.

| Exemplos de entrada          | Exemplos de saída                                                      |
| ---------------------------- | ---------------------------------------------------------------------- |
| 102 3 5 6 9 12 -11 -9 -21 36 | 4 numeros pares6 numeros impares7 numeros positivos3 numeros negativos |



Execution files
---------------

#### vpl_evaluate.cases

```
case = 0
input= 10
2 3 5 6 9 12 -11 -9 -21 36
output="4 numeros pares
6 numeros impares
7 numeros positivos
3 numeros negativos"
grade reduction =100%

case = 1
input= 5
1 2 3 4 5
output="2 numeros pares
3 numeros impares
5 numeros positivos
0 numeros negativos"
grade reduction =100%

case = 2
input= 6
-1 -2 -3 -4 -5 -6
output="3 numeros pares
3 numeros impares
0 numeros positivos
6 numeros negativos"
grade reduction =100%

case = 3
input= 7
0 1 2 3 -1 -2 -3
output="3 numeros pares
4 numeros impares
3 numeros positivos
3 numeros negativos"
grade reduction =100%

case = 4
input= 4
2 4 6 8
output="4 numeros pares
0 numeros impares
4 numeros positivos
0 numeros negativos"
grade reduction =100%

case = 5
input= 3
-1 -3 -5
output="0 numeros pares
3 numeros impares
0 numeros positivos
3 numeros negativos"
grade reduction =100%

case = 6
input= 1
0
output="1 numeros pares
0 numeros impares
0 numeros positivos
0 numeros negativos"
grade reduction =100%
```

---

# QUESTÃO 2

Faça um programa que leia N números inteiros e retorne a média dos mesmos.

Entrada

A entrada consiste de duas linhas:

- a primeira linha contém um único inteiro N, que corresponde à quantidade de números a serem processados.

- a segunda linha terá N números inteiros, dos quais se deseja calcular a média 

##### Saída

Na saída, o programa deve mostrar a média dos N números digitados, com 4 casas decimais.

| Exemplos de entrada | Exemplos de saída |
| ------------------- | ----------------- |
| 41 2 3 4            | 2.5000            |
| 62 -1 4 7 9 12      | 5.5000            |



Execution files
---------------

#### vpl_evaluate.cases

```
case = 0
input = 
4
1 2 3 4
output = "2.5000"
grade reduction = 100%

case = 1
input =
6
2 -1 4 7 9 12
output = "5.5000"
grade reduction = 100%

case = 2
input =
3
5 5 5
output = "5.0000"
grade reduction = 100%

case = 3
input =
5
-2 -4 -6 -8 -10
output = "-6.0000"
grade reduction = 100%

case = 4
input =
1
7
output = "7.0000"
```

---

# QUESTÃO 3

Imagine uma academia que deseja analisar o tempo de treino de seus alunos em um determinado dia. Cada aluno informa quantos minutos treinou. O funcionamento é o seguinte:

Cada tempo de treino é informado em minutos.  
O programa deve continuar lendo os valores enquanto o tempo digitado for diferente de 0.  
Ao final, o sistema deve informar o maior tempo de treino registrado e a média dos tempos informados.

##### Entrada

A entrada consiste em uma única linha com números inteiros, separados por espaços em branco, que correspondem aos tempos de treino informados pelos alunos. O final da entrada será indicado pelo número 0, que não deve ser considerado nos cálculos.

##### Saída

Na saída, o programa deve mostrar o maior tempo de treino e a média dos tempos informados, conforme o exemplo abaixo. A média deve ser exibida com 2 casas decimais.

| **Exemplo de entrada** | **Exemplo de saída**            |
| ---------------------- | ------------------------------- |
| 30 45 20 55 0          | Maior tempo: 55 minutos         |
|                        | Media dos tempos: 37.50 minutos |



Execution files
---------------

#### vpl_evaluate.cases

```
case = 0
input= 30 45 20 55 0
output="Maior tempo: 55 minutos
Media dos tempos: 37.50 minutos"
grade reduction =100%

case = 1
input= 10 20 30 40 50 0
output="Maior tempo: 50 minutos
Media dos tempos: 30.00 minutos"
grade reduction =100%

case = 2
input= 25 25 25 25 0
output="Maior tempo: 25 minutos
Media dos tempos: 25.00 minutos"
grade reduction =100%

case = 3
input= 60 0
output="Maior tempo: 60 minutos
Media dos tempos: 60.00 minutos"
grade reduction =100%

case = 4
input= 5 15 10 0
output="Maior tempo: 15 minutos
Media dos tempos: 10.00 minutos"
grade reduction =100%

case = 5
input= 90 30 60 120 0
output="Maior tempo: 120 minutos
Media dos tempos: 75.00 minutos"
grade reduction =100%

case = 6
input= 7 14 21 28 35 0
output="Maior tempo: 35 minutos
Media dos tempos: 21.00 minutos"
grade reduction =100%

case = 7
input= 12 18 24 36 0
output="Maior tempo: 36 minutos
Media dos tempos: 22.50 minutos"
grade reduction =100%
```

---

# QUESTÃO 4

Faça um programa que leia vários números reais e os armazene em um vetor.

Depois, o programa deve ler um número real X, e mostrar a posição onde X se encontra no vetor. Se X não estiver no vetor, o programa deve mostrar a mensagem "Elemento nao encontrado".

Entrada

A entrada consiste de duas linhas:

- a primeira irá conter vários números reais, e termina com o elemento 0, que não deve ser inserido no vetor

- a segunda linha tem um único número real, correspondente a X.

##### Saída

Na saída, o programa deve mostrar a a posição em que X foi encontrado no vetor. Se X não for encontrado, o programa deve mostrar a mensagem "Elemento nao encontrado".

| Exemplo de entrada | Exemplo de saída           |
| ------------------ | -------------------------- |
| 1 -3 -2 4 -5 7 0-2 | -2 encontrado na posicao 2 |
| -2 1 9 -7 4 010    | Elemento nao encontrado    |



Execution files
---------------

#### vpl_evaluate.cases

```
case = 0
input=1 -3 -2 4 -5 7 0
-2
output="-2 encontrado na posicao 2"
grade reduction=100%

case = 1
input=-2 1 9 -7 4 0
10
output="Elemento nao encontrado"
grade reduction=100%

case = 2
input=5.5 0
5.5
output="5.5 encontrado na posicao 0"
grade reduction=100%

case = 3
input=5.5 0
2.0
output="Elemento nao encontrado"
grade reduction=100%

case = 4
input=1.1 2.2 3.3 4.4 0
1.1
output="1.1 encontrado na posicao 0"
grade reduction=100%

case = 5
input=1.1 2.2 3.3 4.4 0
4.4
output="4.4 encontrado na posicao 3"
grade reduction=100%

case = 6
input=-1.5 -2.5 -3.5 0
-2.5
output="-2.5 encontrado na posicao 1"
grade reduction=100%

case = 7
input=2.5 2.5 2.5 0
2.5
output="2.5 encontrado na posicao 0"
grade reduction=100%

case = 8
input=1.2 3.4 5.6 0
0
output="Elemento nao encontrado"
grade reduction=100%

case = 9
input=-10.0 0.5 8.75 -3.25 0
8.75
output="8.75 encontrado na posicao 2"
grade reduction=100%

case = 10
input=-10.0 0.5 8.75 -3.25 0
7.75
output="Elemento nao encontrado"
grade reduction=100%

case = 11
input=9.9 8.8 7.7 6.6 0
6.6
output="6.6 encontrado na posicao 3"
grade reduction=100%

case = 12
input=1.0 2.0 3.0 0
4.0
output="Elemento nao encontrado"
grade reduction=100%

case = 13
input=5.0 6.0 7.0 0
5.0
output="5.0 encontrado na posicao 0"
grade reduction=100%

case = 14
input=1.5 2.5 3.5 0
3.5
output="3.5 encontrado na posicao 2"
grade reduction=100%

case = 15
input=1.0 2.0 3.0 0
0
output="Elemento nao encontrado"
grade reduction=100%

case = 16
input=4.2 4.2 4.2 4.2 0
4.2
output="4.2 encontrado na posicao 0"
grade reduction=100%

case = 17
input=-1.1 -2.2 -3.3 0
-3.3
output="-3.3 encontrado na posicao 2"
grade reduction=100%
```


