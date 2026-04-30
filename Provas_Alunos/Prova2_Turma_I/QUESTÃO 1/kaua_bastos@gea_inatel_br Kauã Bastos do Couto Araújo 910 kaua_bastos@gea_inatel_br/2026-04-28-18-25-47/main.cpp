#include <iostream>

using namespace std;

int main(){
    
    //Declaração de variáveis
    
    int quant, num, cont = 0;
    
    //Entrada/Processo
    
    cin >> quant;
    
    for(int i = 0; i < quant; i++){
        cin >> num;
        if(num % 3 == 0){
            cont++;
        }
    }
    
    //Saída 
    
    cout << cont << endl;
    
    return 0;
}