#include <iostream>

using namespace std;

int main() {
    
    int N, A, R;
    cin >> N >> A >> R;
    int soma = A + R;
    
    for (int i = 0; i < N; i++) {
        soma = soma + R;
    }
    
    cout << soma << endl;
    
    return 0;
        
    
}