#include <iostream>
using namespace std;

int main()
{
    int N, numero, par = 0, impar = 0, positivo = 0, negativo = 0;
    
    cin >> N;
    
    for (int i = 0; i < N; i++)
    {
        cin >> numero;
        
        if (numero > 0 && numero % 2 == 0)
        {
            positivo++;
            par++;
        }
        if (numero < 0 && numero % 2 == 0)
        {
            negativo++;
            par++;
        }
        if (numero > 0 && numero % 2 != 0)
        {
            positivo++;
            impar++;
        }
        if (numero < 0 && numero % 2 != 0)
        {
            negativo++;
            impar++;
        }
        if (numero == 0)
        {
            par++;
        }
    }
    
    cout << par << " numeros pares" << endl;
    cout << impar << " numeros impares" << endl; 
    cout << positivo << " numeros positivos" << endl; 
    cout << negativo << " numeros negativos" << endl; 
    
    return 0;
}