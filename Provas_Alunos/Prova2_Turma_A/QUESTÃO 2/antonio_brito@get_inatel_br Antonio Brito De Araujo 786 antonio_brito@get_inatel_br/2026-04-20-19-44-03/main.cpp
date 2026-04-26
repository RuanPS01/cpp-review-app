#include <iostream>
using namespace std;

int main() {
    
    int N, X;
    cin >> N;
    
    int soma = 0;
    
    for(int i = 0; i < N; i++) {
        cin >> X;
        
        if(X % 2 !=0)
        soma +=X;
    }
    cout << soma << endl;
    
    return 0;
}