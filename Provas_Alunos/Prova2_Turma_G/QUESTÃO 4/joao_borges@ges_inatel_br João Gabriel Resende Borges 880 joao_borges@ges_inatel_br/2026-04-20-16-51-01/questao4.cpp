#include <iostream>
#include <iomanip>

using namespace std;

int main (){
    int i = 0, encontrado, posicao;
    double numeros[1000], pesquisa, numero = 1;
    
    while (numero != 0){
        cin >> numero;
        
        if (numero != 0){
            numeros[i] = numero;
            i++;
        }
        
    }
    
    cin >> pesquisa;
    
    for (int j = 0; j < i; j++){
        if (numeros[j] == pesquisa){
            encontrado = 1;
            posicao = j;
            j = i;
        }
        else{
            encontrado = 0;
        }
    }
    
    if (encontrado == 1){
        cout << pesquisa * 1.0 << " encontrado na posicao " << posicao << endl;
    }
    else if(encontrado == 0){
        cout << "Elemento nao encontrado" << endl;
    }
    
    return 0;
}