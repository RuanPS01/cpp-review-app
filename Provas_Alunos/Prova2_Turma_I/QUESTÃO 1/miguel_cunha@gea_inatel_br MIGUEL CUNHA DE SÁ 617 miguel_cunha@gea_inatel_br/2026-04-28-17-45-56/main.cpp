#include <iostream>

using namespace std;

int main(){
    
    //declaraçao de variaveis
    
    int n;//quantida de valores que vao ser analisados
    int valor;//valores que seram analisados
    
    //variavel que vai contar os numeros divisiveis por 3
    int contador = 0;
    
    //lendo a quantia de numeros que  vao ser analisados
    cin >> n;
    
    //lendo os numeros
    for(int i = 0; i < n; i++){
        cin >> valor;
        //verificando se os valores sao divisiveis por 3
        if(valor %3 == 0){
            contador++;
        }  
    }
    //saida de dados
    cout << contador << endl;
    
    
    return 0;
}