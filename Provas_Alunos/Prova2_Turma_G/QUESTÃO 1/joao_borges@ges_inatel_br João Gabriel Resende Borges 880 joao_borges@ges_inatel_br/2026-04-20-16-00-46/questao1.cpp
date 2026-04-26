#include <iostream>

using namespace std;

int main (){
    int N, numero, pares = 0, impares = 0, positivos = 0, negativos = 0;
    
    cin >> N;
    
    for (int i = 0; i < N; i++){
        cin >> numero;
        
        if (numero % 2 == 0){
            pares++;
            
            if (numero > 0){
                positivos++;
            }
            else if (numero < 0){
                negativos++;
            }
        }
        else{
            impares++;
            
            if (numero > 0){
                positivos++;
            }
            else if (numero < 0){
                negativos++;
            }
        }
    }
    
    cout << pares << " numeros pares" << endl;
    cout << impares << " numeros impares" << endl;
    cout << positivos << " numeros positivos" << endl;
    cout << negativos << " numeros negativos" << endl;
    
    return 0;
}