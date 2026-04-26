#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    int tempo, maiorTempo, soma = 0; // atribuicao como int, pois o enunciado informa que a entrada consiste em numeros inteiros
    
    double media;
    
    cin >> tempo; // entrada do primeiro tempo, fora do loop
    
    maiorTempo = tempo; // atribuicao de maiorTempo como o primeiro valor digitado, para comparacao com os demais valores de tempo
    
    int Qtd = 1; // conta quantos tempos sao digitados
    
    soma += tempo; // considera o primeiro tempo digitado na soma
    
    while (tempo != 0) {
        cin >> tempo; // entrada dos demais tempos
        
        if (tempo != 0) {
            if (tempo > maiorTempo) { // comparacao para saber o maiorTempo ao final do loop
                maiorTempo = tempo;
            }
            
            soma += tempo; // somatorio dos tempos para calculo da media
            
            Qtd++; // conta quantos tempos foram digitados;
        }
    }
    
    media = 1.0 * soma / Qtd; // calculo da media (1.0 * ... para forcar o resultado a ser double)
    
    cout << "Maior tempo: " << maiorTempo << " minutos" << endl;
    
    cout << fixed << setprecision(2); // definicao da quantidade de casas decimais
    
    cout << "Media dos tempos: " << media << " minutos" << endl;
    
    return 0;
}