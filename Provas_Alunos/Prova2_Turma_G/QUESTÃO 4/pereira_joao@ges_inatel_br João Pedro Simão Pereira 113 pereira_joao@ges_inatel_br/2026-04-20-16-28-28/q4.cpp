#include <iostream>
using namespace std;

int main()
{
    int numero[100], opcao, i = 0;
    
    cin >> numero[i];
    while (numero[i] != 0)
    {
        cin >> numero[i];
        i++;
        cin >> numero[i];
    }
    
    cin >> opcao;
    
    if (opcao == numero[i] && numero[i] != 0)
    {
        cout << opcao << " encontrado na posicao " << i << endl;
    }
    else
    {
        cout << "Elemento nao encontrado" << endl; 
    }
    
    return 0;
    
}