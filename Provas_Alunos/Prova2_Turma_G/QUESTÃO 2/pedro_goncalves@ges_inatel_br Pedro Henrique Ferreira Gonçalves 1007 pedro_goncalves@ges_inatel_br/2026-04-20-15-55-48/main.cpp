#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    int Qtd, Num, soma = 0;
    
    double media; // criacao de uma variavel do tipo double para uso do comando setprecision
    
    cin >> Qtd; // entrada da quantidade de numeros inteiros a serem analisados
    
    for (int i = 0; i < Qtd; i++) {
        cin >> Num;
        
        soma += Num; // somatorio dos numeros digitados
    }
    
    media = 1.0 * soma / Qtd; // a media e o somatorio dividido pela quantidade de numeros ( [* 1.0] forca a variavel ser do tipo double ou float)
    
    cout << fixed << setprecision(4);
    
    cout << media << endl;
    
    return 0;
}