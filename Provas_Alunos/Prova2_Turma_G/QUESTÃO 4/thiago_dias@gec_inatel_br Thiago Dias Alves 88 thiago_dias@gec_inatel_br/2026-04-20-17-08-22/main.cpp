#include <iostream>

using namespace std;

int main()
{
    int resultado;
    int n;
    int x = 0;
    double vet[100];
    
    cin >> n >> resultado;
    
    while(cin >> vet[x] && vet[x] != 0 && x < n){
        x++;
        
        
        if(resultado == vet[x]){
            cout << resultado << "encontrado na posicao " << x << endl;
        }
        else{
            cout << "Elemento nao encontrado" << endl;
        }
        
        
    }    
  
    return 0;
}