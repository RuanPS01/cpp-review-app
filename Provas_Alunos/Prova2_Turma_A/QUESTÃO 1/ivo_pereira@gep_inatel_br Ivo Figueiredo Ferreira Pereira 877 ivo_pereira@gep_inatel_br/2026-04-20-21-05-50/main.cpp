#include <iostream>
using namespace std;

int main(){
    int N, A, R;
    
    cin >> N >> A >> R;
    
    for (int i = A; i <= N; i += R){
        i += R;
        cout << i << endl;
        
    }
    
    
    
    return 0;
}