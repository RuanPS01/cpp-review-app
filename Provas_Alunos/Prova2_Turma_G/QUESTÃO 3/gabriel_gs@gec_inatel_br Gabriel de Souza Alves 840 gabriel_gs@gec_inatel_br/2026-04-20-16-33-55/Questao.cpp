#include <iostream>
#include <cmath>
#include <iomanip>

using namespace std;

int main(){
    
    int tempo[100], maior = 0, i = 0, a = 1;
    float media, soma = 0.0;

    
    for(i = 0; a != 0; i++){
        
        cin >> tempo[i];
        
        if(maior < tempo[i]){
            maior = tempo[i];
        }
        
        soma = soma + tempo[i];
        a = tempo[i];
    }
    
    media = soma/(i-1);
    
    cout << fixed << setprecision(2);
    
    cout << "Maior tempo: " << maior << " minutos" << endl;
    cout << "Media dos tempos: " << media << " minutos" << endl;
    
    return 0;
}