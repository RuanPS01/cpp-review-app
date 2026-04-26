#include <iostream>
#include <iomanip>
#include <cstring>

using namespace std;

int main (){
    
    int vetor[1000];
    int soma_par = 0, soma_impar;
    int i = 0;
    char nome[500];
    
    while (vetor[i] != 0 ){
        
        cin >>vetor[i];
        
        if (vetor[i] > 0  ){
            
            soma_par = soma_par + vetor[i];
            
        }else if (vetor[i] < 0 ){
            
            soma_impar = soma_impar + vetor[i];
            
        }
           
           i++;
        
    }
    
    
    
    
    
    return 0 ; 
}