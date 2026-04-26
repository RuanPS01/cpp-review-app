#include <iostream>
#include <iomanip>
using namespace std;

int main(){
    int x;
    
    int soma = 0;
    int maior = -999;
    
    int contador = 0; 
    
    while(cin >> x && x != 0){ 
        soma += x; // total 
        if(x > maior){
            maior = x; // maior numero
        }
        contador++; // total de numeros 
    }
    cout << "Maior tempo: " << maior <<" minutos" << endl;
    cout << "Media dos tempos: " << fixed << setprecision(2) << (double)soma/contador << " minutos";
    return 0;
}
// Easy