#include <iostream>
using namespace std;
int main ()
{
    //Declarando variaveis
    int N;
    int i;
    int numeros;
    int soma = 0;
    //Entrada
    cin >> N;
    //Mecanismo de repetiçao
    for (i = 0 ; i< N; i++)
    {
        cin >> numeros;
        
        //Condiçao para mostrar se é divisivel por 3
        if (numeros % 3 == 0)
        {
            soma ++;
        }
    }
    //Saida
    cout << soma << endl;
    return 0;
}