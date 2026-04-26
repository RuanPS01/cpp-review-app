#include <iomanip>
#include <iostream>

using namespace std;

int main(){
    int N;
    int soma = 0;
    int moedas = 0;
    
    cin >> N;
    
    while(N != 0){
        cin >> N;
        soma += N;
    }
    
    if(N == 10){
        cin >> N;
        moedas++;
    }
    
    
    cout << "Total de moedas: " << soma << endl;
    cout << "Cavernas com 10 moedas: " << moedas << endl;
    
    return 0;
}