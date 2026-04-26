#include <iostream>
using namespace std;

int main(){
    
    int total = 0, moedas = 1, caverna10 = 0;
    
    while(moedas != 0){
        cin >> moedas;
        
        total += moedas;
        
        if(moedas == 10){
            caverna10 ++;
        }
        
    }
    
    cout << "Total de moedas: " << total << endl;
    cout << "Cavernas com 10 moedas: " << caverna10;
    
    
    return 0;
}