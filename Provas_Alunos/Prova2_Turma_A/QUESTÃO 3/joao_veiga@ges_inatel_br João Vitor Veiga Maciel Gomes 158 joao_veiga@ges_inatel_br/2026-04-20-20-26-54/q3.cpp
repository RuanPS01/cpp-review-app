#include <iostream>

using namespace std;

int main ()
{
    
    int moedas;
    int cavernas = 0;
    int soma = 0; // soma de todas as moedas.
    
    
    while (moedas != 0)
    {
        cin >> moedas;
        
        
        if (moedas == 10)
        {
            cavernas++; // contador de cavernas com mais de 10 moedas.
            
        }
        
        soma+= moedas;
    }
    
    cout << "Total de moedas: " << soma << endl;
    cout << "Cavernas com 10 moedas: " << cavernas << endl;
    
    
    return 0;
}