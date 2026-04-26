#include <iostream>

using namespace std;

int main()
{
    int N;
    int inteiros;
    
    int par = 0, impar = 0, positivo = 0, negativo = 0;
    
    cin >> N;
    
    for(int i = 0; i < N; i++)
    {
        cin >> inteiros;
        
        if(inteiros > 0)
        {
            positivo++;
            
        }
        if(inteiros < 0)
        {
            negativo++;
        }
        if(inteiros % 2 == 0)
        {
            par++;
        }
        else
        {
            impar++;
        }
    }
    
    cout << par << " numeros pares" << endl;
    cout << impar << " numeros impares" << endl;
    cout << positivo << " numeros positivos" << endl;
    cout << negativo << " numeros negativos" << endl;
    
    return 0;
}