#include <iostream>
using namespace std;

int main ()
{
    //variaveis
    double x[100];
    double n;
    
    //entrada de dados
    cin >> x[100];
    
    //processamentos
    while (x[100] != 0)
    {
        cin >> n;
        
        if (n == x[100])
        {
            cout << n << " encontrado na posicao " << x[1000] << endl;
        }
        
        else 
        {
            cout << "Elemento nao encontrado" << endl;
        }
        
        break;
    }
    
    return 0;
}