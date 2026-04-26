#include <iostream>
#include <iomanip>

using namespace std;

int main(){
    
    //Definindo as variáveis
    double val[100]; // Vetor
    double num; // Número real a ser encontrado
    double posicao = 0;
    int i;
    
    cin >> num;
    cin >> val[100];
    
    //Estrutura do while
    do{
        
        for(i = 0; i < val[i]; i++){
            
            cin >> val[i];
            
        }
        
        cin >> val[100];
        
    }while(val[100] != 0);
    
    if(num = val[i]){
        posicao = val[i];
        cout << num << " encontrado na posicao " << posicao << endl;
    }
    
    else{
        
        cout << "Elemento nao encontrado" << endl;
    }
    
    
    
    
    return 0;
} 