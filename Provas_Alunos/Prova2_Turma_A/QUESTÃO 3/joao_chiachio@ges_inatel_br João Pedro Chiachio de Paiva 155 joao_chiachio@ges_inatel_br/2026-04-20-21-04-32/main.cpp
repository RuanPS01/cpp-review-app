#include <iostream>

using namespace std;

int main ()
{
    int moedas, contador = 0, total = 0;
    cin >> moedas;
    
    while(moedas != 0)
    {
    
    total += moedas;
    
    if(moedas == 10)
        contador++;
        
    cin >> moedas;
    
    }
    
    cout << "Total de moedas: " << total << endl;
    cout << "Cavernas com 10 moedas: " << contador << endl;
    
    return 0;
    
    
    
    
}