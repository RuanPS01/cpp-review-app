#include <iostream>
#include <cmath>

using namespace std;

int main(){
    
    int n = 0, numeros [100], positivo = 0, par = 0, impar = 0, negativo = 0, i = 0;
    
    cin >> n;
    
    while(i < n){
        cin >> numeros[i];
        i++;
    }
    
    i = 0;
    while(i < n){
        
        if(numeros[i] % 2 == 0){
            par ++;
        }else{
            impar ++;
        }
        
        if(numeros[i] > 0){
            positivo ++;
        }else if(numeros[i] < 0){
            negativo ++;
        }
        
        i++;
    }
    
    cout << par << " numeros pares" << endl;
    cout << impar << " numeros impares" << endl;
    cout << positivo << " numeros positivos" << endl;
    cout << negativo << " numeros negativos" << endl;
    
    return 0;
}