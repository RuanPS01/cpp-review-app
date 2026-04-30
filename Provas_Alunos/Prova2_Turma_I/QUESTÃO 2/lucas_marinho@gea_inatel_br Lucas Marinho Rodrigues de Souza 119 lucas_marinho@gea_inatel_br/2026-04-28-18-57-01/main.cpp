#include <iostream>

using namespace std;

int main(){
    
    int N;
    int numero;
    int maiorAltura;
    int menorAltura;
    
    cin >> N;
    
    for(int i = 0; i < N; i++){
        if(numero > N){
            maiorAltura = numero;
        }
        else if( numero < N)
             menorAltura = numero;
    }

    cout << maiorAltura << endl;
    cout << menorAltura << endl;
    
    return 0;
}    
    