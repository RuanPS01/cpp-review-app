#include <iostream>

using namespace std;

int main(){
    
    //Declaração de variáveis
    
    int quant, id[100], procura;
    
    //Entradas
    
    cin >> quant;
    for(int i = 0; i < quant; i++){
        cin >> id[i];
    }
    cin >> procura; //Pede o id que quer remover
    
    //Processo
    
    for(int i = 0; i < quant; i++){
        if(procura == id[i]){
            id[i] = -1;
        }
    }
    
    //Saídas
    
    for(int i = 0; i < quant; i++){
        cout << id[i] << " ";
    }
    
    return 0;
}