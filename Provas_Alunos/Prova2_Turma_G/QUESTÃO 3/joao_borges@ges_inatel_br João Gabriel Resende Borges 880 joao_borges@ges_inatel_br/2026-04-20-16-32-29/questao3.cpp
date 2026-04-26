#include <iostream>
#include <iomanip>

using namespace std;

int main (){
    int tempos[1000], tempo = 1, maior_tempo, soma = 0, q = 0;
    double media;
    
    while (tempo != 0){
        cin >> tempo;
        tempos[q] = tempo;
        
        if (tempo != 0){
            
            if (q == 0){
                maior_tempo = tempos[q];
            }
            
            if (tempos[q] > maior_tempo){
                maior_tempo = tempos[q];
            }
            
            soma = soma + tempos[q];
            
            q++;
        }
    }
    
    media = soma * 1.0 / q;
    
    cout << "Maior tempo: " << maior_tempo << " minutos" << endl;
    cout << "Media dos tempos: " << fixed << setprecision(2) << media << " minutos"<< endl;
    
    return 0;
    
    
    
    
    
    
    
    
    
    
}