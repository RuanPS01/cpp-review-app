#include <iostream>
using namespace std;

int main(){
    
    int N, R, A, soma;
    
    cin >> N >> A >> R;
    cout << A << " ";
    soma = A + R;
    cout << soma<< " ";
    
    for(int i = 0; i < N - 2; i++){
        
        soma = soma + R;
        cout << soma << " ";
     
    }
    
    return 0;
}