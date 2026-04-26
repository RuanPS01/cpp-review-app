#include <iostream>
using namespace std;

int main()
{
    int N;
    cin >> N;
    
    int numeros;
    int pares = 0, impares = 0, positivos = 0, negativos = 0;
    
    for(int i = 0; i < N; i++)
    {
        cin >> numeros;
        
        if(numeros % 2 == 0)
        {
            pares++;
        }
        
        if(numeros % 2 != 0)
        {
            impares++;
        }
        
        if(numeros > 0)
        {
            positivos++;
        }
        
        if(numeros < 0)
        {
            negativos++;
        }
    }
    
    cout << pares << " numeros pares" << endl;
    cout << impares << " numeros impares" << endl;
    cout << positivos << " numeros positivos" << endl;
    cout << negativos << " numeros negativos" << endl;
    
    return 0;
}