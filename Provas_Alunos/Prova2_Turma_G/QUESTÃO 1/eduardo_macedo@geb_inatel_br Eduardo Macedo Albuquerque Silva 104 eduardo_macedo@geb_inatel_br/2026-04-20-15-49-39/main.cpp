#include <iostream>

using namespace std;

int main(){
    
    //Definindo as variáveis
    int qnt; // Quantidade de valores para serem lidos
    int val; // Valores que serão lidos
    int pares = 0; // Quantidade de números pares
    int impares = 0; // Quantidade de números impares
    int negativos = 0; // Quantidade de números negativos
    int positivos = 0; // Quantidade de números positivos
    
    //Entrada de dados
    cin >> qnt;
    
    //Laço for
    for(int i = 0; i < qnt; i++){
        
        //Entrada de dados
        cin >> val;
        
        //Condições
        if(val > 0){
            
            positivos++;
            
        }
        
        if(val < 0){
            
            negativos++;
        }
        
        if(val % 2 == 0){
            
            pares++;
        }
        
        if(val % 2 != 0){
            
            impares++;
        }
    }
    
    cout << pares << " numeros pares" << endl;
    cout << impares << " numeros impares" << endl;
    cout << positivos << " numeros positivos" << endl;
    cout << negativos << " numeros negativos" << endl;
    
    return 0;
}