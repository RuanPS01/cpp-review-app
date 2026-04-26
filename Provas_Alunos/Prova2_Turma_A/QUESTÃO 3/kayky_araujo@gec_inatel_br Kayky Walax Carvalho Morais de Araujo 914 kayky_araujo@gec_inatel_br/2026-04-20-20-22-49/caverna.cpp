#include <iostream>

using namespace std;

int main(){
    
    int moedas;
    int totalMoedas[100];
    int caverna;
    int soma = 0;
    int totalCavernas;
    int cavernasDez = 0;
    
    cin >> moedas; 
    
    while(moedas != 0){
        
        totalMoedas[caverna] = moedas;
        soma += moedas;
        
        cin >> moedas;
        caverna++;
    }
    
    totalCavernas = caverna;
    
    for(caverna = 0; caverna < totalCavernas; caverna++){
        if(totalMoedas[caverna] == 10){
            cavernasDez++;
        }
    }
    
    cout << "Total de moedas: " << soma << endl;
    cout << "Cavernas com 10 moedas: " << cavernasDez;
    
    return 0;
}