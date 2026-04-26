#include <iostream>

using namespace std;

int main()
{
    
    int numeros;
    int N;
    int pares = 0;
    int impares = 0;
    int positivos = 0;
    int negativos = 0;
    
    for(int i = 0; i < N; i++)
    {
        cin >> numeros;
        
        if(numeros % 2 == 0)
        {
            pares++;
            break;
        }
    }
    for(int i = 0; i < N; i++)
    {
        cin >> numeros;
        
        if(numeros % 2 != 0)
        {
            impares++;
            break;
        }
    }
    for(int i = 0; i < N; i++)
    {
        cin >> numeros; 
        
        if(numeros > 0)
        {
            positivos++;
            break;
        }
    }
    for(int i = 0; i < 0; i++)
    {
        cin >> numeros;
        
        if(numeros < 0)
        {
            negativos++;
            break;
        }
    }
    cout << pares << " numeros pares" << endl;
    cout << impares << " numeros impares" << endl;
    cout << positivos << " numeros positivos" << endl;
    cout << negativos << " numeros negativos" << endl;
    
    
    return 0;
}