#include <iostream>

using namespace std;

int main()
{
    // Declarando as variaveis
    int N;
    int i;
    int Vetor[100];
    int ID;
    
    // Entrada do numero de clientes
    cin >> N;
    
    // Entrada dos ids dos clientes
    for (i = 0; i < N; i++)
        cin >> Vetor[i];
    
    // Entrada do id do cliente que pagou
    cin >> ID;
    
    // Modificar o vetor
    for (i = 0; i < N; i++)
    {
        if (Vetor[i] == ID)
            Vetor[i] = -1;
    }
    
    // Saida
    for (i = 0; i < N; i++)
        cout << Vetor[i] << " ";
        
    
    return 0;
}