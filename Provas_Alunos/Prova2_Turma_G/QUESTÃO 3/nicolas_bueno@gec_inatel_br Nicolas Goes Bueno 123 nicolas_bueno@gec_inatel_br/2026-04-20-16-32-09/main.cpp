#include <iostream>
#include <iomanip>
using namespace std;

int main()
{
    int N;
    int Mtmp = 0;
    double soma = 0;
    int contador = 0;
    
    while(N != 0)
    {
        cin >> N;
        
        soma += N;
        
        if(N != 0)
        {
            contador++;
        }
        
        if(N > Mtmp)
        {
            Mtmp = N;
        }
    }
    
    double media = (soma/contador);
    
    cout << "Maior tempo: " << Mtmp << " minutos" << endl;
    cout << fixed << setprecision(2);
    cout << "Media dos tempos: " << media << " minutos" << endl;
    
    return 0;
}