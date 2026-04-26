#include <iostream>
#include <iomanip>
#include <cstring>

using namespace std;

int main(){
    
    int numeros[1000], numero = 1, contador = 0, quantidade = 0, positivo = 1, negativo = 1;
    double media = 0.0, total = 0.0;
    char sinal[10];
    
    while(numero != 0){
        cin >> numero;
        
        if(numero != 0){
            numeros[contador] = numero;
            contador ++;
        }
    }
    
    cin.ignore();
    cin.getline(sinal, 10);
    
    positivo = strcmp(sinal, "positivos");
    negativo = strcmp(sinal, "negativos");
    
    for(int i = 0; i < contador; i ++){
        if(positivo == 0 && numeros[i] > 0){
            total += numeros[i];
            quantidade ++;
            
        }
        if(negativo == 0 && numeros[i] < 0){
            total += numeros[i];
            quantidade ++;
        }
    }
    
    if(quantidade != 0){
        media = total/quantidade;
        
    }
    
    cout << fixed << setprecision(3);
    cout << "media = " << media;
    
    return 0;
}