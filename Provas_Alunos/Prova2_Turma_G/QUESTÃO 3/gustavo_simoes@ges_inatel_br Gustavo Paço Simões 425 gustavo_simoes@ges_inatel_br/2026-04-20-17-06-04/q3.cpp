#include <iostream>
#include <iomanip>

using namespace std;

int main () {
    
    int v[1000];
    int N = 0, i, c = 0, maior = 0, soma = 0;
    double media;
    
    while (v[i] != 0); {
        
        cin >> v[i];
        soma += v[i];
        N++;
        
        break // nao dava para entregar sem o break
    }
    
    for (i = 0; i < N; i++) {
        
        if (v[i] > v[i-1]) {
            
            maior == v[i];
        }
    }
    
    media == soma / N;
    
    cout << "Maior tempo: " << maior << " minutos" << endl;
    cout << fixed << setprecision(2) << endl;
    cout << "Media dos tempos: " << media << " minutos" << endl;
    

    
    return 0;
}