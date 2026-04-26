#include <iostream>
#include <iomanip>
#include <cmath>
#include <cstring>

using namespace std;

int main ()
{
    int termos, valorInicial, razao;
    int resultado;
    
    cin >> termos >> valorInicial >> razao;
    
    for ( int i = 1; i <= termos; i++)
    {
        if (i == 1)
        {
            resultado = valorInicial;
        }
        
        else 
        {
            resultado = valorInicial + ( i - 1) * razao;
        }
        cout << resultado << " ";
    
    }
    return 0;
}