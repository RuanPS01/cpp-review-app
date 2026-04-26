#include <iostream>

using namespace std;

int main (){
    
    int N;
    int numerosInt;
    int numerosPares = 0;
    int numerosImpares = 0;
    int numerosPos = 0;
    int numerosNeg = 0;
    
    if (cin >> N){
        for (int i = 0; i < N; i++){
            cin >> numerosInt;
            
            if (numerosInt % 2 == 0 || numerosInt == 0){
                numerosPares += numerosPares;
            }
            if (numerosInt % 2 != 0){
                numerosImpares += numerosImpares;
            }
            if (numerosInt > 0){
                numerosPos += numerosPos;
            }
            if (numerosInt < 0){
                numerosNeg += numerosNeg;
            }
        }
        
        cout << numerosPares << " numeros pares" << endl;
        cout << numerosImpares << " numeros impares" << endl;
        cout << numerosPos << " numeros positivos" << endl;
        cout << numerosNeg << " numeros negativos" << endl;
    }
    
    return 0;
}