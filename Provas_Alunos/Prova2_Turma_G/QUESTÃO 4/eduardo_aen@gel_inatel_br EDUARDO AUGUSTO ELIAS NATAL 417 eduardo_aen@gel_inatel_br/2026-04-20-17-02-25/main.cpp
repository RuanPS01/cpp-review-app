#include <iostream>

using namespace std;

int main() {
    
    int n = 0;                                    \\quantidade de posicoes no vetor
    int v[n];                                     \\vetor
    int x, c;                                     \\ variavel p valores e o elemento para ser encontrado
    
    cin >> x;
    
    while (x != 0)                               \\atribuir os valores no vetor
    {
        v[n] = x;
        n = n + 1;
        cin >> x;
    }
    
    cin >> c;
    
    for(int i = 0; i < n; i++)                      \\checar se esta em alguma posicao
    {
        if (c == v[i])
        {
            cout << c << " encontrado na posicao " << c << endl;
        }
        else
        {
            cout << "Elemento nao encontrado" << endl;
        }
    }
    
    
    return 0;
}