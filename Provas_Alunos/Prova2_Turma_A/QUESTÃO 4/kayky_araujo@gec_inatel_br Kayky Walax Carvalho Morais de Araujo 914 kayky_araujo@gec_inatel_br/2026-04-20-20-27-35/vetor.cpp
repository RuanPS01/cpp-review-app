#include <iostream>
#include <cstring>
#include <iomanip>

using namespace std;

int main(){
    
    int numeros[100];
    int valor;
    int tamanho = 0;
    int numerosNeg = 0;
    int numerosPos = 0;
    int i = 0;
    float soma = 0;
    double media = 0;
    string escolha;
    
    cin >> valor;
    
    while(valor != 0){
        numeros[i] = valor;
        
        cin >> valor;
        
        i++;
        
    }
    
    tamanho = i;
    i = 0;
    cin >> escolha;
    
    if(escolha == "positivos"){
        for(i; i < tamanho; i++ ){
            if(numeros[i] > 0){
                soma += numeros[i];
                numerosPos++;
            }
        }
        
        media = soma/numerosPos;  
        
        
    } else if(escolha == "negativos"){
        for(i; i < tamanho; i++ ){
            if(numeros[i] < 0){ 
                soma += numeros[i];
                numerosNeg++; 
            }
        }
         
        media = soma/numerosNeg; 
    }
    

    cout << fixed << setprecision(3);
    cout << "media = " << media;
    
    return 0;
    
    
    
}