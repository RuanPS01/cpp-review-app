#include <iostream>
using namespace std;

int main ()
{
    int N; //quantidade de números a serem analisados
    cout << "insira a quantidade de numeros que seram analisados: " << endl;
    cin >> N;
    
    int numeros; //os números em si que seram analisados
    cout << "insira os numeros que seram analisados" << endl;
    
    int pares = 0;
    int impares = 0;
    int positivos = 0;
    int negativos = 0;
    
    
    for (int i = 0; i <= N; i++)
    {
       cin >> numeros;
       if (N % 2 = 0)
       {
           pares += numeros;
       }
       
       if (N % 2 != 0) 
       {
           impares += numeros;
       }
       
       if (N > 0)
       {
           positivos += numeros;
       }
       
       if (N < 0)
       {
           negativos += numeros;
       }
    }
    
    cout << "Quantidade de numeros pares: " << pares << endl;
    cout <<"Quantidade de numeros ímpares: " << impares << endl;
    cout << "Quantidade de numeros positivos: " << positivos << endl;
    cout << "Quantidade de numeros negativos: "<< negativos << endl;
    
    return 0;
}

//ler valores (a quantidade e os valores em si)
// dizer a quantidade de : pares/ímpares/positivos/ negatvos/