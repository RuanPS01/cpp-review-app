#include <iostream>
#include <iomanip>
#include <cstring>
using namespace std;

int main() {
    int Qnt = 0, Numero = 1, QntP = 0, QntN = 0; 
    double Vetor[100], Soma = 0, Media = 0;
    
    while (Numero != 0) {
        cin >> Numero;
            Vetor[Qnt] = Numero;
            Qnt++;
    }
    
    char Definir[50];
    cin.ignore();
    cin.getline(Definir,100);
    
    if (strcmp(Definir, "positivos") == 0) {
        for (int I = 0; I < Qnt; I++) {
            if (Vetor[I] > 0) {
                Soma += Vetor[I];
                QntP++;
            }
        }
        Media = Soma / (QntP * 1.0);
        cout << fixed << setprecision(3) << "media = " << Media << endl;
    }
        else if (strcmp(Definir, "negativos") == 0) {
            for (int J = 0; J < Qnt; J++) {
                if (Vetor[J] < 0) {
                    Soma += Vetor[J];
                    QntN++;
                }
            }
            Media = Soma / (QntN * 1.0);
            cout << fixed << setprecision(3) << "media = " << Media << endl;
        }
    
    return(0);
}