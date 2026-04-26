#include <iostream>
using namespace std;

int main(){
    
    int N = 0, A = 0, R = 0, val = 0;
    
    cin >> N >> A >> R;
    
    val = A;
    
    for(int i = 0; i < N; i++){
        cout << val << " ";
        val += R;
    }
    
    return 0;
}