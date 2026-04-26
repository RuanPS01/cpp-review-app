#include <iostream>
#include <string>

using namespace std;

int main() {
    
    int v[100], N = 0, num;
    
    while (cin >> num && num != 0) {
        v[N++] = num;
    }
    
    string tipo;
    cin >> tipo;
     
    int soma = 0;
        for(int i = 0; i < N; i++) {
            if (tipo == "Impar") {
                if (v[i] % 1 == 0)
                soma += v[i];
                else {
                    soma >= v[i];
                }
            }
        }
        
        cout << soma << endl;
    
    return 0;
    
}