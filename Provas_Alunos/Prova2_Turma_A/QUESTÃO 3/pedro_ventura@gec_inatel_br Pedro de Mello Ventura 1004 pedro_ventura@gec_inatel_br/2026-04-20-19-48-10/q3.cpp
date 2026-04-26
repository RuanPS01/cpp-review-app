#include <iostream>

using namespace std;

int main() {
    
    int moeda, moedaT, cont;
    moeda = 1;
    moedaT = 0;
    cont = 0;
    
    while (moeda != 0) {
        cin >> moeda;
        moedaT = moedaT + moeda;
        if (moeda == 10) {
            cont++;
        }
    }
    cout << "Total de moedas: " << moedaT << endl;
    cout << "Cavernas com 10 moedas: " << cont;
    return 0;
}