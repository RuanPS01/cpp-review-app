#include <iomanip>
#include <iostream>
#include <cmath>
#include <cstring>

using namespace std;

int main()
{
    char *numeros[50];
    int i = 0;
    char *maior = 0;
    double media = 0;
    double pck[90];
    do
    {
        cin >> numeros[i];
        pck[i] = strtok(numeros[i]," ,.-");
        i++;
    }while(pck[i] !=0);
    
    for(int j = 0; j < i; j++){
        //compara se e menor ou maior que o numero atualmente registrado
        if(pck[j] > maior)
        {
            maior = pck[j];
        }
        
        media = media + pck[j];
    }
    
    //imprime maior e media
    cout << "Maior tempo: " << maior << "minutos" << endl;
    
    cout << setprecision(2);
    cout << "Media dos tempos: " << media/i << " minutos" << endl;
    
    return 0;
}