#include <iostream>
#include <iomanip>

using namespace std;

int main()
{
    // Declarando as variaveis
    int Voto;
    float Um = 0;
    float Dois = 0;
    float Tres = 0;
    float Quatro = 0;
    float Cinco = 0;
    int i = 0;
    
    // Entrada
    do
    {
        cin >> Voto;
        
        if (Voto != 6)
            i++;
        
        if (Voto == 1)
            Um++;
            
        if (Voto == 2)
            Dois++;
            
        if (Voto == 3)
            Tres++;
            
        if (Voto == 4)
            Quatro++;
            
        if (Voto == 5)
            Cinco++;
        
        
    } while (Voto != 6);   
    
    // Calculando a porcentagem
    Um = (Um / i) * 100;
    Dois = (Dois / i) * 100;
    Tres = (Tres / i) * 100;
    Quatro = (Quatro / i) * 100;
    Cinco = (Cinco / i) * 100;
    
    // Saida
    cout << fixed << setprecision(2);
    cout << "1 estrela: " << Um << "%" << endl;
    cout << "2 estrelas: " << Dois << "%" << endl;
    cout << "3 estrelas: " << Tres << "%" << endl;
    cout << "4 estrelas: " << Quatro << "%" << endl;
    cout << "5 estrelas: " << Cinco << "%" << endl;
    
    
    return 0;
}