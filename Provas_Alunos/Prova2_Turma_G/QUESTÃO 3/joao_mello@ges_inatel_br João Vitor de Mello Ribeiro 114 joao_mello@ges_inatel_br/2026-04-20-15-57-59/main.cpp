#include <iostream>
#include <iomanip>

using namespace std;

int main()
{
    int tempos;
    int maior = -1;
    double soma = 0;
    double media;
    int quantidade = 0;
    
    cin >> tempos;
    
    while(tempos != 0)
    {
        soma += tempos;
        quantidade++;
        
        
        if(tempos > maior)
        {
            maior = tempos;
        }
        
        
        cin >> tempos;
    }
    
    media = soma / (quantidade * 1.0);
    
    cout << "Maior tempo: " << maior << " minutos" << endl;
    cout << fixed << setprecision(2) << "Media dos tempos: " << media << " minutos" << endl;
    
    
    return 0;
}