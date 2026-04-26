#include <iostream>
#include <iomanip>
#include <cmath>

using namespace std;

int main ()
{
    int numero = 1;
    int totalMoedas = 0, cavernaComDez = 0;
    
    while (numero != 0)
    {
        cin >> numero;
        
        totalMoedas += numero;
        
        if (numero == 10)
        {
            cavernaComDez++;
        }
    
    }
    
    
    cout << "Total de moedas: " << totalMoedas << endl;
    cout << "Cavernas com 10 moedas: " << cavernaComDez << endl;
    
    return 0;
}