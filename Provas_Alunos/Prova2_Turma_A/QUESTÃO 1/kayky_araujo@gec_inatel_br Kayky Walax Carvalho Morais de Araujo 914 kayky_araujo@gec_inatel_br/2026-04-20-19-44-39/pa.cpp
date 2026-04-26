#include <iostream>

using namespace std;

int main(){
    
    int vInicial;
    int razao;
    int nTermos;
    int nSequencia;
    
    cin >> nTermos >> vInicial >> razao;
    
    for(int i = 0; i < nTermos; i++){
        
        nSequencia = vInicial + (razao * i);
        
        cout << nSequencia << " ";
        
    }
    return 0;
}