#include <iostream>
#include <iomanip>
#include <cstring>

using namespace std;

int main() {
    
    int numeros[100], cont, pos, neg, cont2; 
    char PosNeg;
    double media;
    
    cont = 0;
    pos = 0;
    neg = 0;
    media = 0;
    cont2 = -1;
    
    do {
    
    cin >> numeros[cont];
    
    if (numeros[cont] > 0) {
        pos++;
    }
    else if (numeros[cont] < 0) {
        neg++;
    }
    cont2++;
    cont = numeros[cont];
    }
    while (cont != 0);
    
    cin >> PosNeg;
    
    if (strcmp(PosNeg[10], positivos)) {
        for (int i = 0; i < cont2; i++) {
            if (numeros[cont] > 0) {
                media = media + numeros[cont];
            }
            cont++;
        }
        media = media / pos+1;
    }
    else if (strcmp(PosNeg[10, negativos])) {
        for (int i = 0; i < cont2; i++) {
            if (numeros[cont] < 0) {
                media = media + numeros[cont];
            }
            cont++;
        }
        media = media / neg;
    }
    
    cout << fixed << setprecision(3);
    cout << "media = " << media;
    
    
    return 0;
}



// não cosnsigo me lembrar de como usar strcmp para conferir oque está escrito em um vetor de char.
// apenas me lembro que ele dá os valores 0 caso seja igual, 1 caso seja diferente com mais bit ou -1 caso seja diferente com menos bits.