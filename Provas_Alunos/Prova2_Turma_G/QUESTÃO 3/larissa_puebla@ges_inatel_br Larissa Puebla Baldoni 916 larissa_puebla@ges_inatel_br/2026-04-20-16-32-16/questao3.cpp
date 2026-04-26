#include <iostream>
#include <iomanip>


using namespace std;

int main ()

{
    int tempos[1000];
    int T = 1;
    int q = 0;
    int maiorTempo;
    int soma = 0;
    double media;
    
    
    while (T != 0){
        
        cin >> T;
        tempos[q] = T;
        
        if (T != 0){
            
            if ( q == 0 ){
            
                maiorTempo = tempos[q];
            }
        
            if (tempos[q] > maiorTempo){
                maiorTempo = tempos[q];
            }
            
            soma = soma + tempos[q];
            
            q++;
        }
    }
    
    media = soma * (1.0) / q;
    
    cout << "Maior tempo: " << maiorTempo << " minutos" << endl;
    cout << "Media dos tempos: " << fixed << setprecision(2) << media << " minutos" << endl;
    
    return 0;
}