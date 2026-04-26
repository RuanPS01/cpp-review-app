#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    
    int contador = 0;
    double num[50];
    double tempNum;
    
    do {
        
        cin >> tempNum; // Inserindo um número.
        
        if (tempNum != 0.0) { // Desconsirando o 0.
            
            num[contador] = tempNum; // Atribuindo o número no vetor.
            
            contador++; // Indo para a próxima variável do vetor.
        }
    } while (tempNum != 0.0);
    
    contador = 0;
    
    bool numEncontrado = false;
    double procuraNum;
    
    cin >> procuraNum; // Inserindo o número de referência.
    
    while (contador < 50 && !numEncontrado) { // Procurando o número no vetor.
        
        if (procuraNum == num[contador]) { // Se for encontrado.
            
            numEncontrado = true;
        } else if (procuraNum != num[contador]) { // Se não for encontrado.
            
            contador++;
        }
    }
    
    if (numEncontrado && procuraNum != 0.0) { // Imprimindo a posição do número de referência.
        
        cout << procuraNum << " encontrado na posicao " << contador << endl;
    } else if (!numEncontrado || procuraNum == 0.0) {
        
        cout << "Elemento nao encontrado" << endl;
    }
    
    return 0;
}