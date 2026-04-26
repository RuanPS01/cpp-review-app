#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    
    int tempo;
    int maiorTempo = -999;
    int soma = 0;
    int contador = 0;
    
    
    do {
        
        cin >> tempo; // Inserindo o tempo de treino.
        
        if (tempo != 0) { // Desconsiderando o tempo 0.
            
            if (tempo > maiorTempo) {
                
                maiorTempo = tempo; // Atualizando o maior tempo de treino.
            }
            
            soma = soma + tempo; // Somando os tempos.
            
            contador++; // Contando quantos tempos de treino foram analisados.
        }
    } while (tempo != 0);
    
    cout << "Maior tempo: " << maiorTempo << " minutos" << endl; // Imprimindo o maior tempo de treino.
    cout << fixed << setprecision(2); // Definindo para duas casas decimais
    cout << "Media dos tempos: " << (double) soma / contador << " minutos" << endl; // Imprimindo a média dos treinos.
    
    return 0;
}