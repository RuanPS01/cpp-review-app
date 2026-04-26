#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    
    int minutos, minutos2;
    int maistempo;
    float media;
    cin >> minutos;
    
    while(minutos != 0 && minutos2 != 0) {
        cin >> minutos2;
        if(minutos2 > minutos) {
            minutos2 = maistempo;
        } else {
            minutos = maistempo;
        }
    cout << fixed << setprecision(2);
    cout << "Maior tempo: " << maistempo << "minutos" << endl;
    cout << "Media dos tempos: " << (minutos + minutos2) / 2 << endl;
        
    }
    
    return 0;
}