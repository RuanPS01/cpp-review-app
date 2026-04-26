#include <iostream>
#include <iomanip>

using namespace std;

int main()
{
    int tempo;
    double maiorTempo = -999;
    double soma = 0;
    double media;
    int i = 0;
    
    cin >> tempo;

    while(tempo != 0)
    {
        if(tempo > maiorTempo)
        {
            maiorTempo = tempo;
        }
        soma += tempo;
        i++;
        cin >> tempo;
    }
    
    media = soma/i;
    
    cout << "Maior tempo: " << maiorTempo << " minutos" << endl;
    cout << fixed << setprecision(2);
    cout << "Media dos tempos: " << media << " minutos" << endl;

    return 0;
}