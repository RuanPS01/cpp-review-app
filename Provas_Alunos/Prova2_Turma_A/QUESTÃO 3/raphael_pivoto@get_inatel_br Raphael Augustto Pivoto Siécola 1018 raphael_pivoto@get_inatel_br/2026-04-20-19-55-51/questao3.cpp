#include <iostream>
using namespace std;

int main() {
    int Moedas = 1, Cavernas = 0, Soma = 0;
    
    while (Moedas != 0) {
        cin >> Moedas;
        Soma += Moedas;
        
        if (Moedas != 0 && Moedas == 10) {
            Cavernas++;
        }
    }
    
    cout << "Total de moedas: " << Soma << endl;
    cout << "Cavernas com 10 moedas: " << Cavernas << endl;
    
    return(0);
}