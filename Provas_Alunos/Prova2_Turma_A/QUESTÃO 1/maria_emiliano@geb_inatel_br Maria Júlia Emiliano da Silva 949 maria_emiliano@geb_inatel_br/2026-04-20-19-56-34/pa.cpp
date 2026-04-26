#include <iostream>

using namespace std;

int main(){
    int A = 0;
    int R = 0;
    int N = 3;
    int PA;
    
    cin >> A >> R >> N;
    
    for (int i = 0; i <= N; i++){
        PA = A + R - A;
        
    }
    cout << N << PA << endl;
    return 0;
}