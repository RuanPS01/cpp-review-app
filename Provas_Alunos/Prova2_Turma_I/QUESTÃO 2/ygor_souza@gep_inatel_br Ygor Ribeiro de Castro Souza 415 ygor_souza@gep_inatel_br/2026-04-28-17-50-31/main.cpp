#include <iostream>
#include <iomanip>

using namespace std;

int main()
{
    // Declarando as variaveis
    int N;
    float Maior = -1;
    float Menor = 3;
    float Altura;
    
    // Entrada do numero de pessoas
    cin >> N;
    
    // Entrada das alturas
    while (N--)
    {
        cin >> Altura;
        
        if (Altura > Maior)
            Maior = Altura;
            
        if (Altura < Menor)
            Menor = Altura;
    }
    
    // Saida
    cout << fixed << setprecision(2);
    cout << "Menor altura: " << Menor << endl;
    cout << "Maior altura: " << Maior << endl;
    
    
    return 0;
}