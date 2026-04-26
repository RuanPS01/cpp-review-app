#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    
    int qNum; // Quantidade de números.
    int num; // Números.
    int soma = 0;
    
    cin >> qNum; // Inserindo a quantidade de números.
    
    for (int contador = 0; contador < qNum; contador++) {
        
        cin >> num; // Inserindo um número.
        
        soma = soma + num; // Realizando a soma desses números.
    }
    
    cout << fixed << setprecision(4); // Ajustando para 4 casas decimais.
    cout << (double) soma / qNum << endl; // Imprimindo a média dos números.
    
    return 0;
}