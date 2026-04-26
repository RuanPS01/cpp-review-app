#include <iostream>
#include <iomanip>
using namespace std;

int main()
{
    int tempo, quant = 0, soma = 0, maior = 0;
    
    while (tempo != 0)
    {
        cin >> tempo;
        if (tempo > maior)
        {
            maior = tempo;
        }
        quant++;
        soma += tempo;  
    }
    
    cout << "Maior tempo: " << maior << " minutos" << endl;
    cout << fixed << setprecision(2);
    cout << "Media dos tempos: " << (double)soma/(quant - 1) << " minutos" << endl;
    
    return 0;
    
}