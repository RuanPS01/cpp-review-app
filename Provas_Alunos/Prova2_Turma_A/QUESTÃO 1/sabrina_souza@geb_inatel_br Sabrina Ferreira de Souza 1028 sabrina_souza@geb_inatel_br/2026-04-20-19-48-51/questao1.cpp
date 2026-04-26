#include <iostream>
using namespace std;

int main(){
    int N, A, R, PA;
    cin >> N >> A >> R;
    
    cout << A << " ";
    for(int i = 1; i < N; i++){
        PA = A + R;
        cout << PA << " ";
        A=PA;
    }
    
    return 0;
}