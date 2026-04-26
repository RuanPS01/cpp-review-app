#include <iostream>
using namespace std;

int main(){
    int N, soma = 0, qtd = 0;
    
    cin >> N;
    
    while(N != 0){
        soma += N;
        
        if (N == 10){
            qtd++;
        }
        
        cin >> N;
        
    }
    
    cout << "Total de moedas: " << soma << endl;
    
    cout << "Cavernas com 10 moedas: " << qtd << endl;
    
    return 0;
}