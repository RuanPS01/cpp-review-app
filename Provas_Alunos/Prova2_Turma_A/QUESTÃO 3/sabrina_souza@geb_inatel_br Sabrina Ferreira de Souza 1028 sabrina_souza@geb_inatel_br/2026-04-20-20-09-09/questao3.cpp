#include <iostream>
using namespace std;

int main(){
    int moeda, soma=0, caverna=0;
    cin >> moeda;
    
    do {
        soma += moeda;
        if (moeda == 10){
            caverna += 1;
        } 
        cin >> moeda;
    }
    while (moeda != 0);
    
    
    cout << "Total de moedas: " << soma << endl;
    cout << "Cavernas com 10 moedas: " << caverna;
    
    return 0;
}