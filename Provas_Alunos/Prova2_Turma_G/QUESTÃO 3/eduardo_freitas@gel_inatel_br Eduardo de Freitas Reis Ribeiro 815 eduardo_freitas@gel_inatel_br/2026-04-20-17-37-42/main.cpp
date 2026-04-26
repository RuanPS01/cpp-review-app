#include <iostream>
#include <iomanip>
using namespace std;

int main()
{
    int n, x, temp[10];
    double tempo[10], maior;
    int count = 0;    
    double soma = 0, media;
    int maiorainda;
    
    do
    {
        cin >> tempo[10];
        n = tempo[10];
        x = tempo[10];
        
        count++;
        soma += n;
        
        x = tempo[0];
        maior = tempo[0];
        
        if(tempo[10] > tempo[0])
        {
            maior = x - maior;
            maior = tempo[10];
              
        }
        
        
    }while(n != 0);
    
    media = soma / (count - 1);
    
    
    cout << "Maior tempo: " << maior << " minutos"<< endl;
    cout << fixed << setprecision(2);
    cout << "Media dos Tempos: " << media << " minutos" <<  endl;
    
    return 0;
}