#include <iostream>

using namespace std;

int main()
{
    int N, x;
    int pares = 0, impar = 0, positivo = 0, negativo = 0;
    
    cin >> N;
    
    for(int i = 0; i < N; i++)
    {
        cin >> x;
        
        if(x > 0)
        {
            positivo++;
        }
        if(x < 0)
        {
            negativo++;
        }
        if(x % 2 == 0)
        {
            pares++;
        }
        if(x % 2 != 0)
        {
            impar++;
        }
        
    }
    
    cout << pares << " numeros pares" << endl;
    cout << impar << " numeros impares" << endl;
    cout << positivo << " numeros positivos" << endl;
    cout << negativo << " numeros negativos" << endl;
    
    return 0;
}