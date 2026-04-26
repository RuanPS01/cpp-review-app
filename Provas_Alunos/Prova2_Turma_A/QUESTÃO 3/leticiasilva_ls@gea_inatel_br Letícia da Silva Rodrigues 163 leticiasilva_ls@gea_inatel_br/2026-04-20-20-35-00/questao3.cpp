#include <iostream>

using namespace std;

int main(){
    
    int moedas, i = 0;
    int total = 0;
    int com10Moedas = 0;
    
    while(moedas != 0){
        
        cin >> moedas;
        
        total += moedas;
        
        if(moedas == 10){
            
            com10Moedas++;
        }
    }
    
    cout << "Total de moedas: " << total << endl;
    cout << "Cavernas com 10 moedas: " <<com10Moedas << endl;

    
    return 0;
}