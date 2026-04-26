#include<iomanip>
#include<iostream>
#include<cmath>
#include<cstring>

using namespace std;

int main()
{
    double Numeros[1000];
    int i = 0;
    double procurando;
    double posicao;
    bool encontrado = false;
    bool diferente = true;
    
    do{
        cin >> Numeros[i];
        
        if(Numeros[i] == 0)
        {
            diferente = false;
        }
        
        i++;
        
    } while(diferente == true);
    
    cin >> procurando;
    if(procurando != 0)
    {
        for(int j = 0; j < i; j++ )
        {
            if(procurando == Numeros[j])
            {
                posicao = j;
                
                cout << setprecision(3);
                cout << setprecision(3) << procurando + 0.0 << " encontrado na posicao " << j;
                encontrado = true;
                break;
            }
        }
    }
    
    if(encontrado == false)
    {
        cout << "Elemento nao encontrado" << endl;
    }
    
    return 0;
}