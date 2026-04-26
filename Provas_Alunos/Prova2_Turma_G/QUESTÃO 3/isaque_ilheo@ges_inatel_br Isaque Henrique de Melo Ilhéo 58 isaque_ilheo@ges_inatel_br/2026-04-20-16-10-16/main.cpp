#include <iostream>
#include <iomanip>
using namespace std;

int main()
{
    int i = 0, tempo, soma = 0, maior = 0;
    
    cin >> tempo;
    
    while(tempo != 0)
    {
        if(tempo > maior)
        {
            maior = tempo;
        }
        soma += tempo;
        i++;
        cin >> tempo;
    }
    
    cout << "Maior tempo: " << maior << " minutos" << endl;
    cout << fixed << setprecision(2) << "Media dos tempos: " << (double) soma / i << " minutos" << endl;
    
    return 0;
}