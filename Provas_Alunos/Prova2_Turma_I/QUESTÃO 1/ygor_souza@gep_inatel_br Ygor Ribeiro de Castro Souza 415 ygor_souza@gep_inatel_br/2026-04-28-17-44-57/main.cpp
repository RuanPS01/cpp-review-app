#include <iostream>

using namespace std;

int main()
{
    // Declarando as variaveis
    int N;
    int X;
    int i = 0;
    
    // Entrada da quantidade a ser analisado
    cin >> N;
    
    // Entrada nos numeros
    while(N--)
    {
        cin >> X;
        
        // Se for divisivel por 3, soma
        if (X % 3 == 0)
            i++;
    }
    
    // Saida
    cout << i;
    
    
    return 0;
}