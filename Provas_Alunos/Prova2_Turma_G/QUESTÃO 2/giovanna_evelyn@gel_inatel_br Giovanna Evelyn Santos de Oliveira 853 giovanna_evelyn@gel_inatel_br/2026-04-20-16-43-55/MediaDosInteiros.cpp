#include <iostream>
using namespace std;

int main ()
{
    int N; //quantidade de números que seram inseridos.
    cout << "Insira a quantidade de numeros: " << endl;//aparce na tela para inserir a quantidade de números .
    cin >> N; //computador lê o número.
    
    int numeros; //os numeros que seram usados para calcular a média.
    cout << "Insira os numeros: " << endl; //pedido para o computador obter os números que seram calculados.
    
    int soma = 0; //nome da caixinha onde ficaram armazenadas a minha soma 
    int media; // nome da caixinha em que vou pegar a soma e dividir pela quantidade de numeros que foram inseridos.
    
    for (int i = 0; i = N ; i++)
    {
        cin >> numeros; // ler os números inseridos
        soma = (soma + numeros); // soma precisa ser igual ao valor anterior (0) somado ao próximo numero
    }
    
    media = (soma / 2); //média vai ser a soma dos N termos dividido pela metade
    cout << "Resultado da media dos numeros inseridos = "<< media << endl; //mostrar o resultado 
    
    return 0;
}

// ler N (uma quantidade N ) numeros inteiros
//mostrar a média simples deles (com 4 casas decimais )





