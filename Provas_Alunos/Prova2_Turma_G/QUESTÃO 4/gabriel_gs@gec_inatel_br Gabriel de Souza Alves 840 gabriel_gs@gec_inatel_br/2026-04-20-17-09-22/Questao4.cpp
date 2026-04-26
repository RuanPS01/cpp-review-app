#include <iostream>
#include <cmath>

using namespace std;

int main(){
    
    int numeros[100], a = 1, x, i = 0, n = 0, c = 0;
    bool b = false;
    
    for(i; a != 0; i++){
        
        cin >> numeros[100];
        
        a = numeros[100];
        n++;
    }
    
    cin >> x;
    
    for(i; i == n || c == 1; i++){
        
        if(numeros[i] == x){
            cout << x << " encontrado na posicao " << i << endl;
            c = 1;
        }
    }
    
        if(c == 0){
            cout << "Elemento nao encontrado" << endl;
        }
        
    return 0;
}