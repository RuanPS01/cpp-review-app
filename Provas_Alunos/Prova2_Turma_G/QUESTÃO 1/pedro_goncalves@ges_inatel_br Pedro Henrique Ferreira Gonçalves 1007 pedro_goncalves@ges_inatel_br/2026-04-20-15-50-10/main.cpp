#include <iostream>
using namespace std;

int main() {
    int Qtd, Num, nPar = 0, nImpar = 0, nPos = 0, nNeg = 0;
    
    cin >> Qtd; // quantidade de numeros a serem lidos
    
    for (int i = 0; i < Qtd; i++) {
        cin >> Num; // entrada dos numeros inteiros a serem analisados
        
        if (Num % 2 == 0) { // verificando se e par
            nPar++;
        } 
        
        else {
            nImpar++;
        }
        
        if (Num > 0) { // verificando se e positivo ou negativo, excluindo 0
            nPos++;
        }
        
        else if (Num < 0) {
            nNeg++;
        }
    }
    
    // saida
    
    cout << nPar << " numeros pares" << endl;
    
    cout << nImpar << " numeros impares" << endl;
    
    cout << nPos << " numeros positivos" << endl;
    
    cout << nNeg << " numeros negativos" << endl;
    
    return 0;
}