#include <iostream>
using namespace std;

int main() {
    
    int qNum; // Quantidade de números.
    int num; // Número.
    int contadorDePares = 0;
    int contadorDeImpares = 0;
    int contadorDePositivos = 0;
    int contadorDeNegativos = 0;
    
    cin >> qNum; // Inserindo a quantidade de números a serem analisados.
    
    for (int contador = 0; contador < qNum; contador++) {
        
        cin >> num; // Inserindo um número para ser analisado.
        
        if (num % 2 == 0) { // Se o número for par.
            
            contadorDePares++;
        } else if (num % 2 != 0) { // Se for ímpar.
            
            contadorDeImpares++;
        }
        
        if (num > 0) { // Se for positivo.
            
            contadorDePositivos++;
        } else if (num < 0) { // Se for negativo.
            
            contadorDeNegativos++;
        }
        
    }
    
    cout << contadorDePares << " numeros pares" << endl;
    cout << contadorDeImpares << " numeros impares" << endl;
    cout << contadorDePositivos << " numeros positivos" << endl;
    cout << contadorDeNegativos << " numeros negativos" << endl;
    
    return 0;
}