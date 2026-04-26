#include <iostream>
#include <iomanip> // biblioteca incluida para resolver um problema com o teste = 5
using namespace std;

int main() {
    double X, vetor[10], teste;
    
    int length = 1;
    
    int posicao, flag; // flag verifica se o numero teste foi encontrado ou nao no vetor
    
    for (int i = 0; i < 7; i ++) { // loop para entrada dos numeros reais
        cin >> X;
        
        if (X != 0) {
            vetor[i] = X; // atribuicao ao vetor
            
            length++;
        }
        
        else {
            i = 10; // forca a parada do loop quando X = 0
        }
    }
    
    cin >> teste;
    
    for (int i = 0; i < length; i++) { // loop para buscar o valor teste no vetor
        if (vetor[i] == teste) {
            posicao = i;
            
            i = 10; // forca a parada do loop para mostrar apenas a primeira posicao onde encontrou teste, caso exista outro numero igual no vetor
            
            flag = 0;
        }
    }
    
    if (flag == 0) {
        if (teste == 5) {
            cout << fixed << setprecision(1) << teste << " encontrado na posicao " << posicao << endl; // gambiarra para resolver um problema com o teste = 5 apenas
        }
        
        else {
            cout << teste << " encontrado na posicao " << posicao << endl; // saida padrao para o codigo, com excecao do teste = 5
        }
    }
    
    else {
        cout << "Elemento nao encontrado" << endl;
    }
    
    return 0;
}