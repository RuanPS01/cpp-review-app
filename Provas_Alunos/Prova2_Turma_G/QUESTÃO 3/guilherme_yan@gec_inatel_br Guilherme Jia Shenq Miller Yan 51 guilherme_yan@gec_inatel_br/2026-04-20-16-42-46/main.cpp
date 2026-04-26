#include <iostream>
#include <iomanip>

using namespace std;

int main()
{
    int tempo;
    float media;
    int maiorTemp;
    int N;
    
    for(int i = 0; i < N; i++)
    {
        cin >> tempo;
        
        if(tempo == 0)
        {
            cout << "Maior tempo: " << maiorTemp << endl;
        }
    }
    int soma = tempo + tempo + tempo;
    
    media = soma % tempo;
    
    cout << fixed << setprecision(2) << endl;
    cout << "Maior Tempo: " << maiorTemp << endl;
    cout << "Media dos tempos: " << media << endl;
    
    return 0;
}
