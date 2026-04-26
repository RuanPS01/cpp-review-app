#include <iostream>

using namespace std;

int main (){
    
   
    int x , contador = 0, soma = 0;
    int vetor[1000];
    
    cin >> x;
    
    for (int i = 0 ; i < x; i++){
        
        contador++;
        vetor[i] = contador;
        
        if (vetor[i] % 2 != 0 ){
            
            cout << vetor[i] << " " ;
            
        }
        
    }
    
    
    return 0 ;
    
}