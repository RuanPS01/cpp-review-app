#include <iostream>
using namespace std;

int main(){
    int N;
    int num;
    int pares = 0;
    int impares = 0;
    int positivos = 0;
    int negativos = 0;
    
    cin >> N;
    cin >> num;
    
    for(int i = 0; i < N; i++){
        if(num % 2 == 0){
            pares++;
        } else if(num % 2 != 0){
            impares++;
        } 
        if(num > 0){
            positivos++;
        } else if (num < 0){
            negativos++;
        }
        cin >> num;
    }
    
    cout << pares << " numeros pares" << endl;
    cout << impares << " numeros impares" << endl;
    cout << positivos << " numeros positivos" << endl;
    cout << negativos << " numeros negativos" << endl;
    
    return 0;
}