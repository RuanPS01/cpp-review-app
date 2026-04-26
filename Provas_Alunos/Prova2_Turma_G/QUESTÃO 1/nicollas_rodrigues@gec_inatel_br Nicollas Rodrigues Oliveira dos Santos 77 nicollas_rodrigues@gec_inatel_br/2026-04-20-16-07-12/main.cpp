#include <iostream>
using namespace std;

int main() {
    
    int N;
    cin >> N;
    int pares = 0, impares = 0, positivos = 0, negativos = 0;
    int numeros;
    
    
    for(int i = 0; i < N; i++) {
        cin >> numeros;
        if(numeros % 2 == 0){
            pares++;
            cout << pares << "numeros pares" << endl;
        }else if(numeros % 2 != 0) {
            impares++;
            cout << impares << "numeros impares" << endl;
        }else if(numeros > 0) {
            positivos++;
            cout << positivos << "numeros impares" << endl;
        }else {
            negativos++;
            cout << negativos << "numeros negativos" << endl;
        }
        
    }
    
    return 0;
}