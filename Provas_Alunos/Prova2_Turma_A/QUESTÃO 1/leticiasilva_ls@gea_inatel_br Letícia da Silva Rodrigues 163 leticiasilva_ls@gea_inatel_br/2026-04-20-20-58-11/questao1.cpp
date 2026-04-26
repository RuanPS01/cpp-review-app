#include <iostream>

using namespace std;

int main (){
    
    int N, A, R;
    int PA1 = 0;
    int PA2 = 0;
    int PA3 = 0;
    
    cin >> N >> A >> R; // entrando com qnt de valores, valor inicial e razão
    
    for(int i = 0; i < N; i++){
        
        PA1 = (A + R);
        PA2 = (PA1 + R);
        PA3 = (PA2 + R);
    }
    
    cout << A;
    cout << PA1;
    cout << PA2;
    cout << PA3;
    
    return 0;
}