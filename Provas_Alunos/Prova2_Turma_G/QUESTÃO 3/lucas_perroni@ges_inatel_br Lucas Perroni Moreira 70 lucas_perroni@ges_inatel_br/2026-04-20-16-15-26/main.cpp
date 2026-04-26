#include <iostream>
#include <iomanip>
using namespace std;

int main ()
{
    //variaveis
    int tempo;
    int media;
    int soma = 0;
    int maiorTempo;
    int qtdTreinos;
    
    //entrada de dados
    cin >> tempo;
    
    //processamentos
    while (tempo != 0)
    {
        qtdTreinos == tempo/tempo;
        soma += tempo;
        media = (double)soma/qtdTreinos;
    
        //entrada novamente para o programa continuar rodadando
        cin >> tempo;
    }
    
    //saida de dados
    cout << fixed << setprecision (2);
    cout << " Media dos tempos: " << media << " minutos" << endl;
    
    
    return 0;
}