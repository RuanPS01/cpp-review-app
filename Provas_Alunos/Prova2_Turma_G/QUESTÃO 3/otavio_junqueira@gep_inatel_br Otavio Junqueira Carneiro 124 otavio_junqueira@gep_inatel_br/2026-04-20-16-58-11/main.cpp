#include <iostream>
#include <iomanip>
using namespace std;

int main ()
{
    int tempo, maiorTempo= 0, contador=-1;
    int soma = 0; 
    double media = 0.0;
    
    while (tempo != 0)
    {
        cin >> tempo;
        contador ++;
        
        if(tempo > maiorTempo)
            {
                maiorTempo = tempo;
            }
        soma+=tempo;
    }
    
    
    if(contador > 0)
    {
        
        media = static_cast<double>(soma) /contador;
    
        cout << "Maior tempo: " << maiorTempo << " minutos" << endl;
        cout << fixed << setprecision(2)<< "Media dos tempos: " << media << " minutos" << endl;
    }
    
    
    return 0;
}