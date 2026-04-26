#include <iostream>

using namespace std;


int main(){
    int n;
    double contador = 0;
 
    
    cin >> n;
    
    while (n >= 0) {
        cin >> n;
        if (n % 2 == 0){
            cout << n << " numeros pares" << endl;
        } if (n % 2 != 0){
            cout << n << " numeros impares" << endl;
        } if (n > 0){
            cout << n << " numeros positivos" << endl;
        } if (n < 0){
            cout << n << " numeros negativos" << endl;
        } contador++;
         
         
        
    }
    
    

    return 0;
}