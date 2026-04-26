#include <iostream>

using namespace std;

int main() {
    
    int N, i;
    int par = 0, impar = 0, pos = 0, neg = 0;
    int v[1000];
    
    cin >> N;
    
    for (i = 0; i < N; i++) {
        
        cin >> v[i];
    }
    
    for (i = 0; i < N; i++) {
        
        if (v[i] > 0) {
            
            pos++;
        }
        
        if (v[i] < 0) {
            
            neg++;
        }
        
        if (v[i] %2 == 0) {
            
            par++;
        }
        
        if(v[i] %2 != 0) {
            
            impar++;
        }
    }
    
    cout << par << " numeros pares" << endl;
    cout << impar << " numeros impares" << endl;
    cout << pos << " numeros positivos" << endl;
    cout << neg << " numeros negativos" << endl;
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    return 0;
}