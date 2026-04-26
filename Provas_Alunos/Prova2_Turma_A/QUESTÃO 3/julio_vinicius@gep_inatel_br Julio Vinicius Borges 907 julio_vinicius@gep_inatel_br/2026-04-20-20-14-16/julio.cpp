#include <iostream>

using namespace std;

int main (){
    
    int moedas , teste, soma = 0 , contador = 0 ;
    
    
    while (moedas != 0){
        
        cin >> moedas ; 
        
        soma = soma + moedas;
        
        if (moedas == 10){
            
            contador++;
            
        }
        
    }
    
    cout << "Total de moedas: " << soma << endl;
    cout << "Cavernas com 10 moedas: " << contador << endl;
    
    
    
    return 0 ;
}