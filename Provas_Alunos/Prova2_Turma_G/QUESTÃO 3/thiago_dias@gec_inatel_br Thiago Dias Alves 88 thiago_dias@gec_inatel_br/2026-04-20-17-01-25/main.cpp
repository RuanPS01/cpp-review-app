#include <iostream>
#include <iomanip>

using namespace std;

int main()
{
    double vet[100];
    int maior = vet[0], n,cont = 0, soma = 0;
    double media = 0;
    
    
    cin >> n;
    
    for(int i = 0; i < n; i++){
        cont++;
        cin >> vet[i];
        soma += vet[i];
        
        if(vet[i] > maior){
            maior = vet[i];
        }
        
        if(vet[i] == 0){
    
        break;
    
        }
    }
    
    media = soma / cont;
    
    cout << fixed << setprecision(2);
    cout << "Maior tempo: " << maior << " minutos" << endl;
    cout << "Media dos tempos: " << media << " minutos" << endl;
    
    return 0;
}