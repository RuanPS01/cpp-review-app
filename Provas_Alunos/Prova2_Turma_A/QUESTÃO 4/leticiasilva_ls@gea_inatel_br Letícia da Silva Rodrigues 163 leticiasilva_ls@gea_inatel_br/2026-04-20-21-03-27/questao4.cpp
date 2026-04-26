#include <iostream>
#include <cstring>
#include <iomanip>

using namespace std;

int main(){
    
    int i = 0;
    int vetor[100];
    double media = 0;
    int nPositivos = 0, nNegativos = 0;
    char opcao[9];
    double soma = 0;
    
    cin >> vetor[i];
    
    while(vetor[i] != 0){
        
        cin >> vetor[i];
    }
    
    for(int i = 0; i < vetor[i]; i++){
        
        if(vetor[i] > 0){
            
            nPositivos++;
            
        } else if(vetor[i] < 0){
            
            nNegativos++;
            
        }
    }
    
    cin.getline(opcao, 9);
    
    if(opcao == "positivos"){
        
        soma += nPositivos;
        media = soma/nPositivos;
        
    } else if(opcao == "negativos"){
        
        soma += nNegativos;
        media = soma/nNegativos;
    }
    
    cout << fixed << setprecision(3);
    cout << "media = " << media << endl;
    
    
    return 0;
}