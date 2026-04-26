#include <iostream>
#include <iomanip> // por conta do set precision

using namespace std;

int main()
{
    int tempo[100];
    int maior_tempo = 0;
    double media = 0;
    int i = 0;
    
    cin >> tempo[i];
    
    while (tempo[i] != 0) {
        
        media = media + tempo[i];
        
        if ( tempo[i] > maior_tempo) {
            maior_tempo = tempo[i];
        }
        
        i++;
        
        cin >> tempo[i];
    }
    
    cout << "Maior tempo: " << maior_tempo << " minutos" << endl;
    cout << "Media dos tempos: " << fixed << setprecision(2) << media / i << " minutos" << endl;
    
    return 0;
}