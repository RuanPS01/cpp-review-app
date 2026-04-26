#include <iostream>
#include <iomanip> // Biblioteca para lidar com números decimais

using namespace std;

int main(){
    
    //Definindo as variáveis
    int num; // Número de valores que serão lidos
    double val; // Valores que serão lidos
    double soma = 0; // Soma dos valores que serão digitados
    double media = 0;
    
    //Entrada de dados
    cin >> num;
    
    //Laço for
    for(int i = 0; i < num; i++){
        
        //Entrada de dados
        cin >> val;
        soma += val;
    }
    
    //Definindo as variáveis
    media = soma/num;
    
    //Saída de dados
    cout << fixed << setprecision(4);
    cout << media << endl;
    
    
    
    
    
    
    
    
    
    
    return 0;
}