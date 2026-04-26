#include <iostream>
#include <iomanip>

using namespace std;

int main(){
    int N, A, R, S = 0,D;
    cin >> N;
    
    for(int i = 0; i < N; i++){
        cin >> A >> R;
        D = A;
        S += R;
        D += S;
        cout << D << " ";
    }
    



    return 0;
}