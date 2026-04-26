#include <iostream>
using namespace std;

int main() {
    int X, Vetor[1000];
    
    cin >> X;
    
    for (int I = 0; I <= X; I++) {
        Vetor[I] = I;
        
        if (Vetor[I] % 2 != 0) {
            cout << Vetor[I] << " ";    
        }
    }
    return(0);
}