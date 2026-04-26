#include <iostream>

using namespace std;

int main()
{
    int n,auxiliar,pares = 0,impares = 0,positivos = 0,negativos = 0;
    
    cin >> n;
    
    for(int i = 0; i < n; i++){
        cin >> auxiliar;
        
        if(auxiliar % 2 == 0){
            pares++;
        }
        if(auxiliar % 2 != 0){
            impares++;
        }
        if(auxiliar > 0){
            positivos++;
        }
        if(auxiliar < 0){
            negativos++;
        }
    }
    
    cout << pares << " numeros pares" << endl;
    cout << impares << " numeros impares" << endl;
    cout << positivos << " numeros positivos" << endl;
    cout << negativos << " numeros negativos" << endl;
    
    
    return 0;
}