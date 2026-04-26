#include <iostream>
#include <iomanip>

using namespace std;

int main () {
    
    int x;                  //valor
    int c = 0;             //contador
    int m = 0;            //maior
    double t = 0;        //total
    double media;       //media
    

        cin >> x;
        
    while(x =! 0)
    {
        t = t + x;
        c = c + 1;
        
        if(x > m)
        {
            m = x;
        }
        
        cin >> x;
    }
    
    media = t / c;
    
    cout << fixed << setprecision(2) << endl;
    cout << "Maior tempo: " << m << " minutos" << endl;
    cout << "Media dos tempos: " << media << " minutos" << endl;

    return 0;
}