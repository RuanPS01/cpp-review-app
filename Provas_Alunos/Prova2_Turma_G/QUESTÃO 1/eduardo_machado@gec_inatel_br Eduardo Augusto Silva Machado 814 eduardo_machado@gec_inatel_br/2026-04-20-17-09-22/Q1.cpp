#include <iostream>
using namespace std;

int main(){
    int n; 
    cin >> n;
    
    int pares = 0, impares = 0; //Contadores
    int posit = 0, negat = 0; // Contadores
    int num[10000];
    
    for(int i = 0; i < n; i++){
        cin >> num[i];
        
        if(num[i] > 0){
            posit++;
            if(num[i]%2 == 0){    // Quando arrumo os pares, os postivos da errado
                if(num[i] >= 0) { // Quando arrumo os positivos, os pares da errado
                    pares++;      //arrumei os positivos
                }
            } else {
                impares++;
            }
        }
        if(num[i] < 0){
            negat++;
            if(num[i]%2 != 0){
                impares++;
            } else {
                pares++;
            }
        }
            
        }
        
    cout << pares << " numeros pares" << endl;
    cout << impares  << " numeros impares" << endl;
    cout << posit << " numeros positivos" << endl;
    cout << negat << " numeros negativos" << endl;
    return 0;
}