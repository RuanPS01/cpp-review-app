#include <iostream>
using namespace std;

int main()
{
    //variaveis
    int N;
    int X;
    int par, impar, pos, neg;
    
    //entrada de dados
    cin >> N;
    
    //processamentos
    for (int i = 0; i < N; i++)
    {
        cin >> X;
        
        if (X % 2 == 0)
        {
            X == par++;
        }
        
        else 
        {
            X == impar++;
        }
        
    }
    
    for (int j = 0; j < N; j++)
    {
        cin >> X;
        
        if (X < 0)
        {
            X == neg++;
        }
        
        else 
        {
            X == pos++;
        }
    }
    
    //saida de dados
    cout << par << " numeros pares" << endl;
    cout << impar << " numeros impares" << endl;  
    cout << pos << " numeros positivos" << endl;
    cout << neg << " numeros negativos" << endl;
    
    return 0;
}