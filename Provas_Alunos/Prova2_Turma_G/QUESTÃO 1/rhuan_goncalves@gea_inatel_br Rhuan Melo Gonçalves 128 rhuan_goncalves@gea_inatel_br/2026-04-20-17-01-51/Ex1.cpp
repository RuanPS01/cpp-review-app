#include <iostream>
using namespace std;

int main() {
    
    int N, num;
    cin >> N;
    
    for (int i = 0; i < N; i++) {
        cin >> num;
        if (num % 2 == 0) {
            cout << num << " numeros pares" << endl;
        
            } 
            
            else if (num % 2 == 1) {
                cout << num << " numeros impares" << endl;
            }
            
            else if (num > 0) {
                cout << num << " numeros positivos" << endl;
                
            } 
            
            else if (num < 0) {
                cout << num << " numeros negativos" << endl;
                
            }
    }
    
    return 0;
}